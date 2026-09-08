const yts = require('yt-search');
const axios = require('axios');

const AXIOS_DEFAULTS = {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
};

async function tryRequest(getter, attempts = 2) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try { return await getter(); } 
        catch (err) { lastError = err; if (i < attempts) await new Promise(r => setTimeout(r, 800)); }
    }
    throw lastError;
}

module.exports = {
    command: ["ytmp4"],
    category: "downloaders",
    description: "Download YouTube video as MP4",

    async execute(sock, m, args, config) {
        const query = args.join(" ").trim();
        if (!query) {
            return sock.sendMessage(m.chat, { text: "❌ What video do you want?\nExample: `.ytmp4 world cup ishowspeed`" }, { quoted: m });
        }

        const loading = await sock.sendMessage(m.chat, { text: "🔍 Searching YouTube..." }, { quoted: m });

        try {
            const search = await yts(query);
            if (!search?.videos?.length) {
                return sock.sendMessage(m.chat, { text: "❌ No results found.", edit: loading.key });
            }

            const video = search.videos[0];

            // Rich preview card
            await sock.sendMessage(m.chat, {
                image: { url: video.thumbnail },
                caption: `🎬 *${video.title}*\n` +
                         `👤 ${video.author.name || "Unknown"}\n` +
                         `⏳ ${video.timestamp}\n` +
                         `🔄 Loading video...`,
                mimetype: "image/jpeg"
            }, { quoted: m });

            // Multi-API fallback
            let videoData;
            const apis = [
                () => getEliteProTechVideoByUrl(video.url),
                () => getYupraVideoByUrl(video.url),
                () => getOkatsuVideoByUrl(video.url)
            ];

            for (const api of apis) {
                try {
                    videoData = await api();
                    if (videoData?.download) break;
                } catch (e) {}
            }

            if (!videoData?.download) throw new Error("All sources failed");

            const title = videoData.title || video.title;

            const videoRes = await axios.get(videoData.download, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxRedirects: 3,
                ...AXIOS_DEFAULTS
            });
            const videoBuffer = Buffer.from(videoRes.data);

            await sock.sendMessage(m.chat, {
                video: videoBuffer,
                mimetype: "video/mp4",
                fileName: `${title}.mp4`,
                caption: `*${title}*\nDownloaded with Nyx-MD`
            }, { quoted: m });

            await sock.sendMessage(m.chat, {
                text: `✅ Done! *${title}*`,
                edit: loading.key
            });

            await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error("ytmp4 error:", error);
            await sock.sendMessage(m.chat, {
                text: "❌ Failed to download video.",
                edit: loading.key
            });
        }
    }
};

// Helper functions
async function getEliteProTechVideoByUrl(url) {
    const res = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`);
    if (res?.data?.success && res.data.downloadURL) return { download: res.data.downloadURL, title: res.data.title };
    throw new Error();
}

async function getYupraVideoByUrl(url) {
    const res = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`);
    if (res?.data?.success && res.data.data?.download_url) return { download: res.data.data.download_url, title: res.data.data.title };
    throw new Error();
}

async function getOkatsuVideoByUrl(url) {
    const res = await axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`);
    if (res?.data?.result?.mp4) return { download: res.data.result.mp4, title: res.data.result.title };
    throw new Error();
}