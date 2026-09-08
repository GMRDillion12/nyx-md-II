const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

const defaultApiHeaders = {
    'User-Agent': 'NyxMD Bot (https://github.com/nyx-md)',
    Accept: 'application/json'
};

const apiCandidates = [
    {
        name: 'nekos.best search',
        url: action => `https://nekos.best/api/v2/search?query=${encodeURIComponent('anime ' + action)}&type=2&category=${encodeURIComponent(action)}&amount=1`,
        headers: {
            'User-Agent': 'NyxMD Bot (https://github.com/nyx-md)'
        }
    },
    {
        name: 'nekos.best direct',
        url: action => `https://nekos.best/api/v2/${action}`,
        headers: {
            'User-Agent': 'NyxMD Bot (https://github.com/nyx-md)'
        }
    },
    {
        name: 'waifu.pics',
        url: action => `https://api.waifu.pics/sfw/${action}`
    },
    {
        name: 'purrbot sfw gif',
        url: action => `https://api.purrbot.site/v2/img/sfw/${action}/gif`
    },
    {
        name: 'nekos.life',
        url: action => `https://nekos.life/api/v2/img/${action}`
    }
];

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('//')) return `https:${url}`;
    return url;
}

function parseResponseUrl(data) {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.url === 'string') return data.url;
    if (typeof data.link === 'string') return data.link;
    if (typeof data.file === 'string') return data.file;
    if (typeof data.image === 'string') return data.image;
    if (typeof data.response === 'string') return data.response;
    if (typeof data.result === 'string') return data.result;
    if (Array.isArray(data) && typeof data[0]?.url === 'string') return data[0].url;
    if (Array.isArray(data) && typeof data[0]?.link === 'string') return data[0].link;
    if (data?.results && Array.isArray(data.results) && typeof data.results[0]?.url === 'string') return data.results[0].url;
    if (data?.results && Array.isArray(data.results) && typeof data.results[0]?.link === 'string') return data.results[0].link;
    if (data?.data && typeof data.data.url === 'string') return data.data.url;
    return null;
}

function getTempPath(prefix, ext) {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    return path.join(os.tmpdir(), `${prefix}-${unique}.${ext}`);
}

async function convertGifToMp4(buffer) {
    const inputPath = getTempPath('nyx-gif', 'gif');
    const outputPath = getTempPath('nyx-gif', 'mp4');

    fs.writeFileSync(inputPath, buffer);

    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-movflags', 'faststart',
                '-pix_fmt', 'yuv420p',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
            ])
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });

    const mp4Buffer = fs.readFileSync(outputPath);

    try {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
    } catch {}

    return mp4Buffer;
}

function clearGifCache(action) {
    const key = (action || '').toLowerCase();
    if (!key) return false;
    return cache.delete(key);
}

function clearAllGifCache() {
    cache.clear();
    return true;
}

const actionAliases = {
    kill: 'punch',
    sad: 'cry'
};

async function fetchGif(action) {
    const actualAction = (action || '').toLowerCase();
    const remappedAction = actionAliases[actualAction] || actualAction;
    const key = remappedAction;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.value;
    }

    const errors = [];

    for (const candidate of apiCandidates) {
        const apiUrl = candidate.url(remappedAction);

        try {
            const apiRes = await axios.get(apiUrl, {
                timeout: 20000,
                headers: {
                    ...defaultApiHeaders,
                    ...(candidate.headers || {})
                }
            });

            let mediaUrl = normalizeUrl(parseResponseUrl(apiRes.data));
            if (!mediaUrl && candidate.name === 'nekos.best search' && Array.isArray(apiRes.data.results) && apiRes.data.results[0]) {
                mediaUrl = normalizeUrl(apiRes.data.results[0].url);
            }

            if (!mediaUrl) {
                errors.push({ apiUrl, status: apiRes.status, reason: 'missing media url' });
                continue;
            }

            const mediaHeaders = {
                'User-Agent': (candidate.headers && candidate.headers['User-Agent']) || defaultApiHeaders['User-Agent'] || 'Mozilla/5.0 (WhatsAppBot)',
                Accept: 'image/*,*/*;q=0.8'
            };
            if (candidate.name && candidate.name.includes('nekos.best')) {
                mediaHeaders.Referer = 'https://nekos.best/';
            }

            const mediaRes = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: mediaHeaders
            });

            const contentType = mediaRes.headers['content-type'] || 'application/octet-stream';
            const buffer = Buffer.from(mediaRes.data);
            if (!buffer.length) {
                errors.push({ apiUrl, mediaUrl, reason: 'empty buffer' });
                continue;
            }

            const isGif = contentType.includes('gif') || mediaUrl.toLowerCase().includes('.gif');
            let outputBuffer = buffer;
            let mimetype = contentType;
            let mediaType = 'image';

            if (isGif) {
                try {
                    outputBuffer = await convertGifToMp4(buffer);
                    mimetype = 'video/mp4';
                    mediaType = 'video';
                } catch (convErr) {
                    outputBuffer = buffer;
                    mimetype = 'image/gif';
                    mediaType = 'image';
                }
            }

            const value = { buffer: outputBuffer, mimetype, mediaType, source: mediaUrl };
            cache.set(key, { timestamp: Date.now(), value });
            return value;
        } catch (err) {
            const status = err.response?.status;
            const message = err.message || 'unknown error';
            errors.push({ apiUrl, status, message });
        }
    }

    const message = errors.map(err => `${err.apiUrl} -> ${err.status || 'ERR'} ${err.message || err.reason}`).join(' | ');
    throw new Error(`fetchGif failed for ${action}: ${message}`);
}

module.exports = { fetchGif, clearGifCache, clearAllGifCache };
