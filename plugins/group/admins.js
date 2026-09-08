const { formatMentionText } = require("../../lib/mentions");

function normalizeJid(value) {
    if (!value) return "";
    return String(value).trim().split(":")[0];
}

function isSameParticipant(a, b) {
    const left = normalizeJid(a);
    const right = normalizeJid(b);
    if (!left || !right) return false;
    if (left === right) return true;
    return left.replace(/@.*$/, "") === right.replace(/@.*$/, "");
}

module.exports = {
    command: ["admins"],
    category: "group",
    description: "Show the group creator and admins",
    groupOnly: true,

    async execute(sock, m) {
        const chat = m.chat;

        try {
            const metadata = await sock.groupMetadata(chat);
            const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
            const creatorId = metadata?.owner || metadata?.creator || metadata?.ownerJid || metadata?.owner_jid || null;

            const creatorParticipant = creatorId
                ? participants.find((p) => {
                    const participantId = p.id || p.jid || p.lid;
                    return isSameParticipant(participantId, creatorId);
                })
                : null;

            const adminParticipants = participants.filter((p) => {
                const adminRole = p?.admin;
                return adminRole === "admin" || adminRole === "superadmin";
            });

            const adminEntries = adminParticipants.filter((p) => {
                const participantId = p.id || p.jid || p.lid;
                if (!creatorParticipant) return true;
                return !isSameParticipant(participantId, creatorParticipant.id || creatorParticipant.jid || creatorParticipant.lid);
            });

            if (!creatorParticipant && adminEntries.length === 0) {
                return sock.sendMessage(chat, {
                    text: "❌ No creator or admins were found for this group."
                }, { quoted: m });
            }

            const mentions = [];
            const lines = ["👑 *Group Creator & Admins* 👑", ""];

            if (creatorParticipant) {
                const creatorJid = creatorParticipant.id || creatorParticipant.jid || creatorParticipant.lid;
                const creatorName = creatorParticipant.notify || creatorParticipant.name || creatorParticipant.pushName || creatorParticipant.displayName || creatorParticipant.vname || creatorParticipant.verifiedName || creatorParticipant.username || null;
                mentions.push(creatorJid);
                lines.push(`👑 Creator`);
                lines.push(`• ${formatMentionText(creatorJid, sock, creatorName)}`);
                lines.push("");
            }

            if (adminEntries.length > 0) {
                lines.push("🛡️ Admins");
                adminEntries.forEach((participant, index) => {
                    const participantJid = participant.id || participant.jid || participant.lid;
                    const participantName = participant.notify || participant.name || participant.pushName || participant.displayName || participant.vname || participant.verifiedName || participant.username || null;
                    if (participantJid) mentions.push(participantJid);
                    lines.push(`${index + 1}. ${formatMentionText(participantJid, sock, participantName)}`);
                });
            }

            await sock.sendMessage(chat, {
                text: lines.join("\n"),
                mentions: Array.from(new Set(mentions.filter(Boolean)))
            }, { quoted: m });

            await sock.sendMessage(chat, {
                react: { text: "👑", key: m.key }
            });
        } catch (err) {
            console.error("[admins.execute]", err);
            await sock.sendMessage(chat, {
                text: "❌ Failed to load the group creator and admins."
            }, { quoted: m });
        }
    }
};
