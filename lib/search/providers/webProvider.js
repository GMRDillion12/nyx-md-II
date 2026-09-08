const { requestJson, normalizeQuery, sanitizeText, createLogger, createRateLimiter } = require('../utils');
const { rankResults } = require('../ranking');

const logger = createLogger('search-web-provider');

async function searchWeb(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { items: [], source: 'web-provider' };
  }

  const apiKey = context.config?.search?.serpApiKey || context.serpApiKey || '';
  if (apiKey) {
    try {
      const response = await requestJson('https://serpapi.com/search.json', {
        timeout: Number(context.timeout || 15000),
        retries: Number(context.retries || 1),
        rateLimiter: context.rateLimiter || createRateLimiter(4, 1000),
        params: {
          engine: 'google',
          q: term,
          api_key: apiKey,
          num: 5
        }
      });

      const results = Array.isArray(response?.data?.organic_results) ? response.data.organic_results : [];
      const items = results
        .filter(item => item?.link)
        .map(item => ({
          title: sanitizeText(item.title || term, 140),
          description: sanitizeText(item.snippet || item.title || term, 260),
          url: item.link,
          snippet: sanitizeText(item.snippet || item.title || '', 260)
        }));

      if (items.length) {
        const unique = [...new Map(items.map(item => [item.url, item])).values()];
        return { items: rankResults(term, unique, 'general').slice(0, 10), source: 'serpapi' };
      }
    } catch (error) {
      logger.warn('serpapi web search failed', { error: error.message });
    }
  }

  try {
    const response = await requestJson(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(term)}`, {
      timeout: Number(context.timeout || 15000),
      retries: Number(context.retries || 1),
      rateLimiter: context.rateLimiter || createRateLimiter(4, 1000),
      headers: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = String(response?.data || '');
    const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gim)];
    const items = [];

    for (const match of matches) {
      const href = String(match[1] || '');
      const title = String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!href || !title) continue;

      let url = href;
      if (/uddg=/.test(url)) {
        url = decodeURIComponent(url).replace(/^.*?uddg=/i, '').replace(/&rut=.*$/i, '');
      }
      if (!/^https?:\/\//i.test(url)) continue;

      items.push({
        title: sanitizeText(title, 140),
        description: sanitizeText(title, 260),
        url,
        snippet: sanitizeText(title, 260)
      });
    }

    const unique = [...new Map(items.map(item => [item.url, item])).values()];
    return { items: rankResults(term, unique, 'general').slice(0, 10), source: 'duckduckgo' };
  } catch (error) {
    logger.warn('web search failed', { error: error.message });
    return { items: [], source: 'web-provider' };
  }
}

module.exports = {
  searchWeb
};
