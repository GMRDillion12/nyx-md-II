module.exports = {
    command: ["ping"],
    category: "general",
    description: "Check bot response speed",
    execute: async (sock, m) => {
        const start = Date.now();

        const msg = await sock.sendMessage(m.chat, {
            text: "⏳ Pinging Nyx..."
        });

        const speed = Date.now() - start;

        await sock.sendMessage(m.chat, {
            text: `🏓 *PONG!*
⚡ Speed: *${speed} ms*
🌑 Nyx is online`,
            edit: msg.key
        });
    }
};
