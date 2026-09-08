const nsfwAuth = require('../../lib/nsfwAuth');
const { extractPhoneNumber } = require('../../lib/isOwner');
const { normalizeJid, formatMentionText, buildMentionJids } = require('../../lib/mentions');

function getOwnerNumbers(config) {
    const configured = Array.isArray(config?.ownerNumber) ? config.ownerNumber : [config?.ownerNumber];
    return configured
        .map(item => (item || '').toString().trim())
        .filter(Boolean);
}

function isSenderOwnerStrict(sock, m, config) {
    const ownerNumbers = getOwnerNumbers(config).map(n => extractPhoneNumber(n)).filter(Boolean);
    const senderCandidates = [
        normalizeJid(m?.key?.participant || m?.key?.remoteJid || m?.sender || ''),
        normalizeJid(m?.message?.extendedTextMessage?.contextInfo?.participant || ''),
        normalizeJid(m?.key?.remoteJid || ''),
        normalizeJid(sock?.user?.id || ''),
        normalizeJid(sock?.user?.jid || ''),
    ].filter(Boolean);

    if (m?.key?.fromMe && sock?.user?.id) {
        const botPhone = extractPhoneNumber(sock.user.id);
        if (botPhone && ownerNumbers.includes(botPhone)) {
            return true;
        }
    }

    return senderCandidates.some(candidate => {
        const senderPhone = extractPhoneNumber(candidate);
        return senderPhone && ownerNumbers.includes(senderPhone);
    });
}

function resolveTargetJid(m, targetArg) {
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length > 0) {
        return normalizeJid(mentioned[0]);
    }

    const quoted = m.quoted?.sender || m.quoted?.participant || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;
    if (quoted) {
        return normalizeJid(quoted);
    }

    if (targetArg) {
        const phoneMatch = targetArg.match(/(\d{6,15})/);
        if (phoneMatch) {
            return `${phoneMatch[1]}@s.whatsapp.net`;
        }
        return normalizeJid(targetArg);
    }

    return null;
}

module.exports = {
    command: ['nsettings'],
    aliases: ['nsfwsettings'],
    category: 'owner',
    description: 'Manage NSFW password access and registered users',
    usage: '.nsettings list | .nsettings revoke <user> | .nsettings changepass <newpassword>',
    ownerOnly: true,
    groupOnly: false,

    async execute(sock, m, args, config) {
        try {
            const chat = m.chat || m.key?.remoteJid;
            const sender = normalizeJid(m.key?.participant || m.key?.remoteJid || m.sender || '');
            const sub = (args[0] || '').toLowerCase();
            const rest = args.slice(1).join(' ').trim();
            const isOwner = isSenderOwnerStrict(sock, m, config);

            if (!isOwner) {
                return sock.sendMessage(chat, { text: '❌ Only the bot owner can use this command.' }, { quoted: m });
            }

            if (sub === 'list') {
                const entries = nsfwAuth.getRegisteredUsers();
                if (!entries.length) {
                    return sock.sendMessage(chat, { text: 'ℹ️ There are no registered NSFW users.' }, { quoted: m });
                }
                const listText = entries.map((jid, index) => `${index + 1}. ${formatMentionText(jid, sock)}`).join('\n');
                return sock.sendMessage(chat, {
                    text: `🔐 NSFW registered users:\n\n${listText}`,
                    mentions: buildMentionJids(entries)
                }, { quoted: m });
            }

            if (sub === 'revoke') {
                if (!isOwner) {
                    return sock.sendMessage(chat, { text: '❌ Only the owner can revoke NSFW access.' }, { quoted: m });
                }
                const targetJid = resolveTargetJid(m, rest);
                if (!targetJid) {
                    return sock.sendMessage(chat, { text: '❌ Usage: .nsettings revoke <@user|number|reply>' }, { quoted: m });
                }
                const removed = await nsfwAuth.unregister(targetJid);
                return sock.sendMessage(chat, {
                    text: removed ? `✅ Revoked NSFW access for ${formatMentionText(targetJid, sock)}.` : 'ℹ️ That user was not registered for NSFW access.',
                    mentions: removed ? buildMentionJids([targetJid]) : []
                }, { quoted: m });
            }

            if (sub === 'changepass') {
                if (!isOwner) {
                    return sock.sendMessage(chat, { text: '❌ Only the owner can change the NSFW password.' }, { quoted: m });
                }
                if (!rest) {
                    return sock.sendMessage(chat, { text: '❌ Usage: .nsettings changepass <new-password>' }, { quoted: m });
                }
                await nsfwAuth.changePassword(rest);
                return sock.sendMessage(chat, { text: '✅ NSFW password changed and all previous registrations have been revoked.' }, { quoted: m });
            }

            return sock.sendMessage(chat, { text: 'Usage: .nsettings list | .nsettings revoke <user> | .nsettings changepass <newpassword>' }, { quoted: m });
        } catch (err) {
            console.error('npass error', err);
            await sock.sendMessage(m.chat || m.key?.remoteJid, { text: '❌ Internal NSFW password error.' }, { quoted: m });
        }
    }
};
