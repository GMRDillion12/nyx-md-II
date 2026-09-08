const isAdmin = require('../../lib/isAdmin');

module.exports = {
  command: ['link', 'gclink'],
  category: 'group',
  description: 'Get the invite link for the current group',
  groupOnly: true,

  async execute(sock, m) {
    const chat = m.chat;

    if (!chat || !chat.endsWith('@g.us')) {
      return sock.sendMessage(chat || m.key?.remoteJid, {
        text: '❌ This command can only be used in groups.'
      }, { quoted: m });
    }

    try {
      const senderRaw = m.key?.participant || m.key?.remoteJid || m.sender || '';
      const sender = senderRaw.toString();
      const { isBotAdmin } = await isAdmin(sock, chat, sender);

      if (!isBotAdmin) {
        return sock.sendMessage(chat, {
          text: '❌ I need to be an admin to fetch the group invite link.'
        }, { quoted: m });
      }

      const inviteCode = await sock.groupInviteCode(chat);
      const inviteLink = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : '';

      if (!inviteLink) {
        return sock.sendMessage(chat, {
          text: '❌ No invite link is available for this group yet.'
        }, { quoted: m });
      }

      return sock.sendMessage(chat, {
        text: `🔗 Group invite link:\n${inviteLink}`
      }, { quoted: m });
    } catch (error) {
      console.error('[link.execute]', error);
      const message = String(error?.message || '').toLowerCase();
      const fallbackText = message.includes('not-authorized') || message.includes('not admin') || message.includes('403')
        ? '❌ I need to be an admin to fetch the group invite link.'
        : '❌ I could not fetch the group invite link right now.';

      return sock.sendMessage(chat, {
        text: fallbackText
      }, { quoted: m });
    }
  }
};
