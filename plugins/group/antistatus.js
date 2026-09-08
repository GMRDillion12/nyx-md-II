const {
    loadUserGroupData,
    setAntistatus,
    getAntistatus,
    addAntistatusWarning,
    resetAntistatusWarning
} = require("../../lib/database");
const isAdmin = require("../../lib/isAdmin");
const { formatMentionText, buildMentionJids } = require("../../lib/mentions");

function isStatusMentionMessage(m) {
    if (!m || !m.message) return false;

    if (m.message.statusMentionMessage || m.message.groupStatusMentionMessage) return true;
    if (Array.isArray(m.statusMentions) && m.statusMentions.length > 0) return true;
    if (Array.isArray(m.message.statusMentions) && m.message.statusMentions.length > 0) return true;
    if (Array.isArray(m.message.statusMentionSources) && m.message.statusMentionSources.length > 0) return true;
    if (Array.isArray(m.message.statusMentionMessageInfo?.statusMentions) && m.message.statusMentionMessageInfo.statusMentions.length > 0) return true;

    return false;
}

async function enforceAntistatus(sock, m, text, config) {
    const chatId = m.chat || m.key?.remoteJid;
    const senderId = m.key?.participant || m.key?.remoteJid || m.key?.participantAlt || m.key?.remoteJidAlt || m.sender || '';

    if (!chatId || !chatId.endsWith('@g.us')) return;
    if (!senderId) return;
    if (senderId === sock.user?.id || senderId === sock.user?.jid) return;

    const antistatusData = await getAntistatus(chatId);
    if (!antistatusData || !antistatusData.enabled) return;

    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return;

    if (!isStatusMentionMessage(m)) return;

    const warningCount = await addAntistatusWarning(chatId, senderId);
    const senderMention = formatMentionText(senderId, sock);
    const warningMsg = `⚠️ *ANTISTATUS WARNING* ⚠️

${senderMention}, status mentions between group and status are not allowed here.

Warning: ${warningCount}/3

${warningCount >= 3 ? '🚫 You will be removed from the group for repeated violations.' : 'Please do not share status mentions in this group.'}`;

    await sock.sendMessage(chatId, {
        text: warningMsg,
        mentions: buildMentionJids([senderId])
    });

    try {
        await sock.sendMessage(chatId, { delete: m.key });
    } catch (err) {
        console.error('Failed to delete status mention message:', err);
    }

    if (warningCount >= 3) {
        try {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            await resetAntistatusWarning(chatId, senderId);
        } catch (err) {
            console.error('Failed to remove user after antistatus warnings:', err);
        }
    }
}

module.exports = {
    command: ["antistatus"],
    category: "group",
    description: "Manage status mention blocking in groups",
    usage: ".antistatus on/off/status/warnings/reset",
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args, config) {
        const chatId = m.chat || m.key?.remoteJid;
        const senderId = m.key?.participant || m.key?.remoteJid || m.sender || '';
        const body = args?.join(' ').trim() || (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
        const subCommand = args?.[0]?.toLowerCase();
        const action = args?.[1]?.toLowerCase();
        const rest = args?.slice(1).join(' ').trim();

        if (subCommand === 'on') {
            await setAntistatus(chatId, 'on');
            await sock.sendMessage(chatId, { text: '✅ Antistatus protection has been enabled for this group.' }, { quoted: m });
        } else if (subCommand === 'off') {
            await setAntistatus(chatId, 'off');
            await sock.sendMessage(chatId, { text: '❌ Antistatus protection has been disabled for this group.' }, { quoted: m });
        } else if (subCommand === 'status') {
            const antistatusData = await getAntistatus(chatId);
            const status = antistatusData?.enabled ? '✅ ENABLED' : '❌ DISABLED';
            const warnings = loadUserGroupData().antistatusWarnings?.[chatId] || {};
            const warningList = Object.keys(warnings).length
                ? Object.entries(warnings).map(([userId, count]) => `${formatMentionText(userId, sock)}: ${count}/3`).join('\n')
                : 'None';

            await sock.sendMessage(chatId, {
                text: `📌 *ANTISTATUS STATUS*

• Status: ${status}
• Warnings recorded: ${Object.keys(warnings).length}

Current warning counts:
${warningList}

⚠️ *Rule:* 3 warnings = auto-kick
👮 *Admins exempt:* Yes

*Available commands:*
• .antistatus on/off
• .antistatus status
• .antistatus warnings
• .antistatus reset @user`,
                mentions: Object.keys(warnings)
                }, { quoted: m });
        } else if (subCommand === 'warnings') {
            const warnings = loadUserGroupData().antistatusWarnings?.[chatId] || {};

            if (Object.keys(warnings).length === 0) {
                await sock.sendMessage(chatId, { text: '📋 No users have warnings for antistatus violations in this group.' });
            } else {
                let warningText = `⚠️ *ANTISTATUS WARNINGS*

`;
                for (const [userId, count] of Object.entries(warnings)) {
                    warningText += `${formatMentionText(userId, sock)}: ${count}/3 warnings\n`;
                }
                await sock.sendMessage(chatId, {
                    text: warningText,
                    mentions: buildMentionJids(Object.keys(warnings))
                });
            }
        } else if (subCommand === 'reset') {
            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;

            let targetUser = null;
            if (mentioned.length > 0) {
                targetUser = mentioned[0];
            } else if (quoted) {
                targetUser = quoted;
            } else if (rest) {
                const phoneMatch = rest.match(/(\d+)/);
                if (phoneMatch) {
                    targetUser = `${phoneMatch[1]}@s.whatsapp.net`;
                }
            }

            if (!targetUser) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Please mention a user or reply to their message to reset warnings.\n\nUsage: .antistatus reset @user'
                });
            }

            const warnings = loadUserGroupData().antistatusWarnings?.[chatId] || {};
            const oldCount = warnings[targetUser] || 0;

            const targetMention = formatMentionText(targetUser, sock);
            if (oldCount === 0) {
                await sock.sendMessage(chatId, {
                    text: `✅ ${targetMention} has no antistatus warnings to reset.`,
                    mentions: buildMentionJids([targetUser])
                });
            } else {
                await resetAntistatusWarning(chatId, targetUser);
                await sock.sendMessage(chatId, {
                    text: `✅ Reset antistatus warnings for ${targetMention} (${oldCount} → 0).`,
                    mentions: buildMentionJids([targetUser])
                });
            }
        } else {
            const antistatusData = await getAntistatus(chatId);
            const status = antistatusData?.enabled ? 'ON' : 'OFF';
            await sock.sendMessage(chatId, {
                text: `📌 *ANTISTATUS SETTINGS*

Status: ${status}

Commands:
• .antistatus on - Enable antistatus
• .antistatus off - Disable antistatus
• .antistatus status - Show current status and warning counts
• .antistatus warnings - List users with warnings
• .antistatus reset ${formatMentionText(targetUser || '@user', sock)} - Reset a user's warnings`
            });
        }
    }
};

module.exports.enforceAntistatus = enforceAntistatus;
