const { fetchGif } = require('./fetchGif');

module.exports = {
	command: ["shrug"],
	category: "interactions",
	description: "Shrug at someone",

	async execute(sock, m, args, config) {
		try {
			await sock.sendMessage(m.chat, { react: { text: "🤷", key: m.key } });

			let target = null;
			if (m.mentionedJid?.length) target = m.mentionedJid[0];
			else if (m.quoted?.sender) target = m.quoted.sender;

			if (!target) return sock.sendMessage(m.chat, { text: "❌ Mention or reply to someone.\nExample: `.shrug @user`" }, { quoted: m });

			const { buffer, mimetype } = await fetchGif('shrug');

			await sock.sendMessage(m.chat, {
				video: buffer, mimetype,
				gifPlayback: true,
				caption: `🤷 *${m.pushName || "Someone"}* shrugged at *@${target.split("@")[0]}*`,
				mentions: [target]
			}, { quoted: m });

		} catch (err) {
			console.error("Shrug error:", err);
			await sock.sendMessage(m.chat, { text: "❌ Failed to shrug." }, { quoted: m });
		}
	}
};
