const { getPrefix, setPrefix } = require("../../lib/prefixManager");

module.exports = {
    command: ["setprefix", "changeprefix"],
    category: "owner",
    description: "Change the bot's command prefix in real-time",
    ownerOnly: false,

    async execute(sock, m, args, config) {
        try {
            const chat = m.chat || m.key?.remoteJid;

            // Get new prefix from arguments
            const newPrefix = args.join(" ").trim();
            const oldPrefix = getPrefix();

            if (!newPrefix) {
                const currentPrefix = oldPrefix;
                return sock.sendMessage(chat, {
                    text: `❓ Current prefix: \`${currentPrefix}\`\n\nUsage: ${currentPrefix}setprefix <new_prefix>\nExample: ${currentPrefix}setprefix !`
                }, { quoted: m });
            }

            // Validate prefix length
            if (newPrefix.length > 3) {
                return sock.sendMessage(chat, {
                    text: `❌ Prefix must be 1-3 characters long.\nExample: ${oldPrefix}setprefix !`
                }, { quoted: m });
            }

            // Save new prefix
            const success = setPrefix(newPrefix);

            if (!success) {
                return sock.sendMessage(chat, {
                    text: "❌ Failed to change prefix. Try again."
                }, { quoted: m });
            }

            if (config) config.prefix = newPrefix;

            // Send confirmation
            await sock.sendMessage(chat, {
                text: `✅ Prefix changed successfully!\n\n📌 Old prefix: \`${oldPrefix}\`\n📌 New prefix: \`${newPrefix}\`\n\nNow use: \`${newPrefix}menu\` to see all commands`
            }, { quoted: m });

            // React to show success
            await sock.sendMessage(chat, {
                react: { text: "✅", key: m.key }
            });

            console.log(`🔄 Prefix changed to: ${newPrefix}`);

        } catch (error) {
            console.error("Setprefix command error:", error);
            await sock.sendMessage(m.chat, {
                text: "❌ Error changing prefix. Please try again."
            }, { quoted: m });
        }
    }
};
