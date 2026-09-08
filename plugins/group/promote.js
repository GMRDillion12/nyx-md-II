const isAdmin = require('../../lib/isAdmin'); // Make sure this file exists in lib/
const { formatMentionText } = require('../../lib/mentions');

module.exports = {
    command: ["promote", "demote"],
    category: "group",
    description: "Promote or demote a member",
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args, config) {
        const chatId = m.chat || m.key?.remoteJid;
        const senderRaw = m.key?.participant || m.key?.remoteJid || m.sender || '';
        const { normalizeJid, buildMentionJids, formatMentionText } = require('../../lib/mentions');
        const senderNormalized = normalizeJid(senderRaw || '');
        const senderNumber = senderNormalized.replace(/@.*$/, '') || '';
        const sender = senderNormalized.includes('@') ? senderNormalized : (senderNumber ? `${senderNumber}@s.whatsapp.net` : senderRaw);

        if (!chatId || !chatId.endsWith("@g.us")) {
            return sock.sendMessage(chatId, {
                text: "❌ This command can only be used in groups."
            }, { quoted: m });
        }

        // Check if bot and user are admins
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, sender);

        if (!isBotAdmin) {
            return sock.sendMessage(chatId, { 
                text: "❌ I need to be an admin to promote/demote members." 
            }, { quoted: m });
        }

        if (!isSenderAdmin) {
            return sock.sendMessage(chatId, {
                text: "❌ Only group admins can use this command."
            }, { quoted: m });
        }

        // Get user to promote/demote from mention or replied message
        const mentionedJids = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedSender = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;
        const target = mentionedJids.length > 0 ? mentionedJids[0] : quotedSender;

        if (!target) {
            return sock.sendMessage(chatId, {
                text: "❌ Please mention or reply to the user you want to promote/demote."
            }, { quoted: m });
        }

        const botJidRaw = sock.user?.id || sock.user?.jid || '';
        const botNumber = botJidRaw.split(':')[0]?.replace(/@.*$/, '') || '';
        const targetNumber = target.split(':')[0]?.replace(/@.*$/, '') || '';

        if (targetNumber === botNumber) {
            return sock.sendMessage(chatId, {
                text: "❌ I can't promote or demote myself."
            }, { quoted: m });
        }

        const text = (m.text || m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
        const cmd = text.split(/\s+/)[0]?.replace(/^[./#!]/, '').toLowerCase();
        const isPromote = cmd === "promote";

        try {
            await sock.groupParticipantsUpdate(chatId, [target], isPromote ? "promote" : "demote");

            const action = isPromote ? "promoted" : "demoted";
            const targetMention = formatMentionText(target, sock);

            await sock.sendMessage(chatId, {
                text: `✅ Successfully ${action} ${targetMention}`,
                mentions: buildMentionJids([target])
            }, { quoted: m });

            await sock.sendMessage(chatId, {
                react: { text: "✅", key: m.key }
            });

        } catch (error) {
            console.error("Promote/Demote error:", error);

            let replyText = `❌ Failed to ${isPromote ? "promote" : "demote"} the user. Make sure they are in the group and I am an admin.`;
            const errMsg = error?.message?.toLowerCase() || '';
            if (errMsg.includes('not-authorized') || errMsg.includes('403')) {
                replyText = "❌ I do not have permission to change this user's admin status. Make sure I am an admin.";
            } else if (errMsg.includes('not-in-group') || errMsg.includes('404')) {
                replyText = "❌ User is not in this group.";
            }

            await sock.sendMessage(chatId, {
                text: replyText
            }, { quoted: m });
        }
    }
};