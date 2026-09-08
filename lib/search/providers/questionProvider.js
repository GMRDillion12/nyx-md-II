const { requestJson, normalizeQuery, sanitizeText, createLogger } = require('../utils');

const logger = createLogger('search-question-provider');

async function searchQuestion(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { item: null, source: 'question-provider' };
  }

  try {
    const response = await requestJson(`https://api.duckduckgo.com/?q=${encodeURIComponent(term)}&format=json&no_redirect=1&no_html=1`, {
      timeout: Number(context.timeout || 12000),
      retries: Number(context.retries || 1)
    });

    const data = response?.data || {};
    const answer = [data.Answer, data.AbstractText].find(text => typeof text === 'string' && text.trim());
    const related = Array.isArray(data.RelatedTopics) ? data.RelatedTopics.find(topic => topic?.Text) : null;
    const text = answer || related?.Text || null;

    if (text) {
      return {
        item: {
          title: sanitizeText(term, 140),
          description: sanitizeText(text, 320),
          url: `https://duckduckgo.com/?q=${encodeURIComponent(term)}&ia=about`,
          answer: sanitizeText(text, 320)
        },
        source: 'duckduckgo'
      };
    }
  } catch (error) {
    logger.warn('duckduckgo instant answer failed', { error: error.message });
  }

  try {
    const wikipediaResponse = await requestJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(term), {
      timeout: Number(context.timeout || 12000),
      retries: Number(context.retries || 1)
    });
    const page = wikipediaResponse?.data || {};
    if (page.extract) {
      return {
        item: {
          title: sanitizeText(page.title || term, 140),
          description: sanitizeText(page.extract, 320),
          url: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(term)}`,
          answer: sanitizeText(page.extract, 320)
        },
        source: 'wikipedia'
      };
    }
  } catch (error) {
    logger.warn('wikipedia fallback failed', { error: error.message });
  }

  return { item: null, source: 'question-provider' };
}

module.exports = {
  searchQuestion
};
