const yts = require('yt-search');
const axios = require('axios');
const { toAudio } = require("../../lib/converter");

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
            if (i < attempts) await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}

// Multiple API fallbacks for reliability
async function getEliteProTechAudioByUrl(url) {
    const res = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`, {
        ...AXIOS_DEFAULTS,
        timeout: 25000
    });
    if (res?.data?.success && res.data.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title };
    }
    throw new Error('EliteProTech failed');
}

async function getYupraAudioByUrl(url) {
    const res = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`, {
        ...AXIOS_DEFAULTS,
        timeout: 25000
    });
    if (res?.data?.result?.downloadUrl) {
        return { download: res.data.result.downloadUrl, title: res.data.result.title };
    }
    throw new Error('Yupra failed');
}

async function getOkatsuAudioByUrl(url) {
    const res = await axios.get(`https://okatsu-apis.onrender.com/api/ytmp3?url=${encodeURIComponent(url)}`, {
        ...AXIOS_DEFAULTS,
        timeout: 25000
    });
    if (res?.data?.download) {
        return { download: res.data.download, title: res.data.title || res.data.name };
    }
    throw new Error('Okatsu failed');
}

module.exports = {
    command: ["ytmp3"],
    category: "downloaders",
    description: "Download YouTube audio as MP3",

    async execute(sock, m, args, config) {
        const query = args.join(" ").trim();
        if (!query) {
            return sock.sendMessage(m.chat, {
                text: "❌ What song do you want?\nExample: `.ytmp3 never be alone`"
            }, { quoted: m });
        }

        const loading = await sock.sendMessage(m.chat, {
            text: "🔍 Searching YouTube..."
        }, { quoted: m });

        try {
            // Handle direct YouTube URLs
            let video;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                video = { url: query, title: query };
            } else {
                const search = await yts(query);
                if (!search?.videos?.length) {
                    return sock.sendMessage(m.chat, { text: "❌ No results found.", edit: loading.key });
                }
                video = search.videos[0];
            }

            // Rich preview card
            await sock.sendMessage(m.chat, {
                image: { url: video.thumbnail },
                caption: `🎵 *${video.title}*\n` +
                         `👤 Artist: ${video.author?.name || "Unknown"}\n` +
                         `⏳ Duration: ${video.timestamp}\n` +
                         `🔄 Loading audio...`,
                mimetype: "image/jpeg"
            }, { quoted: m });

            // Try multiple APIs with fallback
            let audioData = null;
            const apiMethods = [
                { name: 'EliteProTech', method: () => getEliteProTechAudioByUrl(video.url) },
                { name: 'Yupra', method: () => getYupraAudioByUrl(video.url) },
                { name: 'Okatsu', method: () => getOkatsuAudioByUrl(video.url) }
            ];

            for (const apiMethod of apiMethods) {
                try {
                    console.log(`Trying ${apiMethod.name}...`);
                    audioData = await tryRequest(apiMethod.method, 2, 1500);
                    if (audioData?.download) {
                        console.log(`${apiMethod.name} succeeded!`);
                        break;
                    }
                } catch (err) {
                    console.log(`${apiMethod.name} failed: ${err.message}`);
                    continue;
                }
            }

            if (!audioData?.download) {
                throw new Error('All download sources failed');
            }

            // Download audio buffer
            console.log(`Downloading from: ${audioData.download}`);
            const audioRes = await axios.get(audioData.download, { 
                responseType: 'arraybuffer',
                timeout: 60000,
                maxRedirects: 3,
                ...AXIOS_DEFAULTS
            });
            
            let buffer = Buffer.from(audioRes.data);
            
            if (!buffer || buffer.length === 0) {
                throw new Error('Empty audio buffer');
            }

            // Convert to WhatsApp playable format
            try {
                buffer = await toAudio(buffer, 'mp3');
            } catch (convErr) {
                console.error('Conversion error:', convErr);
                // If conversion fails, try sending as-is (some formats work)
            }

            const title = audioData.title || video.title;

            // Send as proper music card with audio
            await sock.sendMessage(m.chat, {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: `${title}.mp3`
            }, { quoted: m });

            // Send completion message
            await sock.sendMessage(m.chat, {
                text: `✅ *${title}*\n\n📥 Downloaded with Nyx-MD`,
                edit: loading.key
            });

            // React with success
            await sock.sendMessage(m.chat, { 
                react: { text: "✅", key: m.key } 
            });

        } catch (error) {
            console.error("ytmp3 error:", error);
            await sock.sendMessage(m.chat, {
                text: `❌ Download failed: ${error.message || 'Unknown error'}\n\nPlease try again later.`,
                edit: loading.key
            });
        }
    }
};