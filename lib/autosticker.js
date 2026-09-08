const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { ffmpeg } = require('./converter');
const { buildStickerFfmpegArgs } = require('./sticker-utils');
const database = require('./database');

function getExtensionFromMimetype(mimetype) {
    if (!mimetype) return 'jpg';
    const parts = mimetype.split('/');
    if (parts[1] === 'jpeg') return 'jpg';
    return parts[1] || 'jpg';
}

async function processAutoSticker(sock, m, text, config) {
    try {
        if (!m || !m.key || !m.key.remoteJid) return;
        const chat = m.key.remoteJid;
        if (!chat.endsWith('@g.us')) return; // only groups
        if (m.key.fromMe) return; // skip bot messages

        const settings = database.getGroupSettings(chat) || {};
        if (!settings.autosticker) return;

        // Skip if already a sticker
        if (m.message?.stickerMessage) return;

        // Detect media (including view-once wrappers)
        let mediaMessage = null;
        let messageForDownload = m;

        const viewOnceContainer = m.message?.viewOnceMessageV2?.message || m.message?.viewOnceMessage?.message || m.message?.viewOnceMessageV2Extension?.message;

        if (viewOnceContainer) {
            mediaMessage = viewOnceContainer.imageMessage || viewOnceContainer.videoMessage || null;
            if (mediaMessage) {
                // construct a fake message wrapper for downloadMediaMessage
                messageForDownload = { message: { ...viewOnceContainer } };
            }
        } else {
            mediaMessage = m.message?.imageMessage || m.message?.videoMessage || null;
        }

        if (!mediaMessage) return;

        // Download buffer
        const buffer = await downloadMediaMessage(messageForDownload, 'buffer', {}, {
            logger: console,
            reuploadRequest: sock.updateMediaMessage
        });

        if (!buffer || !Buffer.isBuffer(buffer)) return;

        const isVideo = !!(mediaMessage.mimetype && mediaMessage.mimetype.startsWith('video/')) || Boolean(mediaMessage?.seconds);
        const inputExt = getExtensionFromMimetype(mediaMessage.mimetype || 'image/jpeg');

        const webpBuffer = await ffmpeg(buffer, buildStickerFfmpegArgs(isVideo), inputExt, 'webp');
        if (!webpBuffer) return;

        await sock.sendMessage(chat, { sticker: webpBuffer }, { quoted: m });
    } catch (err) {
        console.error('[autosticker] error:', err?.message || err);
    }
}

module.exports = {
    processAutoSticker
};
