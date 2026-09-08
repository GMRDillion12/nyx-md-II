const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["pat"],
    category: "interactions",
    description: "Pat someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "🖐️", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Mention or reply to someone to pat them.\nExample: `.pat @user`"
                }, { quoted: m });
            }

            const { buffer, mimetype } = await fetchGif('pat');
            const caption = `🖐️ *${m.pushName || "Someone"}* gently patted *@${target.split("@")[0]}*`;

            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption,
                mentions: [target]
            }, { quoted: m });

        } catch (err) {
            console.error("Pat error:", err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to pat." }, { quoted: m });
        }
    }
};