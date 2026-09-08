const { loadUserGroupData, saveUserGroupData } = require('../../lib/database');

async function getGhostStatusText(sock, chatId, data) {
  const groups = Object.entries(data.ghost || {}).filter(([, value]) => value && value.enabled !== false);

  if (!groups.length) {
    return '👻 *No groups are currently in ghost mode.*';
  }

  const lines = ['👻 *Ghosted Groups*'];

  for (const [groupId, setting] of groups) {
    if (!setting || setting.enabled === false) continue;

    let label = groupId;
    try {
      const metadata = await sock.groupMetadata(groupId).catch(() => null);
      if (metadata?.subject) {
        label = metadata.subject;
      }
    } catch (_error) {
      // ignore metadata lookup failures and keep the fallback ID
    }

    lines.push(`• ${label}`);
  }

  return lines.join('\n');
}

module.exports = {
  command: ['ghost'],
  category: 'owner',
  description: 'Toggle ghost mode for a group so the bot ignores commands there',
  usage: '.ghost <on/off/status/toggle>',
  ownerOnly: true,

  async execute(sock, m, args, config) {
    const chat = m.chat || m.key?.remoteJid;
    const isGroup = chat?.endsWith('@g.us');

    const option = (args || []).join(' ').trim().toLowerCase();
    const data = loadUserGroupData();
    data.ghost = data.ghost || {};
    const currentEnabled = Boolean(data.ghost[chat]?.enabled);

    if (!isGroup && option !== 'status') {
      return sock.sendMessage(chat, {
        text: '👻 *Ghost mode only works in groups.*'
      }, { quoted: m });
    }

    if (!option || option === 'status') {
      if (!isGroup) {
        const statusText = await getGhostStatusText(sock, chat, data);
        return sock.sendMessage(chat, {
          text: statusText
        }, { quoted: m });
      }

      if (!option) {
        return sock.sendMessage(chat, {
          text: `👻 *Ghost mode for this group:* ${currentEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\nUse:\n.ghost on\n.ghost off\n.ghost toggle\n.ghost status`
        }, { quoted: m });
      }

      const statusText = await getGhostStatusText(sock, chat, data);
      return sock.sendMessage(chat, {
        text: statusText
      }, { quoted: m });
    }

    if (option === 'on') {
      data.ghost[chat] = { enabled: true };
      saveUserGroupData(data);
      return sock.sendMessage(chat, {
        text: '👻 *Ghost mode enabled for this group.*\nThe bot will ignore command messages here until you turn it off.'
      }, { quoted: m });
    }

    if (option === 'off') {
      delete data.ghost[chat];
      saveUserGroupData(data);
      return sock.sendMessage(chat, {
        text: '👻 *Ghost mode disabled for this group.*\nCommands will work normally again.'
      }, { quoted: m });
    }

    if (option === 'toggle') {
      if (currentEnabled) {
        delete data.ghost[chat];
        saveUserGroupData(data);
        return sock.sendMessage(chat, {
          text: '👻 *Ghost mode toggled OFF.*\nCommands are active again in this group.'
        }, { quoted: m });
      }

      data.ghost[chat] = { enabled: true };
      saveUserGroupData(data);
      return sock.sendMessage(chat, {
        text: '👻 *Ghost mode toggled ON.*\nThe bot will ignore command messages here.'
      }, { quoted: m });
    }

    return sock.sendMessage(chat, {
      text: '❌ Invalid option. Use: .ghost on | off | toggle | status'
    }, { quoted: m });
  }
};
