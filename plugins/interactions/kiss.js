const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["kiss"],
    category: "interactions",
    description: "Kiss someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "💋", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Mention or reply to someone to kiss them.\nExample: `.kiss @user`"
                }, { quoted: m });
            }

            const { buffer, mimetype } = await fetchGif('kiss');
            const caption = `💋 *${m.pushName || "Someone"}* kissed *@${target.split("@")[0]}*~`;

            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption,
                mentions: [target]
            }, { quoted: m });

        } catch (err) {
            console.error("Kiss error:", err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to kiss." }, { quoted: m });
        }
    }
};