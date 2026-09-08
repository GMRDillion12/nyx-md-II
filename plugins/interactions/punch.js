const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["punch"],
    category: "interactions",
    description: "Punch someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "👊", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) {
                return sock.sendMessage(m.chat, {
                    text: "❌ Mention or reply to someone to punch them.\nExample: `.punch @user`"
                }, { quoted: m });
            }

            const { buffer, mimetype } = await fetchGif('punch');
            const caption = `👊 *${m.pushName || "Someone"}* punched *@${target.split("@")[0]}*!`;

            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption,
                mentions: [target]
            }, { quoted: m });

        } catch (err) {
            console.error("Punch error:", err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to punch." }, { quoted: m });
        }
    }
};