const searchConfig = require('./searchConfig');
const { normalizeQuery, createLogger, isTimeSensitiveQuery } = require('./utils');
const { rankResults } = require('./ranking');
const { createCache } = require('./cache');
const { generateAnswer, selectAnswerSources } = require('./answerEngine');
const { detectEntity } = require('./entityDetector');
const webProvider = require('./providers/webProvider');
const questionProvider = require('./providers/questionProvider');
const wikimediaProvider = require('./providers/wikimediaProvider');
const openverseProvider = require('./providers/openverseProvider');
const flickrProvider = require('./providers/flickrProvider');

const logger = createLogger('search-router');

function detectIntent(query) {
  const text = normalizeQuery(query).toLowerCase();
  if (!text) {
    return { type: 'question', confidence: 0.5, reason: 'empty-query' };
  }
  const hasQuestionWord = /\b(who|what|when|where|why|how|can|could|do|does|is|are|define|meaning|explain|install|tutorial|guide|tell|learn)\b/.test(text);
  const hasNewsWord = /\b(latest|today|yesterday|current|currently|recent|news|score|result|happened|update|updates|breaking|live)\b/.test(text);
  const hasWebWord = /\b(search|find|website|site|article|docs|documentation|wiki|information|info)\b/.test(text);

  if (hasQuestionWord) {
    return { type: 'question', confidence: 0.9, reason: 'question-keyword' };
  }

  if (hasNewsWord) {
    return { type: 'question', confidence: 0.88, reason: 'current-events' };
  }

  if (hasWebWord) {
    return { type: 'question', confidence: 0.72, reason: 'search-keyword' };
  }

  return { type: 'question', confidence: 0.7, reason: 'default-question' };
}

function buildCacheKey(query) {
  return `qa:${normalizeQuery(query).toLowerCase()}`;
}

function getCacheTtl(query, appConfig = searchConfig) {
  return isTimeSensitiveQuery(query)
    ? Number(appConfig.cache?.currentTtlMs || 10 * 60 * 1000)
    : Number(appConfig.cache?.defaultTtlMs || 6 * 60 * 60 * 1000);
}

function shouldFetchImage() {
  return false;
}

function buildImageQuery(query, entity) {
  return entity || normalizeQuery(query);
}

function buildResponseSources(searchResults) {
  return selectAnswerSources(searchResults, 4);
}

function createSearchRouter(customConfig = searchConfig, providerOverrides = {}) {
  const cacheInstance = createCache({
    defaultTtlMs: Number(customConfig.cache?.defaultTtlMs || 6 * 60 * 60 * 1000),
    maxEntries: Number(customConfig.cache?.maxEntries || 300)
  });

  const providers = {
    webProvider: providerOverrides.webProvider || webProvider,
    questionProvider: providerOverrides.questionProvider || questionProvider,
    wikimediaProvider: providerOverrides.wikimediaProvider || wikimediaProvider,
    openverseProvider: providerOverrides.openverseProvider || openverseProvider,
    flickrProvider: providerOverrides.flickrProvider || flickrProvider
  };

  async function fetchImageResults(query, entity, timeoutMs = 15000) {
    const itemQuery = buildImageQuery(query, entity);
    const context = { config: customConfig, timeout: timeoutMs, retries: 1 };
    const providerFns = [
      providers.wikimediaProvider.searchWikimediaImages,
      providers.openverseProvider.searchOpenverseImages,
      providers.flickrProvider.searchFlickrImages
    ];
    const minScore = Number(customConfig.search?.minImageScore || 30);

    for (const providerFn of providerFns) {
      try {
        const result = await providerFn(itemQuery, context);
        const items = Array.isArray(result.items) ? result.items.filter(item => item && item.imageUrl) : [];
        if (items.length) {
          const ranked = rankResults(itemQuery, items, 'image');
          const accepted = ranked.filter(i => Number(i.score || 0) >= minScore);
          if (accepted.length) {
            return accepted;
          }
        }
      } catch (error) {
        logger.warn('image provider failed', { error: error.message, provider: providerFn.name });
      }
    }

    return [];
  }

  async function searchRouter(query, options = {}) {
    const normalized = normalizeQuery(query);
    const cacheKey = buildCacheKey(normalized);
    const cached = cacheInstance.get(cacheKey);
    if (cached) {
      logger.debug('serving cached result', { cacheKey });
      return { ...cached, cached: true };
    }

      const intent = detectIntent(normalized);
      const detectedEntity = detectEntity(normalized);
      const entity = detectedEntity && detectedEntity.entity ? detectedEntity.entity : null;
      const allowImage = shouldFetchImage(normalized, detectedEntity);
    const timeoutMs = options.timeout || Number(customConfig.ai?.timeoutMs || 25000);

    let searchResults = [];
    let sourceName = 'web';
    let missingConfig = null;
    // Note: API keys are optional - fallback answer generation will work without them

    try {
      const webResponse = await providers.webProvider.searchWeb(normalized, { config: customConfig, timeout: timeoutMs, retries: 1 });
      if (webResponse.missingConfig && !missingConfig) {
        missingConfig = webResponse.missingConfig;
      }
      searchResults = Array.isArray(webResponse.items) ? webResponse.items : [];
      sourceName = webResponse.source || sourceName;

      if (!searchResults.length) {
        const questionResponse = await providers.questionProvider.searchQuestion(normalized, { timeout: timeoutMs, retries: 1 });
        if (questionResponse?.item) {
          searchResults = [questionResponse.item];
          sourceName = questionResponse.source || sourceName;
        }
      }
    } catch (error) {
      logger.warn('web search failed', { error: error.message });
    }

    const answerResult = await generateAnswer(normalized, searchResults, customConfig);

    const response = {
      query: normalized,
      answer: answerResult.text,
      ai: Boolean(answerResult.ai),
      entity: entity || normalized,
      sources: buildResponseSources(searchResults),
      image: null,
      cached: false,
      provider: sourceName,
      confidence: intent.confidence,
      missingConfig,
      intent
    };

    cacheInstance.set(cacheKey, response, getCacheTtl(normalized, customConfig));
    return response;
  }

  return {
    searchRouter,
    detectIntent,
    detectEntity,
    cache: cacheInstance,
    buildCacheKey
  };
}

const { searchRouter, cache: cacheInstance, detectIntent: detectIntentDefault, detectEntity: detectEntityDefault, buildCacheKey: buildCacheKeyDefault } = createSearchRouter();

module.exports = {
  createSearchRouter,
  searchRouter,
  detectIntent: detectIntentDefault,
  detectEntity: detectEntityDefault,
  rankResults: rankResults,
  cache: cacheInstance,
  buildCacheKey: buildCacheKeyDefault
};
