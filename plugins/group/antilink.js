const {
    loadUserGroupData,
    setAntilink,
    getAntilink,
    addAntilinkExclude,
    removeAntilinkExclude,
    getAntilinkExcludes,
    addWarning,
    getWarning,
    resetWarning
} = require("../../lib/database");
const isAdmin = require("../../lib/isAdmin");
const { formatMentionText, buildMentionJids } = require("../../lib/mentions");
const DEBUG_ANTILINK = process.env.DEBUG_ANTILINK === 'true';

const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|discord\.gg\/[^\s]+)/i;

// Function to detect links in text
function containsLink(text) {
    if (typeof text !== 'string') return false;
    return linkRegex.test(text);
}

// Function to extract links from text
function extractLinks(text) {
    if (typeof text !== 'string') return [];
    return text.match(new RegExp(linkRegex, 'gi')) || [];
}

// Function to check if link is excluded
function isLinkExcluded(link, excludes) {
    const lowerLink = link.toLowerCase();
    return excludes.some(exclude => lowerLink.includes(exclude.toLowerCase()));
}

// Enforce antilink on messages
async function enforceAntilink(sock, m, text, config) {
    const chatId = m.chat || m.key?.remoteJid;
    const senderId = m.key?.participant || m.key?.remoteJid || m.key?.participantAlt || m.key?.remoteJidAlt || m.sender || '';

    if (!chatId || !chatId.endsWith('@g.us')) return;
    if (!senderId) return;
    if (senderId === sock.user?.id || senderId === sock.user?.jid) return;

    // Check if antilink is enabled
    const antilinkData = await getAntilink(chatId);
    if (!antilinkData || !antilinkData.enabled) return;

    // Check if sender is admin
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return; // Admins are exempt

    // Check if message contains links
    if (!containsLink(text)) return;

    // Get excludes
    const excludes = await getAntilinkExcludes(chatId);

    // Extract links
    const links = extractLinks(text);

    // Check if any link is not excluded
    let hasNonExcludedLink = false;
    for (const link of links) {
        if (!isLinkExcluded(link, excludes)) {
            hasNonExcludedLink = true;
            break;
        }
    }

    if (!hasNonExcludedLink) return; // All links are excluded

    // Add warning
    const warningCount = await addWarning(chatId, senderId);
    const senderMention = formatMentionText(senderId, sock);

    // Send warning message
    const warningMsg = `⚠️ *ANTILINK WARNING* ⚠️

${senderMention}, sending links is not allowed in this group!

Warning: ${warningCount}/3

${warningCount >= 3 ? '🚫 You have been kicked from the group!' : 'Please refrain from sending links.'}`;

    await sock.sendMessage(chatId, {
        text: warningMsg,
        mentions: buildMentionJids([senderId])
    });

    // Delete the message containing the link
    try {
        await sock.sendMessage(chatId, { delete: m.key });
    } catch (err) {
        console.error('Failed to delete link message:', err);
    }

    // If 3 warnings, kick the user
    if (warningCount >= 3) {
        try {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            await resetWarning(chatId, senderId); // Reset warnings after kick
        } catch (err) {
            console.error('Failed to kick user:', err);
        }
    }
}

// Command handler
module.exports = {
    command: ["antilink"],
    category: "group",
    description: "Manage antilink settings",
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args, config) {
        const chatId = m.chat || m.key?.remoteJid;
        const senderId = m.key?.participant || m.key?.remoteJid || m.sender || '';

        if (DEBUG_ANTILINK) {
            try {
                const status = await isAdmin(sock, chatId, senderId);
                await sock.sendMessage(chatId, {
                    text: `🛠️ Debug [antilink]\nSender: ${senderId}\nArgs: ${args?.join(' ') || ''}\nSenderAdmin: ${status.isSenderAdmin}\nBotAdmin: ${status.isBotAdmin}`
                }, { quoted: m });
            } catch (e) {
                console.error('[antilink debug] isAdmin failed', e?.message || e);
            }
        }

        const body = args?.join(' ').trim() || (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
        const subCommand = args?.[0]?.toLowerCase();
        const action = args?.[1]?.toLowerCase();
        const rest = args?.slice(2).join(' ').trim();

        if (subCommand === 'on') {
            await setAntilink(chatId, 'on');
            await sock.sendMessage(chatId, { text: '✅ Antilink has been enabled for this group.' }, { quoted: m });
        } else if (subCommand === 'off') {
            await setAntilink(chatId, 'off');
            await sock.sendMessage(chatId, { text: '❌ Antilink has been disabled for this group.' }, { quoted: m });
        } else if (subCommand === 'exclude') {
            const phrase = rest;

            if (action === 'add' && phrase) {
                const excludes = await addAntilinkExclude(chatId, phrase);
                await sock.sendMessage(chatId, { text: `✅ Added "${phrase}" to antilink excludes.\n\nCurrent excludes: ${excludes.join(', ')}` });
            } else if (action === 'remove' && phrase) {
                const excludes = await removeAntilinkExclude(chatId, phrase);
                await sock.sendMessage(chatId, { text: `✅ Removed "${phrase}" from antilink excludes.\n\nCurrent excludes: ${excludes.join(', ')}` });
            } else if (action === 'list') {
                const excludes = await getAntilinkExcludes(chatId);
                const list = excludes.length ? excludes.join(', ') : 'None';
                await sock.sendMessage(chatId, { text: `📋 Antilink excludes: ${list}` });
            } else {
                await sock.sendMessage(chatId, { text: 'Usage:\n• .antilink exclude add <phrase>\n• .antilink exclude remove <phrase>\n• .antilink exclude list' });
            }
        } else if (subCommand === 'status') {
            const antilinkData = await getAntilink(chatId);
            const status = antilinkData?.enabled ? '✅ ENABLED' : '❌ DISABLED';
            const excludes = await getAntilinkExcludes(chatId);
            const excludeList = excludes.length ? excludes.join(', ') : 'None';

            // Get group metadata to count members
            let memberCount = 0;
            try {
                const groupMetadata = await sock.groupMetadata(chatId);
                memberCount = groupMetadata.participants.length;
            } catch (e) {
                memberCount = 'Unknown';
            }

            await sock.sendMessage(chatId, {
                text: `🔗 *ANTILINK STATUS*\n\n` +
                      `📊 *Status:* ${status}\n` +
                      `👥 *Group Members:* ${memberCount}\n` +
                      `🚫 *Excluded Links:* ${excludeList}\n\n` +
                      `⚠️ *Warning System:* 3 warnings = Auto-kick\n` +
                      `👮 *Admins Exempt:* Yes\n\n` +
                      `📝 *Available Commands:*\n` +
                      `• .antilink on/off - Toggle antilink\n` +
                      `• .antilink exclude add/remove <phrase>\n` +
                      `• .antilink exclude list\n` +
                      `• .antilink warnings - Show user warnings\n` +
                      `• .antilink reset @user - Reset warnings`
            });
        } else if (subCommand === 'warnings') {
            // Get all warnings for this group
            const warnings = loadUserGroupData().warnings?.[chatId] || {};

            if (Object.keys(warnings).length === 0) {
                await sock.sendMessage(chatId, { text: '📋 No users have warnings in this group.' });
            } else {
                let warningText = '⚠️ *USER WARNINGS*\n\n';
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
                // Try to parse as phone number
                const phoneMatch = rest.match(/(\d+)/);
                if (phoneMatch) {
                    targetUser = `${phoneMatch[1]}@s.whatsapp.net`;
                }
            }

            if (!targetUser) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Please mention a user or reply to their message to reset warnings.\n\nUsage: .antilink reset @user'
                });
            }

            const warnings = loadUserGroupData().warnings?.[chatId] || {};
            const oldCount = warnings[targetUser] || 0;

            const targetMention = formatMentionText(targetUser, sock);
            if (oldCount === 0) {
                await sock.sendMessage(chatId, {
                    text: `✅ ${targetMention} has no warnings to reset.`,
                    mentions: buildMentionJids([targetUser])
                });
            } else {
                await resetWarning(chatId, targetUser);
                await sock.sendMessage(chatId, {
                    text: `✅ Reset warnings for ${targetMention} (${oldCount} → 0)`,
                    mentions: buildMentionJids([targetUser])
                });
            }
        } else {
            const antilinkData = await getAntilink(chatId);
            const status = antilinkData?.enabled ? 'ON' : 'OFF';
            const excludes = await getAntilinkExcludes(chatId);
            const excludeList = excludes.length ? `\nExcludes: ${excludes.join(', ')}` : '\nExcludes: None';

            await sock.sendMessage(chatId, {
                text: `🔗 *ANTILINK SETTINGS*\n\nStatus: ${status}${excludeList}\n\nCommands:\n• .antilink on/off - Toggle antilink\n• .antilink status - Show detailed status\n• .antilink exclude add <phrase>\n• .antilink exclude remove <phrase>\n• .antilink exclude list\n• .antilink warnings - Show user warnings\n• .antilink reset @user - Reset warnings`
            });
        }
    }
};

// Export the enforcement function
module.exports.enforceAntilink = enforceAntilink;