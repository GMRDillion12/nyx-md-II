const { requestJson, normalizeQuery, isPlaceholderImage, sanitizeText, createLogger, createRateLimiter } = require('../utils');
const { rankResults } = require('../ranking');

const logger = createLogger('search-image-provider');

function isExplicitQuery(query) {
  return /\b(nude|porn|sex|xxx|hentai|nsfw|explicit|anal|milf|boobs|pussy|ass|erotic|sexy)\b/i.test(query || '');
}

async function searchDuckDuckGoImages(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) return [];

  const response = await requestJson(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(term)}`, {
    timeout: Number(context.timeout || 15000),
    retries: Number(context.retries || 1),
    rateLimiter: context.rateLimiter || createRateLimiter(4, 1000),
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });

  const results = Array.isArray(response?.data?.results) ? response.data.results : [];
  return results
    .map(item => ({
      title: sanitizeText(item?.title || term, 140),
      description: sanitizeText(item?.title || term, 220),
      width: Number(item?.width || 0),
      height: Number(item?.height || 0),
      url: item?.image || item?.thumbnail || item?.url || '',
      thumbnail: item?.thumbnail || item?.image || item?.url || ''
    }))
    .filter(item => item.url && !isPlaceholderImage(item.url));
}

async function searchSerpApiImages(query, context = {}) {
  const term = normalizeQuery(query);
  const apiKey = context.config?.search?.serpApiKey || context.serpApiKey || '';
  if (!term || !apiKey) return [];

  const response = await requestJson('https://serpapi.com/search.json', {
    timeout: Number(context.timeout || 15000),
    retries: Number(context.retries || 1),
    rateLimiter: context.rateLimiter || createRateLimiter(4, 1000),
    params: {
      engine: 'google_images',
      q: term,
      api_key: apiKey
    }
  });

  const results = Array.isArray(response?.data?.images_results) ? response.data.images_results : [];
  return results
    .map(item => ({
      title: sanitizeText(item?.title || term, 140),
      description: sanitizeText(item?.snippet || term, 220),
      width: Number(item?.original_width || 0),
      height: Number(item?.original_height || 0),
      url: item?.original || item?.thumbnail || '',
      thumbnail: item?.thumbnail || item?.original || ''
    }))
    .filter(item => item.url && !isPlaceholderImage(item.url));
}

async function searchExplicitImages(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term || !isExplicitQuery(term)) return [];

  const endpoints = [
    `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&tags=${encodeURIComponent(term)}&limit=6`,
    `https://xhamster.com/search.php?q=${encodeURIComponent(term)}`
  ];

  const results = [];
  for (const endpoint of endpoints) {
    try {
      const response = await requestJson(endpoint, {
        timeout: Number(context.timeout || 15000),
        retries: Number(context.retries || 1),
        rateLimiter: context.rateLimiter || createRateLimiter(4, 1000)
      });

      if (endpoint.includes('rule34')) {
        const matches = [...String(response?.data || '').matchAll(/<post[^>]*file_url="([^"]+)"[^>]*>/gim)];
        for (const match of matches) {
          results.push({
            title: sanitizeText(term, 140),
            description: sanitizeText(term, 220),
            url: match[1],
            thumbnail: match[1]
          });
        }
      } else {
        const html = String(response?.data || '');
        const matches = [...html.matchAll(/<img[^>]+(?:data-src|src)=['"]([^'"]+)['"][^>]*>/gim)];
        for (const match of matches) {
          if (!isPlaceholderImage(match[1])) {
            results.push({
              title: sanitizeText(term, 140),
              description: sanitizeText(term, 220),
              url: match[1],
              thumbnail: match[1]
            });
          }
        }
      }
    } catch (error) {
      logger.warn('explicit image provider failed', { error: error.message });
    }
  }

  return results.filter(item => item.url && !isPlaceholderImage(item.url));
}

async function searchImages(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { items: [], source: 'image-provider' };
  }

  const items = [];
  try {
    const ddgItems = await searchDuckDuckGoImages(term, context);
    items.push(...ddgItems);
  } catch (error) {
    logger.warn('duckduckgo image search failed', { error: error.message });
  }

  try {
    const serpItems = await searchSerpApiImages(term, context);
    items.push(...serpItems);
  } catch (error) {
    logger.warn('serpapi image search failed', { error: error.message });
  }

  if (isExplicitQuery(term)) {
    try {
      const explicitItems = await searchExplicitImages(term, context);
      items.push(...explicitItems);
    } catch (error) {
      logger.warn('explicit image fallback failed', { error: error.message });
    }
  }

  const ranked = rankResults(term, items, 'image').slice(0, 8);
  return { items: ranked, source: 'image-provider' };
}

module.exports = {
  searchImages
};
