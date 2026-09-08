const { addSudo, removeSudo, getSudoList } = require('../../lib/database');
const { extractPhoneNumber } = require('../../lib/isOwner');
const { formatMentionText, buildMentionJids } = require('../../lib/mentions');

function normalizeJid(jid) {
    if (!jid) return null;
    const raw = String(jid).trim();
    const digits = extractPhoneNumber(raw);
    if (digits) return `${digits}@s.whatsapp.net`;
    // fallback: if it's already a JID-like string, strip device suffix
    if (raw.includes('@')) return raw.split(':')[0];
    return null;
}

function resolveSender(m, sock) {
    if (!m) return null;
    if (m.key?.fromMe && sock?.user) {
        return normalizeJid(sock.user.id || sock.user.jid || '');
    }

    const candidate =
        m.key?.participantAlt ||
        m.key?.remoteJidAlt ||
        m.key?.participant ||
        m.participant ||
        m.message?.extendedTextMessage?.contextInfo?.participant ||
        m.message?.sender ||
        m.sender ||
        m.key?.remoteJid ||
        '';

    return normalizeJid(candidate) || normalizeJid(extractPhoneNumber(candidate));
}

function getOwnerSets(ownerNumbers) {
    const list = Array.isArray(ownerNumbers) ? ownerNumbers : [ownerNumbers];
    const ownerRawList = list
        .map(item => (item || '').toString().trim())
        .filter(Boolean);

    const ownerPhoneSet = new Set(
        ownerRawList
            .map(extractPhoneNumber)
            .filter(Boolean)
    );

    const ownerVariantSet = new Set([
        ...ownerRawList,
        ...[...ownerPhoneSet].map(phone => `${phone}@s.whatsapp.net`)
    ].filter(Boolean));

    return { ownerPhoneSet, ownerVariantSet };
}

function isRealOwner(senderId, configOwnerNumbers) {
    if (!senderId) return false;
    const { ownerPhoneSet, ownerVariantSet } = getOwnerSets(configOwnerNumbers);
    const senderPhone = extractPhoneNumber(senderId);
    return ownerVariantSet.has(senderId) || (senderPhone && ownerPhoneSet.has(senderPhone));
}

function extractMentionedJid(message) {
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length > 0) return normalizeJid(mentioned[0]);

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const match = text.match(/\b(\d{7,15})\b/);
    if (match) return normalizeJid(match[1]);
    return null;
}

module.exports = {
    command: ['sudo'],
    category: 'owner',
    description: 'Manage sudo users who can act like owner',
    usage: '.sudo <add|del|remove|list> <@user|number|all>',
    ownerOnly: false,

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;
        const senderId = resolveSender(m, sock);
        const currentOwnerJid = normalizeJid(config.ownerNumber?.[0] || config.ownerNumber);

        const sudoList = await getSudoList();
        const normalizedSudoList = [...new Set(sudoList.map(normalizeJid).filter(Boolean))];

        const isOwnerSender = isRealOwner(senderId, config.ownerNumber);
        const isSudo = senderId ? normalizedSudoList.includes(senderId) : false;
        const canManageSudo = isOwnerSender;
        const canListSudo = isOwnerSender || isSudo;

        const sub = (args && args.length > 0) ? args[0].toLowerCase() : null;
        const allowedActions = ['add', 'del', 'remove', 'list'];

        if (!sub || !allowedActions.includes(sub)) {
            return sock.sendMessage(chat, {
                text: 'Usage:\n.sudo add <@user|number>\n.sudo del <@user|number>\n.sudo list'
            }, { quoted: m });
        }

        if (sub === 'list') {
            if (!canListSudo) {
                return sock.sendMessage(chat, { text: '❌ Only owner and sudo can view the sudo list.' }, { quoted: m });
            }

                if (normalizedSudoList.length === 0) {
                    return sock.sendMessage(chat, { text: 'No sudo users set.' }, { quoted: m });
                }

                const listText = normalizedSudoList.map((j, i) => `${i + 1}. ${formatMentionText(j, sock)}`).join('\n');
                return sock.sendMessage(chat, { text: `Sudo users:\n${listText}`, mentions: buildMentionJids(normalizedSudoList) }, { quoted: m });
        }

        if (!canManageSudo) {
            return sock.sendMessage(chat, { text: '❌ Only the real owner can add or remove sudo users. Use .sudo list to view.' }, { quoted: m });
        }

        const targetArg = args.slice(1).join(' ').trim();
        const isRemoveAll = targetArg.toLowerCase() === 'all';
        const targetJid = isRemoveAll ? null : extractMentionedJid(m) || normalizeJid(targetArg);

        if (isRemoveAll) {
            if (normalizedSudoList.length === 0) {
                return sock.sendMessage(chat, { text: 'ℹ️ There are no sudo users to remove.' }, { quoted: m });
            }

            for (const sudoJid of normalizedSudoList) {
                await removeSudo(sudoJid);
            }

            return sock.sendMessage(chat, { text: `✅ Removed all sudo users. Total cleared: ${normalizedSudoList.length}` }, { quoted: m });
        }

        if (!targetJid) {
            return sock.sendMessage(chat, { text: '❌ Please mention a user, provide a number, or use `all`.' }, { quoted: m });
        }

        if ((sub === 'del' || sub === 'remove') && targetJid === currentOwnerJid) {
            return sock.sendMessage(chat, { text: '❌ Owner cannot be removed.' }, { quoted: m });
        }

        if (sub === 'add') {
            if (targetJid === currentOwnerJid) {
                return sock.sendMessage(chat, { text: '❌ That user is already the owner.' }, { quoted: m });
            }

            const ok = await addSudo(targetJid);
            if (ok) {
                return sock.sendMessage(chat, { text: `✅ Added sudo: ${formatMentionText(targetJid, sock)}`, mentions: buildMentionJids([targetJid]) }, { quoted: m });
            }
            return sock.sendMessage(chat, { text: '❌ That user is already a sudo.' }, { quoted: m });
        }

        if (sub === 'del' || sub === 'remove') {
            const ok = await removeSudo(targetJid);
            return sock.sendMessage(chat, { text: ok ? `✅ Removed sudo: ${formatMentionText(targetJid, sock)}` : '❌ That user is not a sudo.', mentions: ok ? buildMentionJids([targetJid]) : [] }, { quoted: m });
        }
    }
};
