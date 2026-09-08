const axios = require('axios');

const AXIOS_DEFAULTS = {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
};

async function tryRequest(getter, attempts = 2, delay = 800) {
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

// Lyrics API methods with fallback
async function getVredenLyrics(query) {
    const res = await axios.get(`https://api.vreden.my.id/api/lyrics?query=${encodeURIComponent(query)}`, AXIOS_DEFAULTS);
    if (res?.data?.result) {
        return {
            title: res.data.result.title,
            artist: res.data.result.artist,
            lyrics: res.data.result.lyrics,
            thumbnail: res.data.result.thumbnail
        };
    }
    throw new Error('Vreden API failed');
}

async function getSiputzxLyrics(query) {
    const res = await axios.get(`https://api.siputzx.my.id/api/s/lyrics?query=${encodeURIComponent(query)}`, AXIOS_DEFAULTS);
    if (res?.data?.status && res.data.data) {
        return {
            title: res.data.data.title,
            artist: res.data.data.artist,
            lyrics: res.data.data.lyrics,
            thumbnail: res.data.data.image
        };
    }
    throw new Error('Siputzx API failed');
}

async function getLocalLyrics(query) {
    let scrapeLyrics;
    try {
        scrapeLyrics = require('@bochilteam/scraper-lyrics').lyrics;
    } catch (err) {
        throw new Error('Local lyrics scraper unavailable');
    }

    if (typeof scrapeLyrics !== 'function') {
        throw new Error('Local lyrics scraper unavailable');
    }

    const res = await scrapeLyrics(query);
    if (!res?.lyrics) {
        throw new Error('Local lyrics scraper failed');
    }

    const lyrics = Array.isArray(res.lyrics)
        ? res.lyrics.map(item => item?.text || '').filter(Boolean).join('\n')
        : String(res.lyrics).trim();

    return {
        title: res.title || query,
        artist: res.artist || res.author || 'Unknown',
        lyrics,
        thumbnail: res.albumCover || res.album?.cover || res.image || null
    };
}

module.exports = {
    command: ['lyrics'],
    category: 'downloaders',
    description: 'Get song lyrics with artist info',
    usage: '.lyrics <song name>',

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;

        // Validate input
        if (!args || args.length === 0) {
            return sock.sendMessage(chat, {
                text: '❌ Please provide a song name!\n\nExample: `.lyrics Despacito`\n\nOr reply to a message with song name and use `.lyrics`'
            }, { quoted: m });
        }

        const query = args.join(' ').trim();
        if (query.length < 2) {
            return sock.sendMessage(chat, {
                text: '❌ Song name too short. Please provide at least 2 characters.'
            }, { quoted: m });
        }

        const loading = await sock.sendMessage(chat, {
            text: `🔍 Searching lyrics for *"${query}"*...`
        }, { quoted: m });

        try {
            let lyricsData = null;
            const apiMethods = [
                { name: 'Local Scraper', method: () => getLocalLyrics(query) },
                { name: 'Vreden', method: () => getVredenLyrics(query) },
                { name: 'Siputzx', method: () => getSiputzxLyrics(query) }
            ];

            // Try each API with fallback
            for (const apiMethod of apiMethods) {
                try {
                    console.log(`[lyrics] Trying ${apiMethod.name}...`);
                    lyricsData = await tryRequest(apiMethod.method, 2, 1000);
                    if (lyricsData?.lyrics) {
                        console.log(`[lyrics] ${apiMethod.name} succeeded!`);
                        break;
                    }
                } catch (err) {
                    console.log(`[lyrics] ${apiMethod.name} failed: ${err.message}`);
                    continue;
                }
            }

            if (!lyricsData?.lyrics) {
                return sock.sendMessage(chat, {
                    text: `❌ Could not find lyrics for *"${query}"*\n\nTry searching with a different song name or artist.`,
                    edit: loading.key
                });
            }

            // Normalize and truncate lyrics if too long
            let lyrics = String(lyricsData.lyrics || '').trim();
            const MAX_LYRICS_LENGTH = 5000;
            if (lyrics.length > MAX_LYRICS_LENGTH) {
                lyrics = lyrics.substring(0, MAX_LYRICS_LENGTH) + '\n\n_... (Lyrics too long, showing first part only)_';
            }

            const title = String(lyricsData.title || query).trim();
            const artist = String(lyricsData.artist || 'Unknown').trim();

            const headerText = `🎵 *${title}*\n` +
                               `👤 *Artist:* ${artist}\n\n` +
                               `_Lyrics follow in the next message(s)_`;

            const lyricsText = `📝 *Lyrics:*\n\n` +
                              `\`\`\`\n${lyrics}\n\`\`\``;

            async function sendTextChunks(text, quoted) {
                const CHUNK_SIZE = 1600;
                if (!text || text.length <= CHUNK_SIZE) {
                    return sock.sendMessage(chat, { text }, { quoted });
                }
                const chunks = [];
                for (let i = 0; i < text.length; i += CHUNK_SIZE) {
                    chunks.push(text.substring(i, i + CHUNK_SIZE));
                }
                for (const chunk of chunks) {
                    await sock.sendMessage(chat, { text: chunk }, { quoted });
                }
            }

            // Send header and optionally a thumbnail preview
            if (lyricsData.thumbnail) {
                try {
                    await sock.sendMessage(chat, {
                        image: { url: lyricsData.thumbnail },
                        caption: headerText
                    }, { quoted: m });
                } catch (imgErr) {
                    console.log('[lyrics] Thumbnail send failed, sending header text only');
                    await sock.sendMessage(chat, { text: headerText }, { quoted: m });
                }
            } else {
                await sock.sendMessage(chat, { text: headerText }, { quoted: m });
            }

            // Send lyrics body in chunks so WhatsApp limits are not exceeded
            await sendTextChunks(lyricsText, m);

            // Update loading message
            if (loading?.key) {
                await sock.sendMessage(chat, {
                    text: `✅ Found lyrics for *${title}*!`,
                    edit: loading.key
                });
            }

            // React with success
            await sock.sendMessage(chat, {
                react: { text: '✅', key: m.key }
            });

        } catch (error) {
            console.error('[lyrics] error:', error?.message || error);
            await sock.sendMessage(chat, {
                text: `❌ Error fetching lyrics: ${error?.message || 'Unknown error'}\n\nPlease try again later.`,
                edit: loading.key
            });
        }
    }
};
