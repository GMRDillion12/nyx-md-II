module.exports = {
    command: ["owner"],
    category: "general",
    description: "Show bot owner",
    execute: async (sock, m, body, config) => {
        try {
            await sock.sendMessage(m.chat, { text: `Owner: ${config.ownerName} 👑` });
        } catch (err) {
            console.error("Owner command error:", err);
        }
    }
};
