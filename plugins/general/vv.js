const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    command: ["vv"],
    category: "general",
    description: "Reveal and re-send view-once image, video or audio",

    async execute(sock, m, args, config) {
        try {
            // Get the raw quoted message from contextInfo
            const contextInfo = m.message?.extendedTextMessage?.contextInfo;
            
            if (!contextInfo?.quotedMessage) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Please reply to a view-once image, video or audio!\n\nHow to use:\n1. Long press the view-once media\n2. Tap Reply\n3. Type `.vv`"
                }, { quoted: m });
            }

            const quotedMsg = contextInfo.quotedMessage;
            console.log('[vv] Quoted message keys:', Object.keys(quotedMsg));

            // Check if it's view-once - check all possible locations
            let isViewOnce = false;
            let mediaMsg = null;
            let mediaType = null;

            // Check viewOnceMessage (standard)
            if (quotedMsg.viewOnceMessage) {
                isViewOnce = true;
                mediaMsg = quotedMsg.viewOnceMessage.message?.imageMessage || 
                          quotedMsg.viewOnceMessage.message?.videoMessage ||
                          quotedMsg.viewOnceMessage.message?.audioMessage;
                mediaType = mediaMsg?.mimetype?.includes('video') ? 'video' : 
                           mediaMsg?.mimetype?.includes('audio') ? 'audio' : 'image';
            }
            
            // Check viewOnceMessageV2
            if (!mediaMsg && quotedMsg.viewOnceMessageV2) {
                isViewOnce = true;
                mediaMsg = quotedMsg.viewOnceMessageV2.message?.imageMessage || 
                          quotedMsg.viewOnceMessageV2.message?.videoMessage ||
                          quotedMsg.viewOnceMessageV2.message?.audioMessage;
                mediaType = mediaMsg?.mimetype?.includes('video') ? 'video' : 
                           mediaMsg?.mimetype?.includes('audio') ? 'audio' : 'image';
            }

            // Check viewOnceMessageV2Extension
            if (!mediaMsg && quotedMsg.viewOnceMessageV2Extension) {
                isViewOnce = true;
                mediaMsg = quotedMsg.viewOnceMessageV2Extension.message?.imageMessage || 
                          quotedMsg.viewOnceMessageV2Extension.message?.videoMessage ||
                          quotedMsg.viewOnceMessageV2Extension.message?.audioMessage;
                mediaType = mediaMsg?.mimetype?.includes('video') ? 'video' : 
                           mediaMsg?.mimetype?.includes('audio') ? 'audio' : 'image';
            }

            // Also check if it's a direct image/video/audio message (some view-once formats)
            if (!mediaMsg && (quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage)) {
                // Check if it has viewOnce field
                if (quotedMsg.imageMessage?.viewOnce || quotedMsg.videoMessage?.viewOnce || quotedMsg.audioMessage?.viewOnce) {
                    isViewOnce = true;
                    mediaMsg = quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage;
                    mediaType = mediaMsg?.mimetype?.includes('video') ? 'video' : 
                               mediaMsg?.mimetype?.includes('audio') ? 'audio' : 'image';
                }
            }

            console.log('[vv] isViewOnce:', isViewOnce, 'mediaType:', mediaType);

            if (!isViewOnce || !mediaMsg) {
                return sock.sendMessage(m.chat, {
                    text: "❌ This is not a view-once message!\n\nMake sure you're replying to a view-once image, video or audio."
                }, { quoted: m });
            }

            // Download the media
            const downloadType = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'image';
            console.log('[vv] Downloading as:', downloadType);
            
            const buffer = await downloadContentFromMessage(mediaMsg, downloadType);

            let dataBuffer = Buffer.from([]);
            for await (const chunk of buffer) {
                dataBuffer = Buffer.concat([dataBuffer, chunk]);
            }

            console.log('[vv] Downloaded buffer size:', dataBuffer.length);

            const caption = `✅ View-once ${mediaType} revealed!`;

            // Send as normal media based on type
            if (mediaType === 'video') {
                await sock.sendMessage(m.chat, {
                    video: dataBuffer,
                    caption: caption,
                    mimetype: mediaMsg.mimetype || "video/mp4"
                }, { quoted: m });
            } else if (mediaType === 'audio') {
                await sock.sendMessage(m.chat, {
                    audio: dataBuffer,
                    mimetype: mediaMsg.mimetype || "audio/mp4",
                    caption: caption
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, {
                    image: dataBuffer,
                    caption: caption,
                    mimetype: mediaMsg.mimetype || "image/jpeg"
                }, { quoted: m });
            }

            // Success reaction
            await sock.sendMessage(m.chat, {
                react: { text: "✅", key: m.key }
            });

        } catch (err) {
            console.error("VV command error:", err);
            await sock.sendMessage(m.chat, {
                text: `❌ Failed to process view-once media.\n\nError: ${err.message}`
            }, { quoted: m });
        }
    }
};
