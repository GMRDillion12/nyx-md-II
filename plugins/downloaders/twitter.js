const axios = require('axios');
const { twitter } = require('@bochilteam/scraper-twitter');

const AXIOS_DEFAULTS = {
    timeout: 12000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
};

async function tryRequest(getter, attempts = 2, delay = 700) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (i < attempts) await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

function normalizeTweetUrl(text) {
    if (!text || typeof text !== 'string') return null;
    const urlMatch = text.match(/https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[^\s]+/i);
    if (urlMatch) {
        const url = urlMatch[0];
        const statusMatch = url.match(/status\/(\d+)/i);
        if (statusMatch) {
            return url;
        }
    }

    const idOnly = text.match(/(\d{5,})/);
    if (idOnly) {
        return `https://twitter.com/i/status/${idOnly[1]}`;
    }
    return null;
}

function getTweetId(url) {
    if (!url) return null;
    const match = url.match(/status\/(\d+)/i);
    return match ? match[1] : null;
}

module.exports = {
    command: ['x'],
    category: 'downloaders',
    description: 'Download Twitter/X video from a tweet URL',
    usage: '.x <x/tweet link>',

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;

        let input = args.join(' ').trim();
        if (!input) {
            const ctx = m.message?.extendedTextMessage?.contextInfo;
            if (ctx?.quotedMessage) {
                input = ctx.quotedMessage.conversation || ctx.quotedMessage.extendedTextMessage?.text || input;
            }
            if (!input && m.message) {
                input = m.text || m.body || m.message.conversation || input;
            }
        }

        const tweetUrl = normalizeTweetUrl(input || '');
        if (!tweetUrl) {
            return sock.sendMessage(chat, {
                text: '❌ Please provide a valid Twitter / X tweet URL containing a video.\n\nExample: `.tweet https://twitter.com/user/status/1234567890123456789`'
            }, { quoted: m });
        }

        const loading = await sock.sendMessage(chat, {
            text: `⏳ Fetching Twitter/X video from the link...`
        }, { quoted: m });

        try {
            const variants = await tryRequest(() => twitter(tweetUrl), 2, 1200);
            if (!Array.isArray(variants) || variants.length === 0) {
                throw new Error('No video variants found.');
            }

            const mp4Variants = variants
                .filter(item => item?.content_type?.includes('video/mp4') && item.url)
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

            if (mp4Variants.length === 0) {
                throw new Error('No MP4 video variant available.');
            }

            const bestVariant = mp4Variants[0];
            const downloadUrl = bestVariant.url;
            const tweetId = getTweetId(tweetUrl) || 'twitter-video';
            const fileName = `twitter-${tweetId}.mp4`;

            const videoResponse = await tryRequest(() => axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxRedirects: 3,
                ...AXIOS_DEFAULTS
            }), 2, 1000);

            const videoBuffer = Buffer.from(videoResponse.data);
            if (!videoBuffer || videoBuffer.length === 0) {
                throw new Error('Downloaded video is empty.');
            }

            await sock.sendMessage(chat, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                fileName,
                caption: `✅ Twitter/X video downloaded successfully!`
            }, { quoted: m });

            await sock.sendMessage(chat, {
                text: `✅ Download complete for tweet: ${tweetUrl}`,
                edit: loading.key
            });

            await sock.sendMessage(chat, {
                react: { text: '✅', key: m.key }
            });
        } catch (error) {
            console.error('[twitter] download error:', error?.message || error);
            await sock.sendMessage(chat, {
                text: `❌ Failed to download Twitter/X video.\n${error?.message || 'Please try again later.'}`,
                edit: loading.key
            });
        }
    }
};
