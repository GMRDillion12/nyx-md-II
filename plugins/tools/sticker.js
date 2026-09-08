const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { ffmpeg } = require('../../lib/converter');
const { buildStickerFfmpegArgs } = require('../../lib/sticker-utils');

function getExtensionFromMimetype(mimetype) {
    const ext = mimetype.split('/')[1];
    if (ext === 'jpeg') return 'jpg';
    return ext;
}

module.exports = {
    command: ["sticker", "s"],
    category: "tools",
    description: "Convert image or video to sticker",

    async execute(sock, m, args, config) {
        try {
            // React immediately
            await sock.sendMessage(m.chat, {
                react: { text: "🎨", key: m.key }
            });

            let mediaMessage = m.message?.imageMessage || m.message?.videoMessage;
            let messageToDownload = m;

            // Check if replied to a message with media
            if (!mediaMessage && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
                mediaMessage = quoted.imageMessage || quoted.videoMessage;
                if (mediaMessage) {
                    // Create a fake message object for downloading
                    messageToDownload = {
                        message: quoted
                    };
                }
            }

            if (!mediaMessage) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Please reply to an image or video message to convert to sticker.\n\nUsage:\nReply to an image/video with `.sticker` or `.s`"
                }, { quoted: m });
            }

            if (!mediaMessage) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Please reply to an image or video message to convert to sticker.\n\nUsage:\nReply to an image/video with `.sticker` or `.s`"
                }, { quoted: m });
            }

            const loading = await sock.sendMessage(m.chat, {
                text: "🎨 Converting to sticker..."
            }, { quoted: m });

            // Download media
            const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {}, {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            });

            if (!buffer) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Failed to download media.",
                    edit: loading.key
                });
            }

            // Determine if it's video or image
            const isVideo = mediaMessage.mimetype?.startsWith('video/') || m.message?.videoMessage;
            const inputExt = getExtensionFromMimetype(mediaMessage.mimetype || 'image/jpeg');

            const stickerBuffer = await ffmpeg(
                buffer,
                buildStickerFfmpegArgs(isVideo),
                inputExt,
                'webp'
            );

            if (!stickerBuffer) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Failed to convert to sticker.",
                    edit: loading.key
                });
            }

            // Send the sticker
            await sock.sendMessage(m.chat, {
                sticker: stickerBuffer
            }, { quoted: m });

            // Success reaction
            await sock.sendMessage(m.chat, {
                react: { text: "✅", key: m.key }
            });

            // Delete loading message
            await sock.sendMessage(m.chat, {
                delete: loading.key
            });

        } catch (err) {
            console.error("Sticker error:", err);

            let replyText = "❌ Failed to create sticker. Please try again.";
            if (err?.message) {
                replyText = `❌ Sticker creation failed: ${err.message}`;
            }

            await sock.sendMessage(m.chat, {
                text: replyText
            }, { quoted: m });
        }
    }
};