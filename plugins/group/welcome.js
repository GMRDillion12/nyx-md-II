const { handleWelcome, handleGoodbye } = require("../../lib/welcome");

module.exports = {
    command: ["welcome", "goodbye"],
    category: "group",
    description: "Manage welcome and goodbye messages",
    groupOnly: true,
    adminOnly: true,

    async execute(sock, m, args, config) {
        const chat = m.chat;
        const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
        const match = text.split(' ').slice(1).join(' ');

        if (text.toLowerCase().startsWith(config.prefix + "welcome")) {
            await handleWelcome(sock, chat, m, match);
        } else if (text.toLowerCase().startsWith(config.prefix + "goodbye")) {
            await handleGoodbye(sock, chat, m, match);
        }
    }
};
