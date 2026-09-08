const nsfwAuth = require('../../lib/nsfwAuth');
const { extractPhoneNumber } = require('../../lib/isOwner');
const { normalizeJid } = require('../../lib/mentions');

module.exports = {
    command: ['npass'],
    aliases: ['nsfwpass'],
    category: 'tools',
    description: 'Register for NSFW commands',
    usage: '.npass register <password> \n.npass status \n.npass unregister',
    ownerOnly: false,

    async execute(sock, m, args, config) {
        try {
            const chat = m.chat || m.key?.remoteJid;
            const sender = normalizeJid(m.key?.participant || m.key?.remoteJid || m.sender || '');
            const text = (m.text || m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
            const sub = (args[0] || '').toLowerCase();
            const rest = args.slice(1).join(' ').trim();
            const ownerNumbers = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber];
            const senderPhone = extractPhoneNumber(sender);
            const ownerPhones = ownerNumbers.map(n => extractPhoneNumber(n)).filter(Boolean);
            const isOwner = senderPhone && ownerPhones.includes(senderPhone);

            if (sub === 'register') {
                if (!rest) return sock.sendMessage(chat, { text: '❌ Usage: .npass register <password>' }, { quoted: m });
                const ok = await nsfwAuth.register(sender, rest);
                if (ok) {
                    return sock.sendMessage(chat, { text: '✅ Password registered successfully. You can now use NSFW commands.' }, { quoted: m });
                }
                return sock.sendMessage(chat, { text: '❌ Wrong password. Please try again.' }, { quoted: m });
            }

            if (sub === 'status') {
                const registered = await nsfwAuth.isRegistered(sender);
                return sock.sendMessage(chat, { text: `🔐 NSFW registration status:\n• Registered: ${registered ? 'Yes' : 'No'}${isOwner ? '\n• Owner bypass enabled' : ''}` }, { quoted: m });
            }

            if (sub === 'unregister') {
                const removed = await nsfwAuth.unregister(sender);
                return sock.sendMessage(chat, { text: removed ? '✅ You have been unregistered from NSFW access.' : 'ℹ️ You were not registered.' }, { quoted: m });
            }

            if (['list', 'revoke', 'changepass'].includes(sub)) {
                return sock.sendMessage(chat, { text: '❌ These commands are owner-only. Use .nsettings list | .nsettings revoke | .nsettings changepass instead.' }, { quoted: m });
            }

            return sock.sendMessage(chat, { text: 'Usage: .npass register <password> | .npass status | .npass unregister' }, { quoted: m });
        } catch (err) {
            console.error('npass error', err);
            await sock.sendMessage(m.chat || m.key?.remoteJid, { text: '❌ Internal NSFW password error.' }, { quoted: m });
        }
    }
};
