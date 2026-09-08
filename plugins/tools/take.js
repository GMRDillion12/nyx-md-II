const { downloadMediaMessage, downloadContentFromMessage } = require('@whiskeysockets/baileys');

function sanitizePackName(value) {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  return cleaned || 'Nyx Bot';
}

module.exports = {
  command: ['take'],
  aliases: ['take'],
  category: 'tools',
  description: 'Copy sticker metadata from a replied sticker and resend it with a custom pack name',
  usage: '.take <packname>',

  async execute(sock, m, args, config) {
    const chat = m.chat || m.key?.remoteJid;
    try {
      // Prefer the normalized `m.quoted` object if present, fallback to raw context
      const quoted = m.quoted?.message || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted?.stickerMessage) {
        return await sock.sendMessage(chat, {
          text: '? Reply to a sticker with .take <packname>'
        }, { quoted: m });
      }

      const packname = sanitizePackName(args.join(' '));
      const authorName = config?.botName || 'Nyx MD';
      const messageToDownload = { message: quoted };

      // Attempt download with a small retry loop to handle transient 404s from WhatsApp CDN
      let stickerBuffer = null;
      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          stickerBuffer = await downloadMediaMessage(
            messageToDownload,
            'buffer',
            {},
            {
              logger: console,
              reuploadRequest: sock.updateMediaMessage
            }
          );
          if (stickerBuffer) break;
        } catch (err) {
          lastErr = err;
          // small backoff
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
      }

      // Fallback: try low-level stream downloader if normal helper failed
      if (!stickerBuffer) {
        try {
          const stream = await downloadContentFromMessage(quoted.stickerMessage || quoted, 'sticker');
          const parts = [];
          for await (const chunk of stream) parts.push(chunk);
          if (parts.length) stickerBuffer = Buffer.concat(parts);
        } catch (err2) {
          lastErr = lastErr || err2;
        }
      }

      if (!stickerBuffer) {
        console.error('[take] download failed after retries and fallback:', lastErr?.message || lastErr);
        return await sock.sendMessage(chat, {
          text: '? Failed to download the sticker. The media URL may have expired or is inaccessible. Ask the sender to resend the sticker or try again.'
        }, { quoted: m });
      }

      if (!stickerBuffer || stickerBuffer.length < 50) {
        return await sock.sendMessage(chat, {
          text: '? Failed to process the sticker bytes.'
        }, { quoted: m });
      }

      const mimeType = quoted?.stickerMessage?.mimetype || 'image/webp';
      const isAnimated = Boolean(quoted?.stickerMessage?.isAnimated || quoted?.stickerMessage?.isAnimatedSticker);

      await sock.sendMessage(chat, {
        sticker: stickerBuffer,
        mimetype: mimeType,
        ...(isAnimated ? { isAnimated: true } : {})
      }, { quoted: m });
    } catch (error) {
      console.error('Take command error:', error);
      await sock.sendMessage(chat, {
        text: '? Error processing the take command. Make sure you replied to a sticker.'
      }, { quoted: m });
    }
  }
};
