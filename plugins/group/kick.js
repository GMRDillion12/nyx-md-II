const isAdmin = require("../../lib/isAdmin");
const { formatMentionText, buildMentionJids } = require("../../lib/mentions");

module.exports = {
    command: ["kick"],
    category: "group",
    description: "Kick mentioned or replied user(s) from the group",
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args) {
        try {
            const chat = m.chat;
            
            // Normalize sender ID the same way handler.js does
            const senderRaw = m.key?.participant || m.key?.remoteJid || m.sender;
            const { normalizeJid, formatMentionText, buildMentionJids } = require('../../lib/mentions');
            const senderNormalized = normalizeJid(senderRaw || '');
            const senderNumber = senderNormalized.replace(/@.*$/, '');
            const sender = senderNormalized.includes('@') ? senderNormalized : `${senderNumber}@s.whatsapp.net`;

            console.log('[kick] Checking admin status...');
            console.log('[kick] sender:', sender);
            
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chat, sender);
            
            console.log('[kick] isBotAdmin:', isBotAdmin, 'isSenderAdmin:', isSenderAdmin);

            if (!isBotAdmin) {
                return sock.sendMessage(chat, {
                    text: "❌ Please make me an admin first so I can kick people."
                }, { quoted: m });
            }

            if (!isSenderAdmin) {
                return sock.sendMessage(chat, {
                    text: "❌ Only group admins can use this command."
                }, { quoted: m });
            }

            let usersToKick = [];

            // Get mentioned JIDs from contextInfo (proper Baileys location)
            const mentionedJids = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedSender = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;
            
            console.log('[kick] mentionedJids:', mentionedJids);
            console.log('[kick] quotedSender:', quotedSender);
            console.log('[kick] m.quoted:', m.quoted);
            
            // Grab targets from mentions or quoted message
            if (mentionedJids && mentionedJids.length > 0) {
                usersToKick = mentionedJids;
            } else if (m.quoted?.sender) {
                usersToKick = [m.quoted.sender];
            } else if (quotedSender) {
                usersToKick = [quotedSender];
            }

            if (usersToKick.length === 0) {
                return sock.sendMessage(chat, {
                    text: "❌ Please mention the user(s) or reply to their message to kick them.\n\nExample: `.kick @user` or reply to a message with `.kick`"
                }, { quoted: m });
            }

            // --- SAFEGUARDS ---

            // Get bot and sender JIDs
            const botJid = sock.user?.id || sock.user?.jid || '';
            const botNumber = botJid.split(':')[0].replace(/@.*$/, '');

            // Check if trying to kick bot or self
            const tryingToKickBot = usersToKick.some(jid => {
                const jidNumber = jid.split(':')[0].replace(/@.*$/, '');
                return jidNumber === botNumber;
            });
            
            const tryingToKickSelf = usersToKick.some(jid => {
                const jidNumber = jid.split(':')[0].replace(/@.*$/, '');
                return jidNumber === senderNumber;
            });

            if (tryingToKickBot) {
                return sock.sendMessage(chat, {
                    text: "🤖 Nice try, but I can't kick myself!"
                }, { quoted: m });
            }

            if (tryingToKickSelf) {
                return sock.sendMessage(chat, {
                    text: "❌ You can't kick yourself! If you want to leave, just use the group settings."
                }, { quoted: m });
            }

            // --- EXECUTION ---
            
            console.log('[kick] Attempting to kick:', usersToKick);
            
            // Try to kick the user(s)
            const result = await sock.groupParticipantsUpdate(chat, usersToKick, "remove");
            
            console.log('[kick] Result:', result);

            // Send success message
            const mentionText = usersToKick.map(jid => formatMentionText(jid, sock));

            await sock.sendMessage(chat, {
                text: `👢 ${mentionText.join(", ")} has been successfully removed from the group.`,
                mentions: buildMentionJids(usersToKick)
            }, { quoted: m });

            // Reaction to confirm success
            await sock.sendMessage(chat, {
                react: { text: "👋", key: m.key }
            });

        } catch (error) {
            console.error("Kick command error:", error);
            
            // More descriptive error messages
            let errorMsg = "❌ Failed to kick user.";
            
            if (error.message?.includes('not-authorized')) {
                errorMsg = "❌ I don't have permission to kick this user. They might be a group admin or creator.";
            } else if (error.message?.includes('rate')) {
                errorMsg = "❌ Too many requests. Please try again in a few seconds.";
            } else if (error.message?.includes('403')) {
                errorMsg = "❌ Forbidden. The user might have restricted who can add them to groups.";
            }
            
            await sock.sendMessage(m.chat, {
                text: errorMsg
            }, { quoted: m });
        }
    }
};
