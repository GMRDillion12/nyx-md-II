const yts = require('yt-search');
const { normalizeQuery, createLogger } = require('../utils');
const { rankResults } = require('../ranking');

const logger = createLogger('search-video-provider');

async function searchVideos(query, context = {}) {
  const term = normalizeQuery(query);
  if (!term) {
    return { items: [], source: 'video-provider' };
  }

  try {
    const results = await yts(term);
    const videos = Array.isArray(results?.videos) ? results.videos : [];
    const items = videos.slice(0, 6).map(video => ({
      title: video.title || term,
      description: video.description || video.title || term,
      duration: video.duration || null,
      thumbnail: video.thumbnail,
      url: video.url,
      width: 1280,
      height: 720
    }));
    return { items: rankResults(term, items, 'video').slice(0, 6), source: 'video-provider' };
  } catch (error) {
    logger.warn('youtube search failed', { error: error.message });
    return { items: [], source: 'video-provider' };
  }
}

module.exports = {
  searchVideos
};
