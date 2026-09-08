const axios = require('axios');
const yts = require('yt-search');

let googleImageFn = null;
try {
    const scraperImages = require('@bochilteam/scraper-images');
    googleImageFn = scraperImages.googleImage || scraperImages.default?.googleImage || null;
} catch (_) {
    googleImageFn = null;
}

// ytdl-core (and its @distube fork) are both unmaintained as of 2026 and are the
// most likely cause of "video download" failures. youtubei.js is the current
// actively-maintained option: npm install youtubei.js
let Innertube = null;
try {
    ({ Innertube } = require('youtubei.js'));
} catch (_) {
    Innertube = null;
}

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DEFAULT_TIMEOUT = 15000;

// Narrow, path-specific placeholder patterns only. The old list also blocked
// ytimg.com/youtube.com/youtu.be and the entire bing.com host, which silently
// killed the YouTube-thumbnail fallback and any Bing-sourced image every time.
const PLACEHOLDER_HOST_PATTERNS = [
    /bing\.com\/sa\/simg/i,
    /bing\.com\/rp\//i,
    /facebook_sharing_/i
];

function isLowQualityImageUrl(url) {
    if (!url) return true;
    try {
        const u = new URL(url, 'http://example.com');
        const path = u.pathname || '';
        for (const p of PLACEHOLDER_HOST_PATTERNS) {
            if (p.test(url) || p.test(path)) return true;
        }
        if (/^data:/i.test(url)) return true;
        if (/sprite|logo|icon|favicon|placeholder|spacer|blank/i.test(url)) return true;
        return false;
    } catch (_) {
        return true;
    }
}

function normalizeQuery(query) {
    return String(query || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripIntentKeywords(query) {
    return normalizeQuery(query)
        .replace(/\b(video|clip|gif|animation|animated|mp4|picture|photo|image|wallpaper|pic|wall|meme|ask|answer)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you', 'are', 'what',
    'when', 'where', 'why', 'how', 'but', 'not', 'its', 'it', 'is', 'a', 'an', 'of', 'to', 'on',
    'in', 'at', 'as', 'by', 'or', 'be', 'was', 'were', 'video', 'clip', 'gif', 'animation',
    'animated', 'picture', 'photo', 'image', 'wallpaper', 'pic', 'wall', 'meme'
]);

function buildTokens(query) {
    const tokens = normalizeQuery(query).toLowerCase().match(/[a-z0-9]+/g) || [];
    return tokens.filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function buildSearchPhrase(query) {
    const cleaned = stripIntentKeywords(query)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokens = buildTokens(cleaned);
    if (tokens.length === 0) return normalizeQuery(query);
    return tokens.join(' ');
}

function buildVideoSearchPhrase(query) {
    return buildSearchPhrase(query) || normalizeQuery(query);
}

function scoreResult(query, item) {
    const term = normalizeQuery(query).toLowerCase();
    const desc = String(item?.description || item?.title || item?.url || '').toLowerCase();
    const filteredTokens = buildTokens(term);
    const tokenScore = filteredTokens.reduce((sum, token) => sum + (desc.includes(token) ? 15 : 0), 0);
    const exactPhraseScore = desc.includes(term) ? 80 : 0;
    const overlap = filteredTokens.filter(token => desc.includes(token)).length;
    const overlapScore = overlap * 18;
    const totalScore = exactPhraseScore + tokenScore + overlapScore;

    if (filteredTokens.length > 0 && overlap === 0) {
        return totalScore - 100;
    }
    return totalScore;
}

function rankResults(query, items) {
    const deduped = [];
    const seen = new Set();

    for (const item of items) {
        if (!item?.url) continue;
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        deduped.push({ ...item, score: scoreResult(query, item) });
    }

    return deduped.sort((a, b) => (b.score || 0) - (a.score || 0));
}

function detectSearchIntent(query) {
    const text = String(query || '').toLowerCase().trim();
    const wantsVideo = /\b(video|clip|gif|animation|animated|mp4|motion)\b/.test(text);
    const wantsImage = /\b(picture|photo|image|wallpaper|pic|wall|meme)\b/.test(text);
    const isNsfw = /\b(nsfw|nude|naked|sex|porn|pussy|ass|boobs|breasts|hentai|milf|adult|erotic|sexy|xxx)\b/.test(text);
    const isQuestion = !wantsVideo && !wantsImage && (
        /\?\s*$/.test(text) ||
        /^(who|what|when|where|why|how|is|are|does|do|did|can|could|will|would|should|define)\b/.test(text)
    );

    let mediaType = 'image';
    if (wantsVideo && !wantsImage) mediaType = 'video';
    if (isQuestion) mediaType = 'answer';

    return { mediaType, isNsfw, isQuestion };
}

function pickAnimeWaifuTag(query) {
    const cleaned = normalizeQuery(query).toLowerCase();
    const tagHints = ['waifu', 'maid', 'neko', 'senko', 'shinobu', 'megumin', 'kitsune', 'uniform', 'selfies', 'coffee', 'marin'];
    for (const tag of tagHints) {
        if (cleaned.includes(tag)) return tag;
    }
    return 'waifu';
}

// Fixed: the old version spread `...options` AFTER building `headers`, which threw
// away the merged User-Agent default any time a caller's `options` object contained
// its own `headers` key (most calls did). Sites that reject non-browser UAs were
// silently getting no User-Agent at all on those calls.
async function getJson(url, options = {}) {
    const { headers, ...rest } = options;
    const response = await axios.get(url, {
        timeout: DEFAULT_TIMEOUT,
        validateStatus: () => true,
        ...rest,
        headers: {
            'User-Agent': DEFAULT_UA,
            ...(headers || {})
        }
    });
    return response;
}

// ---------- Q&A ----------

async function searchDuckDuckGoAnswer(query) {
    const term = normalizeQuery(query);
    if (!term) return null;

    const response = await getJson('https://api.duckduckgo.com/', {
        params: { q: term, format: 'json', no_html: 1, skip_disambig: 1 }
    });

    if (response.status !== 200 || !response.data) return null;
    const data = response.data;
    const text = data.AbstractText || data.Answer || data.Definition || '';
    if (!text) return null;

    return {
        text,
        source: data.AbstractSource || 'DuckDuckGo',
        url: data.AbstractURL || data.DefinitionURL || ''
    };
}

async function searchWikipediaAnswer(query) {
    const term = normalizeQuery(query);
    if (!term) return null;

    const searchResp = await getJson('https://en.wikipedia.org/w/api.php', {
        params: { action: 'query', list: 'search', srsearch: term, format: 'json', srlimit: 1 }
    });

    const hit = searchResp.data?.query?.search?.[0];
    if (!hit?.title) return null;

    const summaryResp = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`);
    if (summaryResp.status !== 200 || !summaryResp.data?.extract) return null;

    return {
        text: summaryResp.data.extract,
        source: 'Wikipedia',
        url: summaryResp.data.content_urls?.desktop?.page || ''
    };
}

// DuckDuckGo's instant-answer coverage is mostly reference/encyclopedic (it's
// backed largely by Wikipedia). It won't answer everything a full search engine
// would - that's a real ceiling, not a bug - so this chains a Wikipedia lookup
// as a second attempt before giving up.
async function searchAnswer(query) {
    try {
        const ddg = await searchDuckDuckGoAnswer(query);
        if (ddg) return ddg;
    } catch (_) {}

    try {
        return await searchWikipediaAnswer(query);
    } catch (_) {
        return null;
    }
}

// ---------- Images ----------

async function googleImageSearch(query) {
    const term = normalizeQuery(query);
    if (!term) return [];

    if (typeof googleImageFn === 'function') {
        try {
            const raw = await googleImageFn(term);
            if (Array.isArray(raw) && raw.length > 0) {
                const normalized = raw
                    .map(item => {
                        if (!item) return null;
                        if (typeof item === 'string') return item;
                        if (typeof item === 'object') return item.url || item.src || item.image || item.thumbnail || null;
                        return null;
                    })
                    .filter(Boolean);

                if (normalized.length > 0) {
                    return [...new Set(normalized)].slice(0, 10).map(url => ({
                        url, width: 0, height: 0, thumbnail: url, description: term
                    }));
                }
            }
        } catch (_) {
            // fall back to Bing scraping below
        }
    }

    const response = await getJson(`https://www.bing.com/images/search?q=${encodeURIComponent(term)}`, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 20000
    });

    if (response.status !== 200) return [];
    const html = String(response.data || '');
    const matches = [...html.matchAll(/"murl":"(https?:\/\/[^"']+\.(?:jpe?g|png|webp|gif))"/gim)];
    const urls = [...new Set(matches.map(match => match[1]))].slice(0, 10);

    return urls.map(url => ({ url, width: 0, height: 0, thumbnail: url, description: term }));
}

async function searchDuckDuckGoImageSearch(query, limit = 10) {
    const term = normalizeQuery(query);
    if (!term) return [];

    const response = await getJson(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(term)}&kp=-1`, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 20000
    });

    if (response.status !== 200 || !response.data) return [];
    const matches = Array.isArray(response.data.results) ? response.data.results : [];
    const urls = [...new Set(
        matches.map(item => item?.image || item?.thumbnail || item?.url)
            .filter(u => typeof u === 'string' && /^https?:\/\//i.test(u))
    )].slice(0, limit);

    return urls.map(url => ({ url, width: 0, height: 0, thumbnail: url, description: term }));
}

async function searchImageWebResults(query, limit = 5) {
    const term = normalizeQuery(query);
    if (!term) return [];

    const response = await getJson(`https://www.bing.com/images/search?q=${encodeURIComponent(term)}`, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 20000
    });

    if (response.status !== 200) return [];
    const html = String(response.data || '');
    const found = new Set();

    const mOg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (mOg && mOg[1]) found.add(mOg[1]);

    const mTw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (mTw && mTw[1]) found.add(mTw[1]);

    for (const m of html.matchAll(/<img[^>]+(?:src|data-src|data-thumb|data-srcset)=["']([^"']+\.(?:jpe?g|png|webp|gif))[^"']*["'][^>]*>/gim)) {
        if (m && m[1]) found.add(m[1]);
    }
    for (const m of html.matchAll(/background-image:\s*url\((?:'|")?(https?:\/\/[^\)\"']+\.(?:jpe?g|png|webp|gif))(?:'|")?\)/gim)) {
        if (m && m[1]) found.add(m[1]);
    }

    const urls = [...found].slice(0, limit).filter(u => /^https?:\/\//i.test(u) && !isLowQualityImageUrl(u));
    return urls.map(url => ({ url, width: 0, height: 0, thumbnail: url, description: term }));
}

async function searchDuckDuckGoWebResults(query, limit = 5) {
    const term = normalizeQuery(query);
    if (!term) return [];

    const response = await getJson(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(term)}`, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 20000
    });

    if (response.status !== 200) return [];
    const html = String(response.data || '');
    const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gim)];

    const results = [];
    for (const match of matches) {
        const href = String(match[1] || '');
        const title = String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!href || !title) continue;

        let url = href;
        if (/uddg=/.test(url)) {
            url = decodeURIComponent(url).replace(/^.*?uddg=/i, '').replace(/&rut=.*$/i, '');
        }
        if (!/^https?:\/\//i.test(url)) continue;

        results.push({ url, title, description: title, mimeType: 'video/mp4' });
    }

    return [...new Map(results.map(item => [item.url, item])).values()].slice(0, limit);
}

async function searchGoogleWebResults(query, limit = 5) {
    const term = normalizeQuery(query);
    if (!term) return [];

    const response = await getJson(`https://www.google.com/search?q=${encodeURIComponent(term)}`, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 20000
    });

    if (response.status !== 200) return [];
    const html = String(response.data || '');
    const matches = [...html.matchAll(/href="\/url\?q=([^"&]+)"[^>]*>(.*?)<\/a>/gim)];

    const results = [];
    for (const match of matches) {
        const rawUrl = String(match[1] || '');
        const url = decodeURIComponent(rawUrl).replace(/&sa=.*/, '');
        const title = String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!url || !/^https?:\/\//i.test(url)) continue;
        results.push({ url, title, description: title, mimeType: 'video/mp4' });
    }

    return [...new Map(results.map(item => [item.url, item])).values()].slice(0, limit);
}

async function searchYoutubeVideos(query, limit = 4) {
    const term = normalizeQuery(query);
    if (!term) return [];

    const search = await yts(term);
    const videos = Array.isArray(search?.videos) ? search.videos : [];

    return videos.slice(0, limit).map(video => ({
        url: video.url,
        width: 0,
        height: 0,
        thumbnail: video.thumbnail,
        description: video.title || term,
        mimeType: 'video/mp4'
    }));
}

async function searchImages(query, config) {
    const term = buildSearchPhrase(query);
    const providers = [
        () => searchDuckDuckGoImageSearch(term, 8),
        () => googleImageSearch(term),
        () => searchImageWebResults(term, 6),
        async () => {
            const response = await getJson('https://api.waifu.im/search', {
                params: { included_tags: pickAnimeWaifuTag(term), is_nsfw: false }
            });
            if (response.status !== 200 || !Array.isArray(response.data?.images)) return [];
            return response.data.images.map(result => ({
                url: result.url,
                width: result.width,
                height: result.height,
                thumbnail: result.url,
                description: result.tags?.join(', ') || term
            }));
        }
    ];

    const results = [];
    for (const provider of providers) {
        try {
            const items = await provider();
            if (Array.isArray(items) && items.length > 0) results.push(...items);
        } catch (_) {
            // best-effort fallback chain - ignore individual provider failures
        }
    }

    let filtered = results.filter(it => it?.url && !isLowQualityImageUrl(it.url));

    if (filtered.length === 0) {
        try {
            const ytv = await searchYoutubeVideos(term, 6);
            const thumbs = ytv.map(v => ({ url: v.thumbnail, thumbnail: v.thumbnail, description: v.description || term }));
            filtered.push(...thumbs.filter(it => it?.url && !isLowQualityImageUrl(it.url)));
        } catch (_) {}

        try {
            let pages = await searchDuckDuckGoWebResults(term, 6).catch(() => []);
            if (pages.length === 0) pages = await searchGoogleWebResults(term, 6).catch(() => []);

            for (const page of pages) {
                try {
                    const resp = await getJson(page.url, { timeout: 10000 });
                    if (resp.status !== 200 || !resp.data) continue;
                    const html = String(resp.data);
                    const match =
                        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
                    if (match?.[1] && /^https?:\/\//i.test(match[1]) && !isLowQualityImageUrl(match[1])) {
                        filtered.push({ url: match[1], thumbnail: match[1], description: page.title || term });
                    }
                } catch (_) {}
            }
        } catch (_) {}
    }

    const finalResults = (filtered.length > 0 ? filtered : results).filter(it => it?.url);
    return rankResults(term, finalResults).slice(0, 8);
}

async function searchVideos(query, config) {
    const term = buildVideoSearchPhrase(query);
    const providers = [
        () => searchYoutubeVideos(term, 3),
        () => searchDuckDuckGoWebResults(term, 4),
        () => searchGoogleWebResults(term, 4)
        // Tenor is gone (Google shut the API down for third parties on 2026-06-30) -
        // removed rather than left in as dead weight. If you want GIF results back,
        // Klipy (klipy.com) is the migration path Discord/WhatsApp/X are using; its
        // request shape is a near drop-in for the old Tenor v1 calls if you grab a key.
    ];

    const results = [];
    for (const provider of providers) {
        try {
            const items = await provider();
            if (Array.isArray(items) && items.length > 0) results.push(...items);
        } catch (_) {}
    }

    return rankResults(term, results.filter(item => item?.url)).slice(0, 8);
}

// ---------- Download ----------

async function webStreamToBuffer(webStream) {
    const reader = webStream.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
}

// youtubei.js talks to YouTube's internal (Innertube) API rather than scraping
// the page, which is why it's still actively maintained while ytdl-core isn't.
// Its API does shift between versions, though - if `.download()` throws or the
// options below stop matching, check the "examples/download" folder in the
// youtubei.js repo for the current signature.
async function downloadYoutubeVideo(url) {
    if (!Innertube) {
        throw new Error('youtubei.js is not installed - run: npm install youtubei.js');
    }

    const idMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    const videoId = idMatch ? idMatch[1] : url;

    const yt = await Innertube.create();
    const info = await yt.getInfo(videoId);
    const stream = await info.download({ type: 'video+audio', quality: 'best', format: 'mp4' });
    const buffer = await webStreamToBuffer(stream);

    return { buffer, mimetype: 'video/mp4' };
}

async function downloadMedia(url, timeout = 30000) {
    if (/youtube\.com|youtu\.be/i.test(url)) {
        return downloadYoutubeVideo(url);
    }

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout,
        headers: { 'User-Agent': DEFAULT_UA, Referer: 'https://www.google.com/' },
        validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 400) {
        throw new Error(`Download failed with status ${response.status}`);
    }

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (!/^(image|video|audio)\//i.test(contentType) && !/^application\/octet-stream/i.test(contentType)) {
        throw new Error(`Unsupported media type: ${contentType || 'unknown'}`);
    }

    return {
        buffer: Buffer.from(response.data),
        mimetype: response.headers['content-type'] || 'application/octet-stream'
    };
}

// ---------- Entry point ----------

async function searchMedia(query, config, overrideMediaType) {
    const normalized = normalizeQuery(query);
    const detected = detectSearchIntent(normalized);

    // NSFW intent is still detected (useful signal), it just no longer routes
    // anywhere - the command layer turns this into a polite decline.
    if (detected.isNsfw) {
        return { normalized, mediaType: 'blocked', isNsfw: true, result: null, alternatives: [] };
    }

    const mediaType = overrideMediaType || detected.mediaType;

    if (mediaType === 'answer') {
        const answer = await searchAnswer(normalized);
        if (answer) {
            return { normalized, mediaType: 'answer', isNsfw: false, result: answer, alternatives: [] };
        }
        // no direct answer available - fall through to an image search instead of returning nothing
    }

    const result = mediaType === 'video'
        ? await searchVideos(normalized, config)
        : await searchImages(normalized, config);

    return {
        normalized,
        mediaType: mediaType === 'video' ? 'video' : 'image',
        isNsfw: false,
        result: result[0] || null,
        alternatives: result.slice(1)
    };
}

module.exports = {
    DEFAULT_UA,
    normalizeQuery,
    stripIntentKeywords,
    buildSearchPhrase,
    buildVideoSearchPhrase,
    detectSearchIntent,
    pickAnimeWaifuTag,
    searchImages,
    searchVideos,
    searchAnswer,
    googleImageSearch,
    searchDuckDuckGoImageSearch,
    searchImageWebResults,
    searchDuckDuckGoWebResults,
    searchGoogleWebResults,
    searchYoutubeVideos,
    downloadMedia,
    searchMedia
};