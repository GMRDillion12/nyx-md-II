const isAdmin = require("../../lib/isAdmin");
const { normalizeJid, formatMentionText, buildMentionJids } = require("../../lib/mentions");
const { addMutedUser } = require("../../lib/database");

module.exports = {
    command: ['mute'],
    category: 'group',
    description: 'Mute user(s) so their messages are deleted, or close the group if no target is provided',
    usage: '.mute @user | .mute reply | .mute',
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
                text: '❌ Please make me an admin first so I can manage user mutes and group settings.'
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
                await sock.groupSettingUpdate(chat, 'announcement');
                await sock.sendMessage(chat, {
                    text: '🔒 Group closed successfully. Only admins can send messages now.'
                }, { quoted: m });
            } catch (error) {
                console.error('[mute] failed to close group:', error?.message || error);
                await sock.sendMessage(chat, {
                    text: `❌ Failed to close the group. ${error?.message || 'Please make sure I am an admin.'}`
                }, { quoted: m });
            }
            return;
        }

        const muted = [];
        const skipped = [];
        const botJid = normalizeJid(sock.user?.id || sock.user?.jid || '');

        for (const rawTarget of targets) {
            const targetJid = normalizeJid(rawTarget);
            if (!targetJid) continue;
            if (targetJid === botJid) {
                skipped.push(targetJid);
                continue;
            }
            const added = await addMutedUser(chat, targetJid);
            if (added) {
                muted.push(targetJid);
            }
        }

        if (muted.length === 0) {
            return sock.sendMessage(chat, {
                text: '❌ No valid user found to mute. Mention the user or reply to their message.'
            }, { quoted: m });
        }

        await sock.sendMessage(chat, {
            text: `🔇 Muted user(s): ${muted.map(jid => formatMentionText(jid, sock)).join(', ')}`,
            mentions: buildMentionJids(muted)
        }, { quoted: m });

        if (skipped.length > 0) {
            await sock.sendMessage(chat, {
                text: `⚠️ Skipped invalid target(s): ${skipped.map(jid => formatMentionText(jid, sock)).join(', ')}`,
                mentions: buildMentionJids(skipped)
            }, { quoted: m });
        }
    }
};