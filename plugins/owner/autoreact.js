const { load, save } = require('../../lib/autoReact');

module.exports = {
  command: ['autoreact'],
  category: 'owner',
  description: 'Configure automatic reactions to messages',
  usage: '.autoreact <on/off/set bot/set all>',
  ownerOnly: true,

  async execute(sock, m, args, config) {
    const chat = m.chat || m.key?.remoteJid;
    const isGroup = chat?.endsWith('@g.us');
    try {
      const option = args.join(' ').trim().toLowerCase();
      const db = load();
      db.groups = db.groups || {};
      const groupSettings = isGroup ? db.groups[chat] || null : null;
      const currentStatus = isGroup
        ? groupSettings
          ? `${groupSettings.enabled ? 'Enabled' : 'Disabled'} (${groupSettings.mode.toUpperCase()})`
          : `${db.enabled ? 'Enabled' : 'Disabled'} (Global ${db.mode.toUpperCase()})`
        : `${db.enabled ? 'Enabled' : 'Disabled'} (${db.mode.toUpperCase()})`;

      if (!option) {
        return sock.sendMessage(chat, {
          text: '📋 *Auto-React Options:*\n\n' +
                '• on - Enable auto-react\n' +
                '• off - Disable auto-react\n' +
                '• set bot - React only to bot commands\n' +
                '• set all - React to all messages\n\n' +
                `Current: ${currentStatus}`
        }, { quoted: m });
      }

      if (option === 'on') {
        if (isGroup) {
          db.groups[chat] = { enabled: true, mode: 'all' };
          save(db);
          return sock.sendMessage(chat, {
            text: '✅ Group auto-react enabled. Reacting to *ALL MESSAGES* in this group until you turn it off.'
          }, { quoted: m });
        }

        db.enabled = true;
        save(db);
        return sock.sendMessage(chat, {
          text: `✅ Auto-react enabled. Mode: ${db.mode.toUpperCase()}${db.mode === 'bot' ? ' (commands only)' : ' (all messages)'}.`
        }, { quoted: m });
      }

      if (option === 'off') {
        if (isGroup) {
          delete db.groups[chat];
          save(db);
          return sock.sendMessage(chat, {
            text: '❌ Group auto-react disabled for this group.'
          }, { quoted: m });
        }

        db.enabled = false;
        save(db);
        return sock.sendMessage(chat, {
          text: `❌ Auto-react disabled. Last mode was ${db.mode.toUpperCase()}. Use ".autoreact set all" to react to every message or ".autoreact set bot" for commands only.`
        }, { quoted: m });
      }

      if (option === 'set bot') {
        if (isGroup) {
          db.groups[chat] = { enabled: true, mode: 'bot' };
          save(db);
          return sock.sendMessage(chat, {
            text: '🤖 Group auto-react mode set to *BOT ONLY*\nReacting to commands only in this group.'
          }, { quoted: m });
        }

        db.mode = 'bot';
        save(db);
        return sock.sendMessage(chat, {
          text: '🤖 Auto-react mode set to *BOT ONLY*\nReacting to commands only.'
        }, { quoted: m });
      }

      if (option === 'set all') {
        if (isGroup) {
          db.groups[chat] = { enabled: true, mode: 'all' };
          save(db);
          return sock.sendMessage(chat, {
            text: '🌟 Group auto-react mode set to *ALL MESSAGES*\nReacting to all messages in this group.'
          }, { quoted: m });
        }

        db.mode = 'all';
        save(db);
        return sock.sendMessage(chat, {
          text: '🌟 Auto-react mode set to *ALL MESSAGES*\nReacting to all messages.'
        }, { quoted: m });
      }

      return sock.sendMessage(chat, {
        text: '❌ Invalid option. Use: on | off | set bot | set all'
      }, { quoted: m });
    } catch (err) {
      console.error('[autoreact cmd] error:', err);
      await sock.sendMessage(chat, {
        text: '❌ Error configuring auto-react.'
      }, { quoted: m });
    }
  }
};
