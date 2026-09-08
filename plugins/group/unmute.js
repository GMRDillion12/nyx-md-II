const { normalizeJid, formatMentionText, buildMentionJids } = require("../../lib/mentions");
const { removeMutedUser } = require("../../lib/database");
const isAdmin = require("../../lib/isAdmin");

module.exports = {
	command: ['unmute'],
	category: 'group',
	description: 'Unmute user(s) so their messages are allowed again, or open the group if no target is provided',
	usage: '.unmute @user | .unmute reply | .unmute',
	groupOnly: true,
	adminOnly: true,

	async execute(sock, m, args, config) {
		const chat = m.chat || m.key?.remoteJid;

		if (!chat || !chat.endsWith('@g.us')) {
			return sock.sendMessage(chat || m.key?.remoteJid, {
				text: '❌ This command can only be used in groups.'
			}, { quoted: m });
		}

        const senderId = m.key?.participant || m.key?.remoteJid || m.sender || '';
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chat, senderId);

        if (!isBotAdmin) {
            return sock.sendMessage(chat, {
                text: '❌ Please make me an admin first so I can manage user unmutes and group settings.'
            }, { quoted: m });
        }

        if (!isSenderAdmin) {
            return sock.sendMessage(chat, {
                text: '❌ Only group admins can use this command.'
            }, { quoted: m });
        }

		const mentionedJids = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
		const quotedSender = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;
		const targets = mentionedJids.length > 0
			? mentionedJids
			: quotedSender
				? [quotedSender]
				: [];

		if (targets.length === 0 && args.length > 0) {
			const numberOnly = args.join(' ').replace(/[^0-9]/g, '');
			if (numberOnly) {
				targets.push(`${numberOnly}@s.whatsapp.net`);
			}
		}

		if (targets.length === 0) {
			try {
				await sock.groupSettingUpdate(chat, 'not_announcement');
				await sock.sendMessage(chat, {
					text: '🔓 Group opened successfully. All participants can send messages now.'
				}, { quoted: m });
			} catch (error) {
				console.error('[unmute] failed to open group:', error?.message || error);
				await sock.sendMessage(chat, {
					text: `❌ Failed to open the group. ${error?.message || 'Please make sure I am an admin.'}`
				}, { quoted: m });
			}
			return;
		}

		const unmuted = [];
		const invalid = [];

		for (const rawTarget of targets) {
			const targetJid = normalizeJid(rawTarget);
			if (!targetJid) {
				invalid.push(rawTarget);
				continue;
			}

			const removed = await removeMutedUser(chat, targetJid);
			if (removed) {
				unmuted.push(targetJid);
			} else {
				invalid.push(targetJid);
			}
		}

		if (unmuted.length === 0) {
			return sock.sendMessage(chat, {
				text: '❌ No valid muted user found to unmute. Mention the user or reply to their message.'
			}, { quoted: m });
		}

		await sock.sendMessage(chat, {
			text: `🔊 Unmuted user(s): ${unmuted.map(jid => formatMentionText(jid, sock)).join(', ')}`,
			mentions: buildMentionJids(unmuted)
		}, { quoted: m });

		if (invalid.length > 0) {
			await sock.sendMessage(chat, {
				text: `⚠️ Could not unmute: ${invalid.map(jid => formatMentionText(jid, sock)).join(', ')}`,
				mentions: buildMentionJids(invalid.filter(Boolean))
			}, { quoted: m });
		}
	}
};
