const { requestJson, normalizeQuery, createLogger } = require('../utils');
const { rankResults } = require('../ranking');

const logger = createLogger('search-gif-provider');

async function searchGifs(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { items: [], source: 'gif-provider' };
  }

  const apiKey = context.config?.tenorApiKey || context.tenorApiKey || '';
  if (!apiKey) {
    return { items: [], source: 'gif-provider' };
  }

  try {
    const response = await requestJson('https://tenor.googleapis.com/v2/search', {
      timeout: Number(context.timeout || 15000),
      retries: Number(context.retries || 1),
      params: {
        q: term,
        key: apiKey,
        client_key: 'nyx-md',
        media_filter: 'minimal',
        limit: 6
      }
    });

    const results = Array.isArray(response?.data?.results) ? response.data.results : [];
    const items = results.map(result => {
      const gif = result?.media_formats?.gif || result?.media?.[0]?.gif || null;
      const mp4 = result?.media_formats?.mp4 || result?.media?.[0]?.mp4 || null;
      return {
        title: result?.content_description || term,
        description: result?.content_description || term,
        width: gif?.dims?.[0] || 0,
        height: gif?.dims?.[1] || 0,
        url: mp4?.url || gif?.url || '',
        thumbnail: gif?.preview || gif?.url || '',
        mimeType: mp4 ? 'video/mp4' : 'image/gif'
      };
    }).filter(item => item.url);

    return { items: rankResults(term, items, 'gif').slice(0, 6), source: 'gif-provider' };
  } catch (error) {
    logger.warn('tenor search failed', { error: error.message });
    return { items: [], source: 'gif-provider' };
  }
}

module.exports = {
  searchGifs
};
