const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["lewd"],
    category: "interactions",
    description: "Be lewd with someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "😏", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Mention or reply to someone.\nExample: `.lewd @user`"
                }, { quoted: m });
            }

            const { buffer, mimetype, mediaType } = await fetchGif('lewd');
            const caption = `😏 *${m.pushName || "Someone"}* is being lewd with *@${target.split("@")[0]}*`;

            const payload = mediaType === 'image'
                ? { image: buffer, mimetype, caption, mentions: [target] }
                : { video: buffer, mimetype, gifPlayback: true, caption, mentions: [target] };

            await sock.sendMessage(m.chat, payload, { quoted: m });
        } catch (err) {
            console.error("Lewd error:", err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to send lewd interaction." }, { quoted: m });
        }
    }
};
