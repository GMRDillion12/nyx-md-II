const { formatMentionText } = require("../../lib/mentions");

module.exports = {
  command: ["gcinfo"],
  category: "group",
  description: "Show group information",

  execute: async (sock, m) => {

    if (!m.chat.endsWith("@g.us")) {
      return sock.sendMessage(
        m.chat,
        { text: "❌ This command can only be used in groups." },
        { quoted: m }
      );
    }

    const metadata = await sock.groupMetadata(m.chat);

    const participants = metadata.participants;
    const admins = participants.filter(v => v.admin);

    const adminList = admins
      .map((v,i)=>{
        const fallbackName = v.notify || v.name || v.pushName || v.displayName || v.vname || v.verifiedName || v.username || null;
        return `${i+1}. ${formatMentionText(v.id, sock, fallbackName)}`;
      })
      .join("\n");

    let invite = "Bot must be admin";

    try {
      const code = await sock.groupInviteCode(m.chat);
      invite = `https://chat.whatsapp.com/${code}`;
    } catch {}

    let pp = "https://i.imgur.com/2wzGhpF.jpeg";
    try {
      pp = await sock.profilePictureUrl(m.chat,"image");
    } catch {}

    const text = `
┌──「 GROUP INFO 」

📛 Name
• ${metadata.subject}

👥 Members
• ${participants.length}

🛡️ Admins
${adminList}

🔗 Invite Link
• ${invite}

📌 Description
• ${metadata.desc || "No description"}

└──────────────
`;

    await sock.sendMessage(
      m.chat,
      {
        image:{url:pp},
        caption:text,
        mentions:admins.map(v=>v.id)
      },
      { quoted:m }
    );

  }
};
