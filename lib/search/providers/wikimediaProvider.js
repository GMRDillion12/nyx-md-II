const { requestJson, normalizeQuery, sanitizeText, createLogger } = require('../utils');

const logger = createLogger('search-wikimedia-provider');

async function searchWikimediaImages(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { items: [], source: 'Wikimedia Commons' };
  }

  const apiUrl = context.config?.images?.wikimediaApiUrl || 'https://commons.wikimedia.org/w/api.php';
  try {
    const response = await requestJson(apiUrl, {
      params: {
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: term,
        gsrlimit: 12,
        prop: 'imageinfo|pageimages|info|description',
        piprop: 'thumbnail',
        pithumbsize: 640,
        iiprop: 'url|mime|size|extmetadata',
        iiurlwidth: 1200,
        inprop: 'url',
        formatversion: 2,
        redirects: 1
      },
      timeout: Number(context.timeout || 15000),
      retries: Number(context.retries || 1)
    });

    const pages = response?.data?.query?.pages || [];
    const items = [];

    for (const page of pages) {
      // Prefer imageinfo when present, otherwise fall back to page.thumbnail
      const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
      const thumb = page.thumbnail || null;
      let imageUrl = imageInfo?.url || thumb?.source || null;
      const mime = imageInfo?.mime || '';

      if (!imageUrl) continue;

      // If imageinfo exists, use its extmetadata for richer attribution
      const ext = imageInfo?.extmetadata || {};
      const creator = sanitizeText(ext.Artist?.value || ext.Credit?.value || '', 80) || '';
      const license = sanitizeText(ext.LicenseShortName?.value || ext.License?.value || '', 80) || '';
      const licenseUrl = ext.LicenseUrl?.value || '';
      const description = sanitizeText(page.description || ext.ImageDescription?.value || '', 260) || '';

      items.push({
        title: sanitizeText(page.title || term, 140),
        imageUrl,
        thumbnailUrl: thumb?.source || imageUrl,
        pageUrl: page.fullurl || '',
        width: Number(imageInfo?.width || thumb?.width || 0),
        height: Number(imageInfo?.height || thumb?.height || 0),
        creator,
        license,
        licenseUrl,
        description,
        source: 'Wikimedia Commons'
      });
    }

    return { items, source: 'Wikimedia Commons' };
  } catch (error) {
    logger.warn('wikimedia search failed', { error: error.message });
    return { items: [], source: 'Wikimedia Commons' };
  }
}

module.exports = {
  searchWikimediaImages
};
