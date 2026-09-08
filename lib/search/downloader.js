const axios = require('axios');
const { DEFAULT_TIMEOUT, DEFAULT_MAX_BYTES, DEFAULT_UA, isValidHttpUrl, createLogger } = require('./utils');

const logger = createLogger('search-downloader');

async function downloadMedia(url, options = {}) {
  if (!isValidHttpUrl(url)) {
    throw new Error('Invalid media URL');
  }

  const timeout = Number(options.timeout || DEFAULT_TIMEOUT);
  const maxBytes = Number(options.maxBytes || DEFAULT_MAX_BYTES);
  const retries = Number(options.retries || 3);
  const headers = {
    'User-Agent': DEFAULT_UA,
    Referer: 'https://www.google.com/',
    ...(options.headers || {})
  };

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      logger.debug('downloading media', { attempt: attempt + 1, url });
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout,
        maxRedirects: 10,
        headers,
        validateStatus: () => true
      });

      if (response.status < 200 || response.status >= 400) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const contentType = String(response.headers['content-type'] || 'application/octet-stream').toLowerCase();
      if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        throw new Error(`Blocked HTML response: ${contentType}`);
      }

      if (!/^(image|video|audio|application\/octet-stream)/i.test(contentType)) {
        throw new Error(`Unsupported media type: ${contentType}`);
      }

      const buffer = Buffer.from(response.data || []);
      if (!buffer.length) {
        throw new Error('Downloaded payload is empty');
      }

      if (buffer.length > maxBytes) {
        throw new Error(`Download exceeds size limit: ${buffer.length} bytes`);
      }

      logger.debug('download accepted', { size: buffer.length, contentType, url });
      return {
        buffer,
        mimetype: contentType,
        size: buffer.length,
        finalUrl: response.request?.res?.responseUrl || url
      };
    } catch (error) {
      lastError = error;
      logger.warn('download attempt failed', { attempt: attempt + 1, url, error: error.message });
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Download failed');
}

module.exports = {
  downloadMedia
};
