module.exports = {
    command: ["creator"],
    category: "general",
    description: "Show bot creator information",

    async execute(sock, m) {
        try {
            const text = `
╭━━★彡 BOT CREATOR 彡★━━╮
┃ 👤 Name: SilverRen♪
┃ 🤖 Bot: Nyx-MD
┃ 🛠️ Role: Developer & Creator
┃ ✨ Powered by Baileys MD
╰━━━━━━━━━━━━━━━━━━╯
            `;

            await sock.sendMessage(
                m.chat,
                { text },
                { quoted: m }
            );

        } catch (err) {
            console.error("Creator command error:", err);
            await sock.sendMessage(
                m.chat,
                { text: "❌ Failed to load creator info." },
                { quoted: m }
            );
        }
    }
};
