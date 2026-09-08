const { requestJson, normalizeQuery, sanitizeText, createLogger } = require('../utils');

const logger = createLogger('search-openverse-provider');

async function searchOpenverseImages(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { items: [], source: 'Openverse' };
  }

  try {
    const response = await requestJson('https://api.openverse.engineering/v1/images', {
      params: {
        search: term,
        page_size: 10
      },
      timeout: Number(context.timeout || 15000),
      retries: Number(context.retries || 1),
      headers: context.config?.images?.openverseApiKey ? {
        Authorization: `Bearer ${context.config.images.openverseApiKey}`
      } : undefined
    });

    const results = Array.isArray(response?.data?.results) ? response.data.results : [];
    const items = results.map(item => ({
      title: sanitizeText(item.title || term, 140),
      imageUrl: item.url || '',
      thumbnailUrl: item.thumbnail || item.url || '',
      pageUrl: item.source_url || item.url || '',
      width: Number(item.width || 0),
      height: Number(item.height || 0),
      creator: sanitizeText(item.creator || item.creator_name || '', 80),
      license: sanitizeText(item.license || '', 80),
      licenseUrl: item.license_url || '',
      description: sanitizeText(item.description || item.title || term, 260),
      source: 'Openverse'
    })).filter(item => item.imageUrl);

    return { items, source: 'Openverse' };
  } catch (error) {
    logger.warn('openverse search failed', { error: error.message });
    return { items: [], source: 'Openverse' };
  }
}

module.exports = {
  searchOpenverseImages
};
