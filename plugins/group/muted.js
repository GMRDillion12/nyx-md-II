const isAdmin = require("../../lib/isAdmin");
const { formatMentionText, buildMentionJids } = require("../../lib/mentions");
const { getMutedUsers } = require("../../lib/database");

module.exports = {
    command: ['muted'],
    category: 'group',
    description: 'Show the list of currently muted users in this group',
    usage: '.muted',
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
                text: '❌ Please make me an admin first so I can show muted users.'
            }, { quoted: m });
        }

        if (!isSenderAdmin) {
            return sock.sendMessage(chat, {
                text: '❌ Only group admins can view the muted users list.'
            }, { quoted: m });
        }

        const mutedUsers = await getMutedUsers(chat);

        if (!Array.isArray(mutedUsers) || mutedUsers.length === 0) {
            return sock.sendMessage(chat, {
                text: '✅ There are no muted users in this group.'
            }, { quoted: m });
        }

        const listText = mutedUsers
            .map((jid, index) => `${index + 1}. ${formatMentionText(jid, sock)}`)
            .join('\n');

        await sock.sendMessage(chat, {
            text: `🔇 *Muted users in this group:*

${listText}`,
            mentions: buildMentionJids(mutedUsers)
        }, { quoted: m });
    }
};
