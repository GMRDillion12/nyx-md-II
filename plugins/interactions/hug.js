const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["hug"],
    category: "interactions",
    description: "Hug someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "🤗", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Mention or reply to someone to hug them.\nExample: `.hug @user`"
                }, { quoted: m });
            }

            const { buffer, mimetype } = await fetchGif('hug');
            const caption = `🤗 *${m.pushName || "Someone"}* hugged *@${target.split("@")[0]}* tightly~`;

            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption,
                mentions: [target]
            }, { quoted: m });

        } catch (err) {
            console.error("Hug error:", err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to hug." }, { quoted: m });
        }
    }
};