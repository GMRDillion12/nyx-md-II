const axios = require('axios');

const DEFAULT_TIMEOUT = 20000;
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DEFAULT_MAX_BYTES = 12 * 1024 * 1024;

function normalizeQuery(query) {
  return String(query || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTimeSensitiveQuery(query) {
  const normalized = normalizeQuery(query).toLowerCase();
  return /\b(latest|today|yesterday|current|currently|recent|news|score|result|happened|update|updates|breaking|live)\b/i.test(normalized);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function isValidHttpUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /^https?:$/i.test(parsed.protocol);
  } catch (_) {
    return false;
  }
}

function isPlaceholderImage(url) {
  if (!isValidHttpUrl(url)) return true;
  const value = String(url).toLowerCase();
  return /(^|\.)bing\.com|facebook_sharing_|placeholder|spacer|blank|logo|icon|favicon|sprite|source\.unsplash\.com/i.test(value);
}

function sanitizeText(text, maxLength = 320) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (_error) {
    return '';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function similarity(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function createRateLimiter(limit, intervalMs) {
  const timestamps = [];
  return function allow() {
    const now = Date.now();
    while (timestamps.length && timestamps[0] <= now - intervalMs) {
      timestamps.shift();
    }
    if (timestamps.length >= limit) {
      return false;
    }
    timestamps.push(now);
    return true;
  };
}

async function requestJson(url, options = {}) {
  const retries = Number(options.retries || 0);
  const timeout = Number(options.timeout || DEFAULT_TIMEOUT);
  const headers = {
    'User-Agent': DEFAULT_UA,
    ...(options.headers || {})
  };
  const limiter = options.rateLimiter;

  if (limiter && typeof limiter === 'function' && !limiter()) {
    throw new Error('Rate limit exceeded');
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await axios.get(url, {
        ...options,
        timeout,
        validateStatus: () => true,
        headers,
        params: options.params
      });
      if (response.status >= 200 && response.status < 400) {
        return response;
      }
      throw new Error(`Request failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error(`Request to ${url} failed`);
}

function createLogger(prefix) {
  return {
    debug(message, meta) {
      if (process.env.NODE_ENV === 'test') return;
      console.debug(`[${prefix}] ${message}`, meta || '');
    },
    info(message, meta) {
      if (process.env.NODE_ENV === 'test') return;
      console.info(`[${prefix}] ${message}`, meta || '');
    },
    warn(message, meta) {
      if (process.env.NODE_ENV === 'test') return;
      console.warn(`[${prefix}] ${message}`, meta || '');
    },
    error(message, meta) {
      if (process.env.NODE_ENV === 'test') return;
      console.error(`[${prefix}] ${message}`, meta || '');
    }
  };
}

module.exports = {
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_BYTES,
  DEFAULT_UA,
  normalizeQuery,
  tokenize,
  isValidHttpUrl,
  isPlaceholderImage,
  sanitizeText,
  extractDomain,
  similarity,
  sleep,
  requestJson,
  createRateLimiter,
  createLogger,
  isTimeSensitiveQuery
};
