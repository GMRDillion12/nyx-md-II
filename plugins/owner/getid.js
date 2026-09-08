const { formatMentionText, normalizeJid, buildMentionJids, getContactName } = require('../../lib/mentions');
const { extractPhoneNumber } = require('../../lib/isOwner');

module.exports = {
    command: ['getid'],
    category: 'owner',
    description: 'Show raw JID, normalized JID and numeric ID for a user; list group members',
    usage: '.getid [all|<@user|number>]',
    ownerOnly: true,

    async execute(sock, m, args, config) {
        try {
            const chat = m.chat || m.key?.remoteJid;
            if (!chat) return;

            const isGroup = (chat || '').endsWith('@g.us');

            const text = (m.text || m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
            const parts = text.split(/\s+/).slice(1);
            const arg = (parts[0] || '').toLowerCase();

            // Helper to build info block for a single JID
            const buildInfo = (rawJid) => {
                const raw = String(rawJid || '').trim();
                const norm = normalizeJid(raw) || '';
                const id = extractPhoneNumber(raw) || extractPhoneNumber(norm) || '';
                const display = getContactName(sock, norm) || '';
                return { raw, normalized: norm, id, display };
            };

            // If group and requested all members
            if (isGroup && arg === 'all') {
                const meta = await sock.groupMetadata(chat);
                const parts = meta?.participants || [];
                if (!parts.length) return sock.sendMessage(chat, { text: 'No participants found in this group.' }, { quoted: m });

                const members = parts.map((p, i) => {
                    const pj = (p.id || p.jid || '').toString();
                    const info = buildInfo(pj);
                    return `${i + 1}. ${formatMentionText(info.normalized || info.raw, sock)}\n   • raw: ${info.raw}\n   • normalized: ${info.normalized}\n   • id: ${info.id}`;
                });

                const body = `👥 Group members (${members.length}):\n\n` + members.join('\n\n');
                const mentionJids = parts.map(p => (p.id || p.jid || '')).filter(Boolean);
                return sock.sendMessage(chat, { text: body, mentions: buildMentionJids(mentionJids) }, { quoted: m });
            }

            // Resolve single target: prefer mention, then quoted, then arg number/raw, then fallback to sender
            let target = null;

            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || m.mentionedJid || [];
            if (mentioned && mentioned.length) target = mentioned[0];

            if (!target && m.quoted) {
                target = m.quoted?.sender || m.quoted?.participant || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;
            }

            if (!target && arg && arg !== '') {
                // try to parse plain number
                const numMatch = arg.match(/(\d{6,15})/);
                if (numMatch) target = `${numMatch[1]}@s.whatsapp.net`;
                else target = arg; // allow raw jid
            }

            if (!target) {
                // fallback to sender
                target = m.key?.participant || m.key?.remoteJid || m.sender || '';
            }

            const info = buildInfo(target);
            const contactName = info.display || '';
            const out = `🔎 User info:\n\n• Raw JID: ${info.raw}\n• Normalized JID: ${info.normalized}\n• Numeric ID: ${info.id}${contactName ? `\n• Name: ${contactName}` : ''}`;

            await sock.sendMessage(chat, { text: out, mentions: buildMentionJids([info.normalized || info.raw]) }, { quoted: m });

        } catch (err) {
            console.error('getid error', err);
            await sock.sendMessage(m.chat || m.key?.remoteJid, { text: '❌ Error retrieving ID info.' }, { quoted: m });
        }
    }
};
