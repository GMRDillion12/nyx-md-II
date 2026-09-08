const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["slap"],
    category: "interactions",
    description: "Slap someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "👋", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Mention or reply to someone to slap them.\nExample: `.slap @user`"
                }, { quoted: m });
            }

            const { buffer, mimetype } = await fetchGif('slap');
            const caption = `👋 *${m.pushName || "Someone"}* slapped *@${target.split("@")[0]}* hard!`;

            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption,
                mentions: [target]
            }, { quoted: m });

        } catch (err) {
            console.error("Slap error:", err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to slap." }, { quoted: m });
        }
    }
};