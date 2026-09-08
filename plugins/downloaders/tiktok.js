const axios = require('axios');

const AXIOS_DEFAULTS = {
    timeout: 12000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
};

const providerCache = new Map();

async function tryRequest(getter, attempts = 2, delay = 700) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (i < attempts) await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}

// Multiple API methods for TikTok downloads
async function getTiklydownVideoByUrl(url) {
    const res = await axios.get(`https://api.tiklydown.com/v1/download?url=${encodeURIComponent(url)}`, {
        ...AXIOS_DEFAULTS,
        timeout: 25000
    });
    if (res?.data?.success && res.data.data?.play) {
        return { download: res.data.data.play, title: res.data.data.description || 'TikTok Video' };
    }
    throw new Error('Tiklydown failed');
}

async function getTiktokdVideoByUrl(url) {
    const res = await axios.get(`https://api.tiktokd.com/api/download?url=${encodeURIComponent(url)}`, {
        ...AXIOS_DEFAULTS,
        timeout: 25000
    });
    if (res?.data?.data?.video) {
        return { download: res.data.data.video, title: res.data.data.title || 'TikTok Video' };
    }
    throw new Error('Tiktokd failed');
}

async function getSnaptikVideoByUrl(url) {
    const res = await axios.get(`https://snaptik.app/api/download?url=${encodeURIComponent(url)}`, {
        ...AXIOS_DEFAULTS,
        timeout: 25000
    });
    if (res?.data?.result?.download) {
        return { download: res.data.result.download, title: res.data.result.title || 'TikTok Video' };
    }
    throw new Error('Snaptik failed');
}

async function getTikwmVideoByUrl(url) {
    const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
        ...AXIOS_DEFAULTS,
        timeout: 25000
    });
    if (res?.data?.data?.play) {
        return { download: res.data.data.play, title: res.data.data.desc || 'TikTok Video' };
    }
    throw new Error('Tikwm failed');
}

module.exports = {
    command: ['ttk'],
    category: 'downloaders',
    description: 'Download TikTok video in HD',
    usage: '.tiktok <TikTok URL>',

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;

        // Get URL from args or quoted message
        let url = args.join(' ').trim();
        if (!url) {
            const ctx = m.message?.extendedTextMessage?.contextInfo;
            if (ctx?.quotedMessage) {
                const qm = ctx.quotedMessage.conversation || ctx.quotedMessage.extendedTextMessage?.text || '';
                url = qm || url;
            }
            if (!url && m.message) {
                const body = m.text || m.body || m.message.conversation || '';
                url = body || url;
            }
        }

        // Validate TikTok URL
        if (!url || !/tiktok\.com|vt\.tiktok|vm\.tiktok|vp\.tiktok/.test(url)) {
            return sock.sendMessage(chat, {
                text: '❌ Please provide a valid TikTok URL.\n\nExample: `.tiktok https://www.tiktok.com/@user/video/123456789`'
            }, { quoted: m });
        }

        const loading = await sock.sendMessage(chat, { text: '⏳ Downloading TikTok video, please wait...' }, { quoted: m });

        try {
            // Try the fastest providers first and cache successful URLs.
            let videoData = null;
            const apiMethods = [
                { name: 'Tikwm', method: () => getTikwmVideoByUrl(url) },
                { name: 'Tiklydown', method: () => getTiklydownVideoByUrl(url) },
                { name: 'Tiktokd', method: () => getTiktokdVideoByUrl(url) },
                { name: 'Snaptik', method: () => getSnaptikVideoByUrl(url) }
            ];

            for (const apiMethod of apiMethods) {
                try {
                    console.log(`[tiktok] Trying ${apiMethod.name}...`);
                    videoData = await tryRequest(apiMethod.method, 2, 1500);
                    if (videoData?.download) {
                        console.log(`[tiktok] ${apiMethod.name} succeeded!`);
                        break;
                    }
                } catch (err) {
                    console.log(`[tiktok] ${apiMethod.name} failed: ${err.message}`);
                    continue;
                }
            }

            if (!videoData?.download) {
                throw new Error('All download sources failed');
            }

            // Download video buffer
            console.log(`[tiktok] Downloading from: ${videoData.download}`);
            const videoRes = await axios.get(videoData.download, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxRedirects: 3,
                ...AXIOS_DEFAULTS
            });

            const buffer = Buffer.from(videoRes.data);
            if (!buffer || buffer.length === 0) {
                throw new Error('Empty video buffer');
            }

            const title = videoData.title || 'TikTok Video';

            // Send video
            await sock.sendMessage(chat, {
                video: buffer,
                mimetype: 'video/mp4',
                fileName: `${title}.mp4`,
                caption: `*${title}*\n\n📥 Downloaded with Nyx-MD`
            }, { quoted: m });

            // Update status
            await sock.sendMessage(chat, {
                text: `✅ *${title}*\n\n🎉 Video downloaded successfully!`,
                edit: loading.key
            });

            // React
            await sock.sendMessage(chat, {
                react: { text: '✅', key: m.key }
            });

        } catch (error) {
            console.error('[tiktok] error:', error?.message || error);
            await sock.sendMessage(chat, {
                text: `❌ Failed to download TikTok video.\n\nError: ${error?.message || 'Unknown error'}\n\nPlease try again later or check if the URL is valid.`,
                edit: loading.key
            });
        }
    }
};
