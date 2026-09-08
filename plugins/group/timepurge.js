const { loadScheduledPurges, addScheduledPurge, removeScheduledPurge, getScheduledPurge } = require('../../lib/timepurgeStore');

const scheduledPurges = new Map();

function parseDuration(input) {
    if (!input || typeof input !== 'string') return null;
    input = input.trim().toLowerCase();
    // Accept formats like "1d2h30m10s", or space-separated "1d 2h" or single unit like "10m"
    const regex = /(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/;
    const compactRegex = /(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

    const m = input.match(regex) || input.match(compactRegex);
    if (!m) return null;
    const days = parseInt(m[1] || 0, 10);
    const hours = parseInt(m[2] || 0, 10);
    const minutes = parseInt(m[3] || 0, 10);
    const seconds = parseInt(m[4] || 0, 10);
    const ms = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    return ms > 0 ? ms : null;
}

function msToHuman(ms) {
    const sec = Math.floor(ms / 1000);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds) parts.push(`${seconds}s`);
    return parts.length ? parts.join(' ') : '0s';
}

function getRemainingMs(endAt) {
    return Math.max(0, Number(endAt) - Date.now());
}

// Schedule a timeout safely even for durations longer than Node's setTimeout max (~24.85 days).
function scheduleTimeoutChain(fn, ms) {
    const MAX = 2147483647;
    const timers = [];
    let remaining = ms;
    let cancelled = false;

    function scheduleNext() {
        if (cancelled) return;
        const wait = Math.min(remaining, MAX);
        const id = setTimeout(() => {
            if (cancelled) return;
            remaining -= wait;
            if (remaining <= 0) {
                try { fn(); } catch (e) { console.error('scheduleTimeoutChain fn error', e); }
            } else {
                scheduleNext();
            }
        }, wait);
        timers.push(id);
    }

    scheduleNext();

    return {
        cancel() {
            cancelled = true;
            for (const id of timers) clearTimeout(id);
            timers.length = 0;
        },
        timers
    };
}

function createRunPurge(chat, sock) {
    return async () => {
        try {
            const metadata = await sock.groupMetadata(chat);
            const participants = metadata?.participants || [];

            const botJid = `${(sock.user?.id || sock.user?.jid || '').split(':')[0]}@s.whatsapp.net`;
            const usersToRemove = participants
                .map(participant => participant?.id || participant?.jid || participant)
                .filter(Boolean)
                .filter(jid => jid !== botJid)
                .filter(jid => {
                    const participant = participants.find(p => p.id === jid || p.jid === jid);
                    return participant && participant.admin !== 'admin' && participant.admin !== 'superadmin';
                });

            if (usersToRemove.length === 0) {
                await sock.sendMessage(chat, { text: 'ℹ️ No removable members found when running timepurge.' });
                return;
            }

            await sock.sendMessage(chat, { text: `⏳ Timepurge executing now: removing ${usersToRemove.length} member(s)...` });

            const chunkArray = (array, size) => {
                const chunks = [];
                for (let i = 0; i < array.length; i += size) {
                    chunks.push(array.slice(i, i + size));
                }
                return chunks;
            };

            let removed = 0;
            let failed = 0;
            const batches = chunkArray(usersToRemove, 15);

            for (const batch of batches) {
                try {
                    const result = await sock.groupParticipantsUpdate(chat, batch, 'remove');

                    if (Array.isArray(result)) {
                        result.forEach(item => {
                            const status = String(item?.status || '');
                            if (status.startsWith('2')) removed += 1;
                            else failed += 1;
                        });
                    } else {
                        removed += batch.length;
                    }
                } catch (err) {
                    console.error('[timepurge] groupParticipantsUpdate failed', err?.message || err);
                    failed += batch.length;
                }
            }

            await sock.sendMessage(chat, {
                text: `✅ Timepurge complete.\n• Total requested: ${usersToRemove.length}\n• Removed: ${removed}\n• Failed: ${failed}`
            });
        } catch (err) {
            console.error('[timepurge] error', err?.message || err);
            try { await sock.sendMessage(chat, { text: '❌ Timepurge failed to execute. Check bot permissions and try again.' }); } catch (e) { }
        } finally {
            removeScheduledPurge(chat);
            scheduledPurges.delete(chat);
        }
    };
}

function restoreScheduledPurges(sock) {
    const data = loadScheduledPurges();
    for (const [chat, schedule] of Object.entries(data)) {
        const endAt = Number(schedule?.endAt || 0);
        if (!endAt) {
            removeScheduledPurge(chat);
            continue;
        }

        const remaining = getRemainingMs(endAt);
        const runPurge = createRunPurge(chat, sock);
        const handle = scheduleTimeoutChain(runPurge, remaining);
        scheduledPurges.set(chat, { handle, endAt });

        console.log(`[timepurge] restored schedule for ${chat}, remaining ${msToHuman(remaining)}`);
    }
}

function schedulePurge(chat, ms, sock, endAt) {
    const runPurge = createRunPurge(chat, sock);
    const handle = scheduleTimeoutChain(runPurge, ms);
    scheduledPurges.set(chat, { handle, endAt });
    addScheduledPurge(chat, endAt);
}

module.exports = {
    command: ['timepurge'],
    category: 'group',
    description: 'Schedule a purge of non-admin members',
    groupOnly: true,
    adminOnly: true,

    init(sock) {
        try {
            restoreScheduledPurges(sock);
        } catch (err) {
            console.error('[timepurge] restoreScheduledPurges failed', err?.message || err);
        }
    },

    async execute(sock, m, args) {
        try {
            const chat = m.chat || m.key?.remoteJid;

            if (!args || args.length === 0) {
                return sock.sendMessage(chat, {
                    text: 'Usage:\n• `.timepurge <duration>` — schedule a purge (e.g. `10m`, `1h30m`, `2d`)\n• `.timepurge list` — view the active schedule\n• `.timepurge cancel` — cancel the scheduled purge'
                }, { quoted: m });
            }

            const sub = args[0].toLowerCase();
            if (sub === 'cancel') {
                const entry = scheduledPurges.get(chat);
                const persisted = getScheduledPurge(chat);
                if (!entry && !persisted) {
                    return sock.sendMessage(chat, { text: 'ℹ️ No scheduled timepurge found for this group.' }, { quoted: m });
                }

                if (entry) {
                    try { entry.handle.cancel(); } catch (e) { /* ignore */ }
                    scheduledPurges.delete(chat);
                }
                removeScheduledPurge(chat);
                return sock.sendMessage(chat, { text: '✅ Scheduled timepurge canceled.' }, { quoted: m });
            }

            if (sub === 'list' || sub === 'status') {
                const persisted = getScheduledPurge(chat);
                if (!persisted) {
                    return sock.sendMessage(chat, { text: 'ℹ️ No active scheduled timepurge found for this group.' }, { quoted: m });
                }

                const endAt = Number(persisted.endAt || 0);
                const remaining = getRemainingMs(endAt);
                return sock.sendMessage(chat, {
                    text: `⏳ Active timepurge scheduled for this group:\n• Remaining: ${msToHuman(remaining)}\n• Executes at: ${new Date(endAt).toUTCString()}`
                }, { quoted: m });
            }

            const durationStr = args.join('');
            const cleaned = durationStr.replace(/\s+/g, '');
            const ms = parseDuration(cleaned) || parseDuration(durationStr);
            if (!ms) {
                return sock.sendMessage(chat, { text: '❌ Invalid duration. Examples: 30s, 10m, 1h30m, 2d' }, { quoted: m });
            }

            if (scheduledPurges.has(chat) || getScheduledPurge(chat)) {
                return sock.sendMessage(chat, { text: '❌ A timepurge is already scheduled for this group. Use `.timepurge cancel` to cancel it first.' }, { quoted: m });
            }

            const endAt = Date.now() + ms;

            await sock.sendMessage(chat, {
                text: `⏳ Scheduled timepurge: will purge non-admin members in ${msToHuman(ms)} (at ${new Date(endAt).toUTCString()}). Use \`.timepurge cancel\` to cancel.`
            }, { quoted: m });

            schedulePurge(chat, ms, sock, endAt);
        } catch (err) {
            console.error('[timepurge] error', err?.message || err);
            return sock.sendMessage(m.chat, { text: '❌ Failed to schedule timepurge. Please try again.' }, { quoted: m });
        }
    }
};
