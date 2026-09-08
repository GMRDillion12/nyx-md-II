const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["yeet"],
    category: "interactions",
    description: "Yeet someone",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "💨", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) return sock.sendMessage(m.chat, { text: "❌ Mention or reply to someone.\nExample: `.yeet @user`" }, { quoted: m });

            const { buffer, mimetype } = await fetchGif('yeet');
            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption: `💨 *${m.pushName || "Someone"}* yeeted *@${target.split("@")[0]}*!`,
                mentions: [target]
            }, { quoted: m });
        } catch (err) {
            console.error(err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to yeet." }, { quoted: m });
        }
    }
};