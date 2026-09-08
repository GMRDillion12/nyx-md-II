module.exports = {
    command: ['reject'],
    category: 'group',
    description: 'Reject pending group join requests with optional limit or status',
    usage: '.reject [status|<number>]',
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;
        if (!chat || !chat.endsWith('@g.us')) {
            return sock.sendMessage(chat || m.key?.remoteJid, { text: '❌ This command works in groups only.' }, { quoted: m });
        }

        const sender = m.key?.participant || m.key?.remoteJid || m.sender || '';
        const isAdminModule = require('../../lib/isAdmin');

        try {
            const { isSenderAdmin, isBotAdmin } = await isAdminModule(sock, chat, String(sender));
            if (!isSenderAdmin) return sock.sendMessage(chat, { text: '❌ Only group admins can run this command.' }, { quoted: m });
            if (!isBotAdmin) return sock.sendMessage(chat, { text: '❌ I must be an admin to reject join requests.' }, { quoted: m });
        } catch (err) {
            console.error('[reject.execute] isAdmin check failed', err?.message || err);
            return sock.sendMessage(chat, { text: '❌ Failed to verify admin status.' }, { quoted: m });
        }

        const normalizeJid = jid => {
            if (!jid) return '';
            const raw = typeof jid === 'string' ? jid.trim() : String(jid).trim();
            if (!raw) return '';
            if (raw.includes('@')) return raw;
            return `${raw}@s.whatsapp.net`;
        };

        const subCmd = (args && args.length > 0) ? args[0].toLowerCase() : null;
        const numericLimit = subCmd && /^\\d+$/.test(subCmd) ? parseInt(subCmd, 10) : null;

        const getPendingRequests = async () => {
            let pending = [];

            if (typeof sock.groupRequestParticipantsList === 'function') {
                try {
                    const requests = await sock.groupRequestParticipantsList(chat);
                    if (Array.isArray(requests) && requests.length) {
                        pending = requests.map(req => req?.jid || req?.id || req?.attrs?.jid || req).filter(Boolean);
                    }
                } catch (err) {
                    console.error('[reject.execute] groupRequestParticipantsList failed', err?.message || err);
                }
            }

            if (pending.length === 0) {
                let metadata = null;
                try {
                    metadata = await sock.groupMetadata(chat);
                } catch (err) {
                    console.error('[reject.execute] groupMetadata failed', err?.message || err);
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

            return Array.from(new Set(pending
                .map(p => (typeof p === 'string' ? p : (p.id || p.jid || p)))
                .filter(Boolean)
                .map(normalizeJid)
                .filter(Boolean)));
        };

        const participants = await getPendingRequests();

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
            await sock.sendMessage(chat, { text: `⏳ Found ${participants.length} pending request(s). Attempting to reject ${selectedParticipants.length} of them...` }, { quoted: m });
        } else {
            await sock.sendMessage(chat, { text: `⏳ Found ${participants.length} pending request(s). Attempting to reject all...` }, { quoted: m });
        }

        const countResult = (results) => {
            let rejectedCount = 0;
            let failedCount = 0;
            if (Array.isArray(results) && results.length) {
                for (const r of results) {
                    const status = String(r?.status || '').trim();
                    if (!status || status === '200' || status.startsWith('2')) rejectedCount += 1;
                    else failedCount += 1;
                }
            }
            return { rejectedCount, failedCount };
        };

        let rejected = 0;
        let failed = 0;
        let actionUsed = null;

        if (typeof sock.groupRequestParticipantsUpdate === 'function') {
            const actions = ['decline', 'reject', 'deny'];
            for (const action of actions) {
                try {
                    const results = await sock.groupRequestParticipantsUpdate(chat, participants, action);
                    const counts = countResult(results);
                    if (counts.rejectedCount + counts.failedCount > 0) {
                        rejected = counts.rejectedCount;
                        failed = counts.failedCount;
                        actionUsed = action;
                        break;
                    }
                } catch (err) {
                    console.error(`[reject.execute] groupRequestParticipantsUpdate(${action}) failed`, err?.message || err);
                }
            }

            if (actionUsed === null) {
                failed = participants.length;
            }
        }

        if ((rejected === 0 && failed === participants.length) || actionUsed === null) {
            const candidates = [
                'groupRejectJoinRequest',
                'groupDeclineJoinRequest',
                'groupReject',
                'groupDenyJoinRequest',
                'groupDecline',
                'groupRejectRequest'
            ];

            const tryReject = async (participant) => {
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

            rejected = 0;
            failed = 0;
            const results = await Promise.all(participants.map(async (participant) => {
                const ok = await tryReject(participant);
                if (ok) rejected += 1;
                else failed += 1;
                return ok;
            }));

            if (results.length === 0) {
                failed = participants.length;
            }
        }

        const report = `✅ Done.\n• Total: ${participants.length}\n• Rejected: ${rejected}\n• Failed: ${failed}`;
        return sock.sendMessage(chat, { text: report }, { quoted: m });
    }
};
