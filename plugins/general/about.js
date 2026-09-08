module.exports = {
    command: ["about"],
    category: "general",
    execute: async (sock, m, body, config) => {
        const text = `*${config.botName}*\nOwner: ${config.ownerName}\nPrefix: ${config.prefix}\nCommands: Auto-loaded from plugins folder`;
        await sock.sendMessage(m.chat, { text });
    }
};
