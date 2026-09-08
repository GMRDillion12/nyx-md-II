const { requestJson, normalizeQuery, sanitizeText, createLogger } = require('../utils');

const logger = createLogger('search-flickr-provider');
const LICENSE_MAP = {
  '0': 'All Rights Reserved',
  '1': 'CC BY-NC-SA 2.0',
  '2': 'CC BY-NC 2.0',
  '3': 'CC BY-NC-ND 2.0',
  '4': 'CC BY 2.0',
  '5': 'CC BY-SA 2.0',
  '6': 'CC BY-ND 2.0',
  '7': 'No known copyright restrictions',
  '8': 'United States government work',
  '9': 'Public Domain Dedication (CC0)',
  '10': 'Public Domain Mark'
};

async function searchFlickrImages(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { items: [], source: 'Flickr' };
  }

  const apiKey = context.config?.images?.flickrApiKey;
  if (!apiKey) {
    logger.warn('flickr api key is not configured');
    return { items: [], source: 'Flickr' };
  }

  try {
    const response = await requestJson('https://www.flickr.com/services/rest/', {
      params: {
        method: 'flickr.photos.search',
        api_key: apiKey,
        text: term,
        sort: 'relevance',
        media: 'photos',
        per_page: 10,
        extras: 'owner_name,date_taken,license,url_o,url_l,url_c,url_m,url_s,description',
        format: 'json',
        nojsoncallback: 1
      },
      timeout: Number(context.timeout || 15000),
      retries: Number(context.retries || 1)
    });

    const photos = response?.data?.photos?.photo || [];
    const items = photos.map(photo => {
      const imageUrl = photo.url_o || photo.url_l || photo.url_c || photo.url_m || photo.url_s || '';
      if (!imageUrl) return null;

      return {
        title: sanitizeText(photo.title || term, 140),
        imageUrl,
        thumbnailUrl: photo.url_s || imageUrl,
        pageUrl: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`,
        width: Number(photo.width_o || photo.width_l || photo.width_c || photo.width_m || 0),
        height: Number(photo.height_o || photo.height_l || photo.height_c || photo.height_m || 0),
        creator: sanitizeText(photo.ownername || '', 80),
        license: sanitizeText(LICENSE_MAP[String(photo.license)] || `Flickr license ${photo.license}`, 80),
        licenseUrl: '',
        description: sanitizeText(photo.description?._content || term, 260),
        dateTaken: photo.datetaken || '',
        source: 'Flickr'
      };
    }).filter(Boolean);

    return { items, source: 'Flickr' };
  } catch (error) {
    logger.warn('flickr search failed', { error: error.message });
    return { items: [], source: 'Flickr' };
  }
}

module.exports = {
  searchFlickrImages
};
