const { getGroupSettings } = require('../../lib/database');
const { setAutoApproveStatus, processExistingRequests } = require('../../lib/autoapprove');

module.exports = {
    command: ['autoapprove'],
    category: 'group',
    description: 'Toggle auto-approve for pending group join requests',
    usage: '.autoapprove <on|off|status>',
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args) {
        const chat = m.chat || m.key?.remoteJid;
        if (!chat || !chat.endsWith('@g.us')) {
            return sock.sendMessage(chat || m.key?.remoteJid, { text: '❌ This command can only be used in groups.' }, { quoted: m });
        }

        const sub = (args && args.length > 0) ? args[0].toLowerCase() : null;
        if (!sub || !['on','off','status'].includes(sub)) {
            return sock.sendMessage(chat, { text: 'Usage:\n.autoapprove on\n.autoapprove off\n.autoapprove status' }, { quoted: m });
        }

        if (sub === 'status') {
            const settings = getGroupSettings(chat);
            const enabled = settings?.autoApprove || false;
            return sock.sendMessage(chat, { text: `Auto-approve is ${enabled ? 'ENABLED' : 'DISABLED'} for this group.` }, { quoted: m });
        }

        const enable = sub === 'on';
        setAutoApproveStatus(chat, enable);

        if (enable) {
            const result = await processExistingRequests(sock, chat);
            return sock.sendMessage(chat, {
                text: `✅ Auto-approve has been ENABLED for this group.\n` +
                      `Pending requests scanned: ${result.pending}\n` +
                      `Accepted: ${result.accepted}\n` +
                      `Failed: ${result.failed}`
            }, { quoted: m });
        }

        return sock.sendMessage(chat, { text: `✅ Auto-approve has been DISABLED for this group.` }, { quoted: m });
    }
};
