const {
    addWelcome,
    delWelcome,
    isWelcomeOn,
    getWelcome,
    addGoodbye,
    delGoodBye,
    isGoodByeOn,
    getGoodbye
} = require('./database');
const { formatMentionText } = require('./mentions');

const DEFAULT_WELCOME_MESSAGE = `╔═🌟 Welcome to {group} 🌟═╗
┃ 👋 Hey {user}
┃ 💬 Name: {name}
┃ 👥 Members: {count}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎉 We're glad you joined — say hi and tell us about yourself!
┃ • Be kind • No spam • Enjoy your stay ✨
╚═══════════════════════╝`;

const DEFAULT_GOODBYE_MESSAGE = `╔═👋 Farewell from {group} 👋═╗
┃ Goodbye {user}
┃ 💬 Name: {name}
┃ 👥 Members now: {count}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ We'll miss you — take care and hope to see you again!
╚═══════════════════════╝`;

function normalizeParticipant(participant) {
    if (!participant) return '';
    if (typeof participant === 'string') return participant;
    if (typeof participant === 'object') {
        return participant.id || participant.jid || participant.user || '';
    }
    return String(participant);
}

function formatTemplate(template, participant, groupName, extras = {}, sock = null) {
    const participantId = normalizeParticipant(participant);
    const userTag = extras.userTag || formatMentionText(participantId, sock);
    const name = extras.name || '';
    const count = typeof extras.count !== 'undefined' ? String(extras.count) : '';

    return template
        .replace(/\{user\}/gi, userTag)
        .replace(/\{group\}/gi, groupName)
        .replace(/\{name\}/gi, name)
        .replace(/\{count\}/gi, count);
}

async function getProfilePictureUrl(sock, jid) {
    try {
        const url = await sock.profilePictureUrl(jid, 'image');
        return url;
    } catch (error) {
        console.log(`[WELCOME] Could not fetch profile picture for ${jid}`);
        return null;
    }
}

async function sendWelcomeNotification(sock, chatId, participant, template, groupName, participantName = '', memberCount = 0) {
    try {
        const participantId = normalizeParticipant(participant);
        const text = formatTemplate(template || DEFAULT_WELCOME_MESSAGE, participantId, groupName, { name: participantName, count: memberCount }, sock);
        const mentions = [participantId];

        // Try to send with profile picture first. If that succeeds, return early.
        try {
            const ppUrl = await getProfilePictureUrl(sock, participantId);
            if (ppUrl) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: ppUrl },
                        caption: text,
                        mentions
                    });
                    console.log(`[WELCOME] Sent welcome (image) for ${participantId} in ${chatId}`);
                    return;
                } catch (errImg) {
                    // image send failed; fallthrough to text
                    console.log(`[WELCOME] image send failed, falling back to text: ${errImg.message}`);
                }
            }
        } catch (err) {
            console.log(`[WELCOME] Could not fetch/send profile picture for ${participantId}: ${err.message}`);
        }

        // Send text version
        await sock.sendMessage(chatId, { text, mentions });
        console.log(`[WELCOME] Sent welcome (text) for ${participantId} in ${chatId}`);
    } catch (error) {
        console.error(`[WELCOME ERROR] Failed to send welcome message:`, error.message);
    }
}

async function sendGoodbyeNotification(sock, chatId, participant, template, groupName, participantName = '', memberCount = 0) {
    try {
        const participantId = normalizeParticipant(participant);
        const text = formatTemplate(template || DEFAULT_GOODBYE_MESSAGE, participantId, groupName, { name: participantName, count: memberCount }, sock);
        const mentions = [participantId];

        // Try to include profile picture where possible
        try {
            const ppUrl = await getProfilePictureUrl(sock, participantId);
            if (ppUrl) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: ppUrl },
                        caption: text,
                        mentions
                    });
                    console.log(`[GOODBYE] Sent goodbye (image) for ${participantId} in ${chatId}`);
                    return;
                } catch (errImg) {
                    console.log(`[GOODBYE] image send failed, falling back to text: ${errImg.message}`);
                }
            }
        } catch (err) {
            console.log(`[GOODBYE] Could not fetch/send profile picture for ${participantId}: ${err.message}`);
        }

        await sock.sendMessage(chatId, { text, mentions });
        console.log(`[GOODBYE] Sent goodbye (text) for ${participantId} in ${chatId}`);
    } catch (error) {
        console.error(`[GOODBYE ERROR] Failed to send goodbye message:`, error.message);
    }
}

async function handleParticipantUpdate(sock, update) {
    try {
        const chatId = update.id;
        const participants = update.participants || [];
        const action = update.action;

        if (!chatId || !participants?.length) {
            return;
        }
        
        if (!['add', 'invite', 'remove'].includes(action)) {
            return;
        }

        // Get group metadata
        let metadata = null;
        try {
            metadata = await sock.groupMetadata(chatId);
        } catch (err) {
            console.error(`[WELCOME] Could not fetch group metadata for ${chatId}:`, err.message);
            return;
        }

        if (!metadata) return;

        const groupName = metadata?.subject || 'this group';
        const botId = sock.user?.id;

        // Import removed-members helper for tracking removed members
        let addModule = null;
        try {
            console.log(`[WELCOME] Attempting to load removedMembers helper for removed-member tracking`);
            addModule = require('../lib/removedMembers');
            console.log(`[WELCOME] removedMembers helper loaded. Exports: ${Object.keys(addModule).join(', ')}`);
        } catch (err) {
            console.log(`[WELCOME] removedMembers helper not available, skipping member tracking: ${err.message}`);
        }

        // Process each participant
        for (const participant of participants) {
            try {
                const participantId = normalizeParticipant(participant);

                // Skip bot itself
                if (participantId === botId) {
                    continue;
                }

                if (action === 'add' || action === 'invite') {
                    // Check if welcome is enabled
                    const welcomeEnabled = await isWelcomeOn(chatId);
                    
                    // Remove from removed list if they were previously removed
                    if (addModule) {
                        try {
                            console.log(`[WELCOME] Checking removed-members list for ${participantId} in ${chatId}`);
                            const removedMembers = addModule.getRemovedMembers(chatId);
                            if (removedMembers && removedMembers[participantId]) {
                                console.log(`[WELCOME] Found ${participantId} in removed-members, removing from DB`);
                                addModule.removeFromRemovedList(chatId, participantId);
                                console.log(`[WELCOME] Removed ${participantId} from removed members list (re-added to group)`);
                            } else {
                                console.log(`[WELCOME] ${participantId} not found in removed-members for ${chatId}`);
                            }
                        } catch (err) {
                            console.log(`[WELCOME] Could not clean removed members list: ${err.message}`);
                        }
                    }
                    
                    if (welcomeEnabled) {
                        const template = await getWelcome(chatId);
                        console.log(`[WELCOME] Sending welcome message for ${participantId}`);
                        const participantData = metadata?.participants?.find(p => normalizeParticipant(p) === participantId) || {};
                        const displayName = participantData?.pushName || participantData?.name || (participantId || '').replace(/@.*$/, '');
                        const memberCount = metadata?.participants?.length || 0;
                        await sendWelcomeNotification(sock, chatId, participantId, template, groupName, displayName, memberCount);
                    } else {
                        console.log(`[WELCOME] Welcome not enabled for ${chatId}`);
                    }
                }

                if (action === 'remove') {
                    const participantData = metadata?.participants?.find(p => normalizeParticipant(p) === participantId) || {};
                    const userName = participantData?.pushName || participantData?.name || (participantId || '').replace(/@.*$/, '');

                    // Track the removed member
                    if (addModule) {
                        try {
                            console.log(`[WELCOME] Tracking removed member ${participantId} for ${chatId} (name: ${userName})`);
                            addModule.trackRemovedMember(chatId, participantId, userName);
                            console.log(`[WELCOME] trackRemovedMember called for ${participantId}`);
                        } catch (err) {
                            console.error(`[WELCOME] Error tracking removed member: ${err.message}`);
                        }
                    } else {
                        console.log(`[WELCOME] addModule not loaded; skipping trackRemovedMember for ${participantId}`);
                    }

                    // Check if goodbye is enabled
                    const goodbyeEnabled = await isGoodByeOn(chatId);
                    
                    if (goodbyeEnabled) {
                        const template = await getGoodbye(chatId);
                        const memberCount = metadata?.participants?.length || 0;
                        await sendGoodbyeNotification(sock, chatId, participantId, template, groupName, userName, memberCount);
                    } else {
                        console.log(`[GOODBYE] Goodbye not enabled for ${chatId}`);
                    }
                }
            } catch (err) {
                console.error(`[WELCOME] Error processing participant ${JSON.stringify(participant)}:`, err.message);
            }
        }
    } catch (error) {
        console.error(`[WELCOME] Unexpected error in handleParticipantUpdate:`, error.message);
    }
}

async function handleWelcome(sock, chatId, message, match) {
    try {
        if (!match) {
            const isEnabled = await isWelcomeOn(chatId);
                return await sock.sendMessage(chatId, {
                    text: `📥 *Welcome Message System*\n\n✅ Status: ${isEnabled ? 'ENABLED ✓' : 'DISABLED ✗'}\n\n📋 *Available Commands:*\n\n• \`.welcome on\` — Enable welcome messages\n• \`.welcome off\` — Disable welcome messages\n• \`.welcome set [message]\` — Set custom message\n• \`.welcome reset\` — Restore default message\n• \`.welcome status\` — Show current message\n\n💡 *Placeholders:*\n• {user} - Mention the joining user\n• {group} - Group name\n• {name} - User display name\n• {count} - Current member count\n\n📝 *Example:*\n.welcome set Welcome to {group}! 🎉 {user}`
            }, { quoted: message });
        }

        const [cmd, ...args] = match.split(' ');
        const lower = cmd.toLowerCase();
        const customMessage = args.join(' ');

        if (lower === 'on') {
            const currentEnabled = await isWelcomeOn(chatId);
            if (currentEnabled) {
                return await sock.sendMessage(chatId, { text: '⚠️ Welcome is already enabled.' }, { quoted: message });
            }
            await addWelcome(chatId, true, null);
            return await sock.sendMessage(chatId, { text: '✅ Welcome messages have been enabled!' }, { quoted: message });
        }

        if (lower === 'off') {
            const currentEnabled = await isWelcomeOn(chatId);
            if (!currentEnabled) {
                return await sock.sendMessage(chatId, { text: '⚠️ Welcome is already disabled.' }, { quoted: message });
            }
            await delWelcome(chatId);
            return await sock.sendMessage(chatId, { text: '✅ Welcome messages have been disabled.' }, { quoted: message });
        }

        if (lower === 'set') {
            if (!customMessage) {
                return await sock.sendMessage(chatId, { text: '❌ Please provide a message.\n\nExample: .welcome set Welcome to {group}! {user}' }, { quoted: message });
            }
            await addWelcome(chatId, true, customMessage);
            return await sock.sendMessage(chatId, { text: `✅ Welcome message set!\n\n📝 *Preview:*\n${customMessage}` }, { quoted: message });
        }

        if (lower === 'reset') {
            const currentEnabled = await isWelcomeOn(chatId);
            // Explicitly set the stored message to the default template
            await addWelcome(chatId, currentEnabled, DEFAULT_WELCOME_MESSAGE);
            return await sock.sendMessage(chatId, { text: `✅ Welcome message reset to default!\n\n📝 *Message:*\n${DEFAULT_WELCOME_MESSAGE}` }, { quoted: message });
        }

        if (lower === 'status') {
            const enabled = await isWelcomeOn(chatId);
            const currentMessage = await getWelcome(chatId) || DEFAULT_WELCOME_MESSAGE;
            return await sock.sendMessage(chatId, {
                text: `📌 *Welcome System Status*\n\n✅ Status: ${enabled ? 'ENABLED' : 'DISABLED'}\n\n📝 *Current Message:*\n${currentMessage}`
            }, { quoted: message });
        }

        return await sock.sendMessage(chatId, { text: '❌ Invalid command! Use `.welcome` for help.' }, { quoted: message });
    } catch (error) {
        console.error('[WELCOME COMMAND ERROR]', error);
        return await sock.sendMessage(chatId, { text: '❌ An error occurred while processing the welcome command.' }, { quoted: message });
    }
}

async function handleGoodbye(sock, chatId, message, match) {
    try {
        if (!match) {
            const isEnabled = await isGoodByeOn(chatId);
                return await sock.sendMessage(chatId, {
                    text: `📤 *Goodbye Message System*\n\n✅ Status: ${isEnabled ? 'ENABLED ✓' : 'DISABLED ✗'}\n\n📋 *Available Commands:*\n\n• \`.goodbye on\` — Enable goodbye messages\n• \`.goodbye off\` — Disable goodbye messages\n• \`.goodbye set [message]\` — Set custom message\n• \`.goodbye reset\` — Restore default message\n• \`.goodbye status\` — Show current message\n\n💡 *Placeholders:*\n• {user} - Mention the leaving user\n• {group} - Group name\n• {name} - User display name\n• {count} - Current member count\n\n📝 *Example:*\n.goodbye set Goodbye {user}! See you later in {group}! 👋`
            }, { quoted: message });
        }

        const [cmd, ...args] = match.split(' ');
        const lower = cmd.toLowerCase();
        const customMessage = args.join(' ');

        if (lower === 'on') {
            const currentEnabled = await isGoodByeOn(chatId);
            if (currentEnabled) {
                return await sock.sendMessage(chatId, { text: '⚠️ Goodbye is already enabled.' }, { quoted: message });
            }
            await addGoodbye(chatId, true, null);
            return await sock.sendMessage(chatId, { text: '✅ Goodbye messages have been enabled!' }, { quoted: message });
        }

        if (lower === 'off') {
            const currentEnabled = await isGoodByeOn(chatId);
            if (!currentEnabled) {
                return await sock.sendMessage(chatId, { text: '⚠️ Goodbye is already disabled.' }, { quoted: message });
            }
            await delGoodBye(chatId);
            return await sock.sendMessage(chatId, { text: '✅ Goodbye messages have been disabled.' }, { quoted: message });
        }

        if (lower === 'set') {
            if (!customMessage) {
                return await sock.sendMessage(chatId, { text: '❌ Please provide a message.\n\nExample: .goodbye set Goodbye {user}! See you in {group}!' }, { quoted: message });
            }
            await addGoodbye(chatId, true, customMessage);
            return await sock.sendMessage(chatId, { text: `✅ Goodbye message set!\n\n📝 *Preview:*\n${customMessage}` }, { quoted: message });
        }

        if (lower === 'reset') {
            const currentEnabled = await isGoodByeOn(chatId);
            // Explicitly set the stored message to the default template
            await addGoodbye(chatId, currentEnabled, DEFAULT_GOODBYE_MESSAGE);
            return await sock.sendMessage(chatId, { text: `✅ Goodbye message reset to default!\n\n📝 *Message:*\n${DEFAULT_GOODBYE_MESSAGE}` }, { quoted: message });
        }

        if (lower === 'status') {
            const enabled = await isGoodByeOn(chatId);
            const currentMessage = await getGoodbye(chatId) || DEFAULT_GOODBYE_MESSAGE;
            return await sock.sendMessage(chatId, {
                text: `📌 *Goodbye System Status*\n\n✅ Status: ${enabled ? 'ENABLED' : 'DISABLED'}\n\n📝 *Current Message:*\n${currentMessage}`
            }, { quoted: message });
        }

        return await sock.sendMessage(chatId, { text: '❌ Invalid command! Use `.goodbye` for help.' }, { quoted: message });
    } catch (error) {
        console.error('[GOODBYE COMMAND ERROR]', error);
        return await sock.sendMessage(chatId, { text: '❌ An error occurred while processing the goodbye command.' }, { quoted: message });
    }
}

module.exports = { handleWelcome, handleGoodbye, handleParticipantUpdate };

