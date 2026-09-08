const fs = require("fs");
const path = require("path");
const reactions = require("./reactions");  // Import the reactions mapping
const { getSudoList } = require('./database');

let plugins = [];

/**
 * Recursively load plugins
 */
function loadPlugins(dir) {
    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);

        try {
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                loadPlugins(fullPath);
            } else if (file.endsWith(".js")) {
                delete require.cache[require.resolve(fullPath)];
                const plugin = require(fullPath);

                if (!plugin.command) continue;
                plugins.push(plugin);
            }
        } catch (err) {
            console.error("❌ Failed to load plugin:", fullPath, err.message);
        }
    }
}

// Load plugins ONCE
plugins = [];
loadPlugins(path.join(__dirname, "../plugins"));

module.exports = async (sock, m, text, config) => {
    try {
        if (!text || !text.startsWith(config.prefix)) return;

        const body = text.slice(config.prefix.length).trim();
        const args = body.split(/\s+/);
        const cmd = args.shift().toLowerCase();

        const plugin = plugins.find(p =>
            Array.isArray(p.command)
                ? p.command.map(c => c.toLowerCase()).includes(cmd)
                : p.command.toLowerCase() === cmd
        );

        if (!plugin) return;

        // Normalize chat & sender
        const chat = m.chat || m.key.remoteJid;
        const senderRaw = m.key.participant || m.key.remoteJid;
        // Fixed: Safely extract number (handles :device in JID)
        const senderNumber = senderRaw.split("@")[0].split(":")[0];
        const sender = `${senderNumber}@s.whatsapp.net`;

        const isGroup = chat.endsWith("@g.us");

        // ================= OWNER ONLY =================
        if (plugin.ownerOnly) {
            const owners = config.ownerNumber.map(n => `${n}@s.whatsapp.net`);
            let isOwnerAllowed = owners.includes(sender);
            try {
                const sudoList = await getSudoList();
                if (!isOwnerAllowed && Array.isArray(sudoList) && sudoList.includes(sender)) {
                    isOwnerAllowed = true;
                }
            } catch (e) {
                console.error('[hdlrold] Failed to fetch sudo list:', e?.message || e);
            }

            console.log("Owner check: Sender:", sender, "Owners:", owners, "SudoAllowed:", isOwnerAllowed);
            if (!isOwnerAllowed) {
                return sock.sendMessage(chat, {
                    text: "❌ This command is owner-only."
                }, { quoted: m });
            }
        }

        // ================= GROUP ONLY =================
        if (plugin.groupOnly && !isGroup) {
            return sock.sendMessage(chat, {
                text: "❌ This command can only be used in groups."
            }, { quoted: m });
        }

        // ================= ADMIN ONLY =================
        if (plugin.adminOnly && isGroup) {
            const meta = await sock.groupMetadata(chat);
            const participants = meta.participants;

            const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";

            const userIsAdmin = participants.some(
                p => p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
            );

            const botIsAdmin = participants.some(
                p => p.id === botId && (p.admin === "admin" || p.admin === "superadmin")
            );

            if (!userIsAdmin) {
                return sock.sendMessage(chat, {
                    text: "❌ You must be a group admin to use this."
                }, { quoted: m });
            }

            if (!botIsAdmin) {
                return sock.sendMessage(chat, {
                    text: "❌ I must be an admin to do that."
                }, { quoted: m });
            }
        }

        // ================= REACT TO COMMAND =================
        const emoji = reactions[plugin.category] || reactions.default;  // Use category if present, else default
        if (emoji) {
            await sock.sendMessage(chat, {
                react: {
                    text: emoji,
                    key: m.key
                }
            });
        }

        // ================= EXECUTE PLUGIN =================
        if (typeof plugin.run === "function") {
            await plugin.run(sock, m, args, config);
        } else if (typeof plugin.execute === "function") {
            await plugin.execute(sock, m, args, config);
        } else {
            console.warn(`⚠️ Plugin "${cmd}" has no run/execute method`);
        }

    } catch (err) {
        console.error("❌ Handler error:", err);
        await sock.sendMessage(m.chat, {
            text: "❌ An internal error occurred."
        }, { quoted: m });
    }
};

// Export for menu/help
module.exports.plugins = plugins;

// expose plugins to socket
module.exports.attachPlugins = (sock) => {
    sock.plugins = plugins;
};
