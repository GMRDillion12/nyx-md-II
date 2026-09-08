const { fetchGif } = require('./fetchGif');

module.exports = {
    command: ["kill"],
    category: "interactions",
    description: "Kill someone (fun)",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, { react: { text: "☠️", key: m.key } });

            let target = null;
            if (m.mentionedJid?.length) target = m.mentionedJid[0];
            else if (m.quoted?.sender) target = m.quoted.sender;

            if (!target) return sock.sendMessage(m.chat, { text: "❌ Mention or reply to someone.\nExample: `.kill @user`" }, { quoted: m });

            const { buffer, mimetype } = await fetchGif('kill');
            await sock.sendMessage(m.chat, {
                video: buffer, mimetype,
                gifPlayback: true,
                caption: `☠️ *${m.pushName || "Someone"}* killed *@${target.split("@")[0]}*!`,
                mentions: [target]
            }, { quoted: m });
        } catch (err) {
            console.error(err);
            await sock.sendMessage(m.chat, { text: "❌ Failed to kill." }, { quoted: m });
        }
    }
};