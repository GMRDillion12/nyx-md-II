const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["cuddle"],
    category: "interactions",
    description: "Cuddle someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "🥰", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Mention or reply to someone to cuddle them.\nExample: `.cuddle @user`"
                }, { quoted: m });
            }

            const { buffer, mimetype } = await fetchGif('cuddle');
            const caption = `🥰 *${m.pushName || "Someone"}* cuddled *@${target.split("@")[0]}* closely~`;

            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption,
                mentions: [target]
            }, { quoted: m });

        } catch (err) {
            console.error("Cuddle error:", err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to cuddle." }, { quoted: m });
        }
    }
};