const os = require("os");

module.exports = {
    command: ["alive", "status"],
    category: "general",
    description: "Check bot status",
    execute: async (sock, m, body, config) => {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const text = `╭━━★彡 ${config.botName} 彡★━━╮
┃ 👑 Creator: ${config.ownerName}
┃ ⚙️ Prefix: ${config.prefix}
┃ 🕒 Uptime: ${hours}h ${minutes}m ${seconds}s
┃ 💻 RAM: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB
┃ 🟢 Status: Online
╰━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(m.chat, { text });
    }
};
