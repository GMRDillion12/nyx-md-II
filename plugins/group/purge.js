module.exports = {
    command: ['purge'],
    category: 'group',
    description: 'Remove all non-admin members from the group at once',
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args) {
        try {
            const chat = m.chat || m.key?.remoteJid;
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
                return sock.sendMessage(chat, {
                    text: 'ℹ️ No removable members found. Only admins and the bot are present in the group.'
                }, { quoted: m });
            }

            await sock.sendMessage(chat, {
                text: `⏳ Purging ${usersToRemove.length} member(s) from the group...`
            }, { quoted: m });

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
                    console.error('[purge] groupParticipantsUpdate failed', err?.message || err);
                    failed += batch.length;
                }
            }

            return sock.sendMessage(chat, {
                text: `✅ Purge complete.
• Total requested: ${usersToRemove.length}
• Removed: ${removed}
• Failed: ${failed}`
            }, { quoted: m });

        } catch (err) {
            console.error('[purge] error', err?.message || err);
            return sock.sendMessage(m.chat, {
                text: '❌ Failed to purge group members. Please try again.'
            }, { quoted: m });
        }
    }
};
