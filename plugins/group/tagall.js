const isAdmin = require("../../lib/isAdmin");

module.exports = {
    command: ["tagall"],
    category: "group",
    description: "Tag all members in the group",
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args, config) {
        const chat = m.chat;
        const sender = m.key.participant || m.key.remoteJid;

        console.log('🔍 Tagall Debug:', { sender, chat });

        // Check admin permissions using your isAdmin.js
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chat, sender);

        console.log('🔍 Admin Check Result:', { isSenderAdmin, isBotAdmin });

        if (!isBotAdmin) {
            return sock.sendMessage(chat, { 
                text: "❌ Please make the bot an admin first!" 
            }, { quoted: m });
        }

        if (!isSenderAdmin) {
            return sock.sendMessage(chat, { 
                text: "❌ Only group admins can use this command!" 
            }, { quoted: m });
        }

        try {
            const groupMetadata = await sock.groupMetadata(chat);
            const participants = groupMetadata.participants || [];

            if (participants.length === 0) {
                return sock.sendMessage(chat, { 
                    text: "❌ No participants found in this group." 
                }, { quoted: m });
            }

            // Build mention message
            let text = `🔊 *Everyone, come here!* 👇\n\n`;
            const mentions = [];

            participants.forEach(p => {
                const number = p.id.split("@")[0];
                text += `@${number}\n`;
                mentions.push(p.id);
            });

            // Send with mentions
            await sock.sendMessage(chat, {
                text: text,
                mentions: mentions
            }, { quoted: m });

            // Optional nice reaction
            await sock.sendMessage(chat, {
                react: { text: "📢", key: m.key }
            });

        } catch (err) {
            console.error("Tagall error:", err);
            await sock.sendMessage(chat, { 
                text: "❌ Failed to tag all members." 
            }, { quoted: m });
        }
    }
};
