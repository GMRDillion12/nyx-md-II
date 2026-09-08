const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

const apiCandidates = [
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

async function fetchGif(action) {
    const key = (action || '').toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.value;
    }

    const errors = [];

    for (const candidate of apiCandidates) {
        const apiUrl = candidate.url(action);

        try {
            const apiRes = await axios.get(apiUrl, {
                timeout: 5000,
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (WhatsAppBot)',
                    Accept: 'application/json'
                }
            });

            let mediaUrl = null;
            if (typeof apiRes?.data === 'string') {
                mediaUrl = normalizeUrl(apiRes.data);
            } else {
                mediaUrl = normalizeUrl(parseResponseUrl(apiRes.data));
            }

            if (!mediaUrl) {
                errors.push({ apiUrl, status: apiRes.status, reason: 'missing media url' });
                continue;
            }

            const mediaRes = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (WhatsAppBot)'
                }
            });

            const contentType = mediaRes.headers['content-type'] || 'application/octet-stream';
            const buffer = Buffer.from(mediaRes.data);
            if (!buffer.length) {
                errors.push({ apiUrl, mediaUrl, reason: 'empty buffer' });
                continue;
            }

            const isGif = mediaUrl.toLowerCase().endsWith('.gif') || contentType.includes('gif');
            let outputBuffer = buffer;
            let mimetype = contentType;

            if (isGif) {
                try {
                    outputBuffer = await convertGifToMp4(buffer);
                    mimetype = 'video/mp4';
                } catch (convErr) {
                    outputBuffer = buffer;
                    mimetype = 'image/gif';
                }
            }

            const value = { buffer: outputBuffer, mimetype, mediaType: 'video', source: mediaUrl };
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

module.exports = { fetchGif };
