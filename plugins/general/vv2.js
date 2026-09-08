const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { formatMentionText, buildMentionJids } = require('../../lib/mentions');

module.exports = {
    command: ["vv2"],
    category: "general",
    description: "Reveal view-once image, video or audio and send it privately to the command sender",

    async execute(sock, m, args, config) {
        try {
            const contextInfo = m.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo?.quotedMessage) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Please reply to a view-once image, video or audio!\n\nHow to use:\n1. Long press the view-once media\n2. Tap Reply\n3. Type `.vv2`"
                }, { quoted: m });
            }

            const quotedMsg = contextInfo.quotedMessage;
            let isViewOnce = false;
            let mediaMsg = null;
            let mediaType = null;

            if (quotedMsg.viewOnceMessage) {
                isViewOnce = true;
                mediaMsg = quotedMsg.viewOnceMessage.message?.imageMessage ||
                          quotedMsg.viewOnceMessage.message?.videoMessage ||
                          quotedMsg.viewOnceMessage.message?.audioMessage;
            }

            if (!mediaMsg && quotedMsg.viewOnceMessageV2) {
                isViewOnce = true;
                mediaMsg = quotedMsg.viewOnceMessageV2.message?.imageMessage ||
                          quotedMsg.viewOnceMessageV2.message?.videoMessage ||
                          quotedMsg.viewOnceMessageV2.message?.audioMessage;
            }

            if (!mediaMsg && quotedMsg.viewOnceMessageV2Extension) {
                isViewOnce = true;
                mediaMsg = quotedMsg.viewOnceMessageV2Extension.message?.imageMessage ||
                          quotedMsg.viewOnceMessageV2Extension.message?.videoMessage ||
                          quotedMsg.viewOnceMessageV2Extension.message?.audioMessage;
            }

            if (!mediaMsg && (quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage)) {
                if (quotedMsg.imageMessage?.viewOnce || quotedMsg.videoMessage?.viewOnce || quotedMsg.audioMessage?.viewOnce) {
                    isViewOnce = true;
                    mediaMsg = quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage;
                }
            }

            mediaType = mediaMsg?.mimetype?.includes('video') ? 'video' :
                        mediaMsg?.mimetype?.includes('audio') ? 'audio' : 'image';

            if (!isViewOnce || !mediaMsg) {
                return sock.sendMessage(m.chat, {
                    text: "❌ This is not a view-once message!\n\nMake sure you're replying to a view-once image, video or audio."
                }, { quoted: m });
            }

            const downloadType = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'image';
            const bufferStream = await downloadContentFromMessage(mediaMsg, downloadType);
            let dataBuffer = Buffer.from([]);
            for await (const chunk of bufferStream) {
                dataBuffer = Buffer.concat([dataBuffer, chunk]);
            }

            const targetChat = m.key?.participant || m.key?.remoteJid;
            const senderId = m.key?.participant || m.key?.remoteJid;
            const sendPayload = {};

            if (mediaType === 'video') {
                sendPayload.video = dataBuffer;
                sendPayload.caption = `✅ Revealed view-once video.`;
                sendPayload.mimetype = mediaMsg.mimetype || 'video/mp4';
            } else if (mediaType === 'audio') {
                sendPayload.audio = dataBuffer;
                sendPayload.mimetype = mediaMsg.mimetype || 'audio/mp4';
                sendPayload.ptt = false;
            } else {
                sendPayload.image = dataBuffer;
                sendPayload.caption = `✅ Revealed view-once image.`;
                sendPayload.mimetype = mediaMsg.mimetype || 'image/jpeg';
            }

            await sock.sendMessage(targetChat, sendPayload);

            if (targetChat !== m.chat) {
                const senderMention = formatMentionText(senderId, sock);
                await sock.sendMessage(m.chat, {
                    text: `✅ Revealed the view-once ${mediaType} and sent it to your DM, ${senderMention}.`,
                    mentions: buildMentionJids([senderId])
                }, { quoted: m });
            }

        } catch (err) {
            console.error("VV2 command error:", err);
            await sock.sendMessage(m.chat, {
                text: `❌ Failed to process view-once media.\n\nError: ${err.message}`
            }, { quoted: m });
        }
    }
};