const database = require('../../lib/database');

module.exports = {
	command: ['autosticker'],
	category: 'group',
	description: 'Enable or disable auto-sticker conversion (images/videos become stickers)',
	usage: '.autosticker <on/off>',
	groupOnly: true,
	adminOnly: true,

	async execute(sock, m, args, config) {
		try {
			const chat = m.chat || m.key?.remoteJid;
			if (!chat || !chat.endsWith('@g.us')) {
				return sock.sendMessage(chat || m.key?.remoteJid, { text: '❌ This command can only be used in groups.' }, { quoted: m });
			}

			const settings = database.getGroupSettings(chat) || {};

			if (!args || !args[0]) {
				const status = settings.autosticker ? 'ON' : 'OFF';
				return sock.sendMessage(chat, {
					text: `📌 AutoSticker Status\n\nStatus: *${status}*\n\nWhen enabled, images and videos sent in this group will automatically be converted to stickers.\n\nUsage:\n  .autosticker on\n  .autosticker off`
				}, { quoted: m });
			}

			const opt = String(args[0]).toLowerCase();
			if (opt === 'on') {
				if (settings.autosticker) return sock.sendMessage(chat, { text: '*AutoSticker is already ON*' }, { quoted: m });
				database.updateGroupSettings(chat, { autosticker: true });
				return sock.sendMessage(chat, { text: '✅ *AutoSticker has been turned ON*\nAll images and videos will now automatically be converted to stickers!' }, { quoted: m });
			}

			if (opt === 'off') {
				if (!settings.autosticker) return sock.sendMessage(chat, { text: '*AutoSticker is already OFF*' }, { quoted: m });
				database.updateGroupSettings(chat, { autosticker: false });
				return sock.sendMessage(chat, { text: '❌ *AutoSticker has been turned OFF*' }, { quoted: m });
			}

			return sock.sendMessage(chat, { text: '❌ Invalid option!\nUsage: .autosticker <on/off>' }, { quoted: m });
		} catch (err) {
			console.error('[autosticker.command] error:', err);
			return sock.sendMessage(m.chat || m.key?.remoteJid, { text: '❌ Error updating autosticker setting.' }, { quoted: m });
		}
	}
};

