const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { isOwner } = require("../../lib/isOwner");

const SUPPORTED_LANGUAGES = {
    ar: "Arabic",
    az: "Azerbaijani",
    be: "Belarusian",
    bg: "Bulgarian",
    bn: "Bengali",
    ca: "Catalan",
    cs: "Czech",
    cy: "Welsh",
    da: "Danish",
    de: "German",
    el: "Greek",
    en: "English",
    eo: "Esperanto",
    es: "Spanish",
    et: "Estonian",
    fa: "Persian",
    fi: "Finnish",
    fr: "French",
    ga: "Irish",
    gu: "Gujarati",
    he: "Hebrew",
    hi: "Hindi",
    hr: "Croatian",
    ht: "Haitian",
    hu: "Hungarian",
    hy: "Armenian",
    id: "Indonesian",
    is: "Icelandic",
    it: "Italian",
    ja: "Japanese",
    ka: "Georgian",
    kk: "Kazakh",
    ko: "Korean",
    ky: "Kyrgyz",
    lb: "Luxembourgish",
    lt: "Lithuanian",
    lv: "Latvian",
    mg: "Malagasy",
    mk: "Macedonian",
    ml: "Malayalam",
    mn: "Mongolian",
    mr: "Marathi",
    ms: "Malay",
    mt: "Maltese",
    my: "Burmese",
    ne: "Nepali",
    nl: "Dutch",
    no: "Norwegian",
    pa: "Punjabi",
    pl: "Polish",
    pt: "Portuguese",
    ro: "Romanian",
    ru: "Russian",
    sk: "Slovak",
    sl: "Slovenian",
    sq: "Albanian",
    sr: "Serbian",
    sv: "Swedish",
    sw: "Swahili",
    ta: "Tamil",
    te: "Telugu",
    th: "Thai",
    tl: "Tagalog",
    tr: "Turkish",
    uk: "Ukrainian",
    ur: "Urdu",
    vi: "Vietnamese",
    zh: "Chinese"
};

function isValidLanguageCode(code) {
    return !!SUPPORTED_LANGUAGES[code?.toLowerCase()];
}

function getQuotedText(quoted) {
    if (!quoted) return "";
    return quoted.text || quoted.message?.conversation || quoted.message?.extendedTextMessage?.text || "";
}

const GOOGLE_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single?client=gtx";
const TRANSLATE_ENDPOINTS = [
    "https://libretranslate.de/translate",
    "https://translate.argosopentech.com/translate"
];

// Persistent translate config
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'translate.json');

function ensureDataDir() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {}
}

function loadTranslateConfig() {
    ensureDataDir();
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const def = { defaultTarget: 'en' };
            fs.writeFileSync(DATA_FILE, JSON.stringify(def, null, 2), 'utf8');
            return def;
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (e) {
        console.warn('[translate] failed to load config, using defaults', e?.message || e);
        return { defaultTarget: 'en' };
    }
}

function saveTranslateConfig(cfg) {
    ensureDataDir();
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(cfg, null, 2), 'utf8'); } catch (e) { console.warn('[translate] failed to save config', e?.message || e); }
}

let translateConfig = loadTranslateConfig();

function parseGoogleTranslationData(data) {
    // data shape: [ [ [translatedSegment, originalSegment, ...], ... ], null, detectedSource, ... ]
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const translated = data[0].map(item => item[0]).filter(Boolean).join("");
    const detectedSource = (typeof data[2] === 'string' && data[2].length > 0) ? data[2] : null;
    return { translated, detectedSource };
}

async function fetchTranslationWithGoogle(text, targetLang) {
    const url = `${GOOGLE_TRANSLATE_URL}&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await axios.get(url, {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const parsed = parseGoogleTranslationData(response.data);
    if (!parsed || !parsed.translated) {
        throw new Error("Google Translate returned invalid data");
    }
    return { text: parsed.translated, source: parsed.detectedSource || null, engine: 'google' };
}

async function fetchTranslation(text, targetLang) {
    let lastError = null;

    try {
        return await fetchTranslationWithGoogle(text, targetLang);
    } catch (err) {
        lastError = err;
        console.warn(`Google Translate failed:`, err?.message || err);
    }

    for (const endpoint of TRANSLATE_ENDPOINTS) {
        try {
            const response = await axios.post(endpoint, {
                q: text,
                source: "auto",
                target: targetLang,
                format: "text"
            }, {
                timeout: 15000
            });

            const translatedText = response.data?.translatedText || response.data?.translated || response.data?.result || null;
            const detected = response.data?.detected || response.data?.detected_language || null;
            if (translatedText) {
                return { text: translatedText, source: detected || null, engine: endpoint };
            }

            lastError = new Error(`Empty translation from ${endpoint}`);
        } catch (err) {
            lastError = err;
            console.warn(`Translate endpoint failed (${endpoint}):`, err?.message || err);
        }
    }

    throw lastError || new Error("Translation failed");
}

module.exports = {
    command: ["translate", "tr"],
    category: "tools",
    description: "Translate text to another language",

    async execute(sock, m, args, config) {
        try {
            // Immediate reaction for responsiveness
            try { await sock.sendMessage(m.chat, { react: { text: "🌐", key: m.key } }); } catch (e) {}

            const quotedMessage = m.quoted || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedText = getQuotedText(quotedMessage);

            // List languages option
            if (args[0] && ['-l', '--list', 'list'].includes(args[0].toLowerCase())) {
                const lines = Object.entries(SUPPORTED_LANGUAGES)
                    .map(([code, name]) => `${code} — ${name}`)
                    .sort((a, b) => a.localeCompare(b));
                const header = `🌐 Supported languages (${lines.length})\nUse \`.tr <code> <text>\` or reply with \`.tr <code>\` to translate.`;
                // send in one message (should be small enough)
                return sock.sendMessage(m.chat, { text: `${header}\n\n${lines.join('\n')}` }, { quoted: m });
            }

            // Status / config commands: .tr status  or .tr set <lang>
            if (args[0] && ['status', 'info'].includes(args[0].toLowerCase())) {
                const defaultTarget = (translateConfig && translateConfig.defaultTarget) ? translateConfig.defaultTarget : 'en';
                const defaultName = SUPPORTED_LANGUAGES[defaultTarget] || defaultTarget.toUpperCase();
                const text = `🌐 Translate Status\n\nDefault target: ${defaultName} (${defaultTarget})\nSupported languages: ${Object.keys(SUPPORTED_LANGUAGES).length}\n\nUse .tr -l to list codes.\nOwner can change default with: .tr set <code>`;
                return sock.sendMessage(m.chat, { text }, { quoted: m });
            }

            if (args[0] && ['set', 'default'].includes(args[0].toLowerCase())) {
                // set default target language (owner only)
                const senderJid = m.key?.participant || m.key?.remoteJid || m.sender;
                if (!isOwner(senderJid, config.ownerNumber)) {
                    return sock.sendMessage(m.chat, { text: '❌ Only the owner can change the default translate target.' }, { quoted: m });
                }
                const newCode = args[1] ? args[1].toLowerCase() : null;
                if (!newCode || !isValidLanguageCode(newCode)) {
                    return sock.sendMessage(m.chat, { text: '❌ Invalid language code. Use .tr -l to list supported language codes.' }, { quoted: m });
                }
                translateConfig.defaultTarget = newCode;
                saveTranslateConfig(translateConfig);
                const newName = SUPPORTED_LANGUAGES[newCode] || newCode.toUpperCase();
                return sock.sendMessage(m.chat, { text: `✅ Default translation target updated to ${newName} (${newCode})` }, { quoted: m });
            }

            // Resolve target language and text to translate
            let targetLang = (translateConfig && translateConfig.defaultTarget) ? translateConfig.defaultTarget : 'en';
            let textToTranslate = quotedText || args.join(' ').trim();

            if (args.length > 0 && isValidLanguageCode(args[0])) {
                targetLang = args[0].toLowerCase();
                const rest = args.slice(1).join(' ').trim();
                if (rest) textToTranslate = rest;
            } else {
                // support syntax: .tr en|Hello world
                const joined = args.join(' ').trim();
                if (joined.includes('|')) {
                    const [maybeCode, rest] = joined.split('|', 2).map(s => s.trim());
                    if (isValidLanguageCode(maybeCode)) {
                        targetLang = maybeCode.toLowerCase();
                        if (rest) textToTranslate = rest;
                    }
                }
            }

            if (!textToTranslate) {
                const sampleCodes = ['pt', 'es', 'fr', 'de', 'zh']
                    .map(code => `${code} (${SUPPORTED_LANGUAGES[code]})`).join(', ');

                return sock.sendMessage(m.chat, {
                    text: "❌ Please provide text to translate.\n\n" +
                          "Usage:\n.tr <lang> <text> — Translate text to <lang>\n.tr <lang> — Reply to a message with this to translate it\n.tr — Defaults to English if no lang provided\n.tr -l — List supported language codes\n\n" +
                          "Example:\n.tr es Hello world\nReply to a message with: .tr en\n\n" +
                          `Supported examples: ${sampleCodes}`
                }, { quoted: m });
            }

            const loading = await sock.sendMessage(m.chat, {
                text: `🌐 Translating to ${SUPPORTED_LANGUAGES[targetLang] || targetLang.toUpperCase()}...`
            }, { quoted: m });

            const result = await fetchTranslation(textToTranslate, targetLang);
            if (!result || !result.text) throw new Error('Empty translation result');

            const sourceCode = result.source || 'auto';
            const sourceName = SUPPORTED_LANGUAGES[sourceCode] || (sourceCode === 'auto' ? 'Auto-detected' : sourceCode.toUpperCase());
            const targetName = SUPPORTED_LANGUAGES[targetLang] || targetLang.toUpperCase();

            const engineName = result.engine === 'google' ? 'Google' : (typeof result.engine === 'string' ? new URL(result.engine).host : 'Unknown');

            const usedDefault = (translateConfig && translateConfig.defaultTarget) ? (targetLang === translateConfig.defaultTarget) : (targetLang === 'en');

            const out = [];
            out.push(`🌐 Translation — ${sourceName} → ${targetName}${usedDefault ? ' (default)' : ''}`);
            out.push('');
            out.push(`📝 Original (${sourceCode.toUpperCase()}):`);
            out.push(textToTranslate);
            out.push('');
            out.push(`🔠 Translated (${targetLang.toUpperCase()}):`);
            out.push(result.text);
            out.push('');
            out.push(`⚙️ Engine: ${engineName}`);

            await sock.sendMessage(m.chat, { text: out.join('\n'), edit: loading.key });

            try { await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }); } catch (e) {}

        } catch (err) {
            console.error('Translate error:', err);
            let replyText = '❌ Translation failed. Please try again later.';
            if (err?.response?.data?.error) replyText = `❌ Translation failed: ${err.response.data.error}`;
            else if (err?.message) replyText = `❌ Translation failed: ${err.message}`;
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};