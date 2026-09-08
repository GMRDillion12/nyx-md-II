const isAdmin = require('../../lib/isAdmin');

module.exports = {
  command: ['resetlink'],
  category: 'group',
  description: 'Reset the group invite link',
  groupOnly: true,
  adminOnly: true,

  async execute(sock, m, args, config) {
    const chat = m.chat || m.key?.remoteJid;
    if (!chat || !chat.endsWith('@g.us')) {
      return sock.sendMessage(chat || m.key?.remoteJid, {
        text: '❌ This command can only be used in groups.'
      }, { quoted: m });
    }

    const senderRaw = m.key?.participant || m.key?.remoteJid || m.sender || '';
    const sender = senderRaw.toString();

    try {
      const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chat, sender);

      if (!isSenderAdmin) {
        return sock.sendMessage(chat, {
          text: '❌ Only group admins can use this command.'
        }, { quoted: m });
      }

      if (!isBotAdmin) {
        return sock.sendMessage(chat, {
          text: '❌ I need to be an admin to reset the group link.'
        }, { quoted: m });
      }

      const revokeResult = await sock.groupRevokeInvite(chat);
      let inviteCode = '';

      if (typeof revokeResult === 'string') {
        inviteCode = revokeResult;
      } else if (revokeResult && typeof revokeResult === 'object') {
        inviteCode = revokeResult.inviteCode || revokeResult.code || revokeResult.groupInviteCode || revokeResult.id || '';
      }

      if (!inviteCode) {
        try {
          inviteCode = await sock.groupInviteCode(chat);
        } catch (fallbackError) {
          console.warn('resetlink: fallback groupInviteCode failed', fallbackError);
        }
      }

      const replyText = inviteCode
        ? `✅ Group link reset successfully.\n\n📌 New link:\nhttps://chat.whatsapp.com/${inviteCode}`
        : '✅ Group link reset successfully.\n\n⚠️ The link was reset, but I could not retrieve the new invite code automatically. Please open group settings to view the new invite link.';

      return sock.sendMessage(chat, { text: replyText }, { quoted: m });
    } catch (error) {
      console.error('ResetLink command error:', error);

      let errorMessage = '❌ Failed to reset the group link.';
      const lower = String(error?.message || '').toLowerCase();

      if (lower.includes('not-authorized') || lower.includes('403')) {
        errorMessage = '❌ I do not have permission to reset the group link. Please make me an admin and try again.';
      }

      return sock.sendMessage(chat, {
        text: errorMessage
      }, { quoted: m });
    }
  }
};
