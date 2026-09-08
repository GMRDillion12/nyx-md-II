// Plugin command: accept pending group join requests in bulk
module.exports = {
    command: ['accept'],
    category: 'group',
    description: 'Accept pending group join requests with optional limit or status',
    usage: '.accept [status|<number>]',
    groupOnly: true,
    adminOnly: true,

    execute: async function (sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;
        if (!chat || !chat.endsWith('@g.us')) {
            return sock.sendMessage(chat || m.key?.remoteJid, { text: '❌ This command works in groups only.' }, { quoted: m });
        }

        const sender = m.key?.participant || m.key?.remoteJid || m.sender || '';
        const isAdminModule = require('../../lib/isAdmin');
        try {
            const { isSenderAdmin, isBotAdmin } = await isAdminModule(sock, chat, String(sender));
            if (!isSenderAdmin) return sock.sendMessage(chat, { text: '❌ Only group admins can run this command.' }, { quoted: m });
            if (!isBotAdmin) return sock.sendMessage(chat, { text: '❌ I must be an admin to accept join requests.' }, { quoted: m });
        } catch (err) {
            console.error('[add.execute] isAdmin check failed', err?.message || err);
            return sock.sendMessage(chat, { text: '❌ Failed to verify admin status.' }, { quoted: m });
        }

        const normalizeUserJid = jid => {
            if (!jid) return '';
            const raw = typeof jid === 'string' ? jid.trim() : String(jid).trim();
            if (!raw) return '';
            return raw.includes('@') ? raw : `${raw}@s.whatsapp.net`;
        };

        const subCmd = (args && args.length > 0) ? args[0].toLowerCase() : null;
        const numericLimit = subCmd && /^\d+$/.test(subCmd) ? parseInt(subCmd, 10) : null;

        let pending = [];

        if (typeof sock.groupRequestParticipantsList === 'function') {
            try {
                const requests = await sock.groupRequestParticipantsList(chat);
                if (Array.isArray(requests) && requests.length) {
                    pending = requests.map(req => req?.jid || req?.id || req?.attrs?.jid || req).filter(Boolean);
                }
            } catch (err) {
                console.error('[add.execute] groupRequestParticipantsList failed', err?.message || err);
            }
        }

        if (pending.length === 0) {
            let metadata = null;
            try {
                metadata = await sock.groupMetadata(chat);
            } catch (err) {
                console.error('[add.execute] groupMetadata failed', err?.message || err);
            }

            if (metadata) {
                pending = metadata.pendingParticipants || metadata.pendingRequests || metadata.joinRequests || metadata.requests || [];
                if ((!pending || pending.length === 0) && Array.isArray(metadata.participants)) {
                    pending = metadata.participants
                        .filter(p => p && (p.isPending || p.pending || p.isInvite || p.requested))
                        .map(p => p.id || p.jid || p);
                }
            }
        }

        const participants = Array.from(new Set(pending
            .map(p => (typeof p === 'string' ? p : (p.id || p.jid || p)))
            .filter(Boolean)
            .map(normalizeUserJid)
            .filter(Boolean)));

        if (subCmd === 'status') {
            return sock.sendMessage(chat, { text: `📋 Pending join requests: ${participants.length}` }, { quoted: m });
        }

        if (participants.length === 0) {
            return sock.sendMessage(chat, { text: 'ℹ️ No pending join requests found.' }, { quoted: m });
        }

        let selectedParticipants = participants;
        if (numericLimit !== null) {
            if (numericLimit <= 0) {
                return sock.sendMessage(chat, { text: '❌ Please provide a valid number greater than 0.' }, { quoted: m });
            }
            selectedParticipants = participants.slice(0, numericLimit);
            if (selectedParticipants.length === 0) {
                return sock.sendMessage(chat, { text: 'ℹ️ No pending join requests found for that limit.' }, { quoted: m });
            }
            await sock.sendMessage(chat, { text: `⏳ Found ${participants.length} pending request(s). Attempting to accept ${selectedParticipants.length} of them...` }, { quoted: m });
        } else {
            await sock.sendMessage(chat, { text: `⏳ Found ${participants.length} pending request(s). Attempting to accept all...` }, { quoted: m });
        }

        let accepted = 0;
        let failed = 0;

        if (typeof sock.groupRequestParticipantsUpdate === 'function') {
            try {
                const results = await sock.groupRequestParticipantsUpdate(chat, selectedParticipants, 'approve');
                if (Array.isArray(results) && results.length) {
                    results.forEach(r => {
                        const status = String(r?.status || '');
                        if (status === '200' || status.startsWith('2')) accepted += 1;
                        else failed += 1;
                    });
                } else {
                    failed = selectedParticipants.length;
                }
            } catch (err) {
                console.error('[add.execute] groupRequestParticipantsUpdate failed', err?.message || err);
                failed = selectedParticipants.length;
            }
        }

        if (accepted === 0 && failed === participants.length) {
            const candidates = [
                'groupApproveJoinRequest',
                'groupAcceptJoinRequest',
                'groupApprove',
                'groupAcceptInvite',
                'groupAdd',
                'groupAddParticipants',
                'groupApproveParticipant'
            ];

            const tryAccept = async participant => {
                for (const fn of candidates) {
                    if (typeof sock[fn] !== 'function') continue;
                    try {
                        await sock[fn](chat, participant);
                        return true;
                    } catch (e1) {
                        try {
                            await sock[fn](participant, chat);
                            return true;
                        } catch (e2) {
                            try {
                                await sock[fn]({ groupJid: chat, participant });
                                return true;
                            } catch (e3) {
                                continue;
                            }
                        }
                    }
                }
                return false;
            };

            const results = await Promise.all(selectedParticipants.map(async participant => {
                const ok = await tryAccept(participant);
                if (ok) accepted += 1; else failed += 1;
                return ok;
            }));

            if (results.length === 0) {
                failed = participants.length;
            }
        }

        const report = `✅ Done.\n• Total: ${participants.length}\n• Accepted: ${accepted}\n• Failed: ${failed}`;
        return sock.sendMessage(chat, { text: report }, { quoted: m });
    }
};
