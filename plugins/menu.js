const path = require("path");
const fs = require("fs");
const { getMainMenuText } = require("../lib/menu2");
const getAllCommandsText = require("../lib/menu");

module.exports = {
    command: ["menu", "help", "0"],
    category: "general",
    description: "Show Nyx-MD main menu or .0 to list all commands",

    async execute(sock, m, args, config) {
        try {
            let userName = "User";
            const userInfo = sock.user || {};
            if (userInfo.name) userName = userInfo.name;
            else if (userInfo.notify) userName = userInfo.notify;
            else if (userInfo.verifiedName) userName = userInfo.verifiedName;
            if (userName === "User" && userInfo.id) {
                const number = userInfo.id.split("@")[0];
                userName = "+" + number;
            }
            const uptimeMs = process.uptime() * 1000;
            const uptime = formatUptime(uptimeMs);

            // Count all commands in all folders for main menu
            const allFolders = ["general","group","interactions","2DArt","downloaders","fun","tools"];
            let totalCommands = 0;
            for (const folder of allFolders) {
                const folderPath = path.join(__dirname, folder);
                if (!fs.existsSync(folderPath)) continue;
                for (const file of fs.readdirSync(folderPath)) {
                    if (file.endsWith(".js")) totalCommands++;
                }
            }
            const version = require("../package.json").version || "1.0.0";

            // Show main menu with video when available, but keep the full command list as text.
            const body = m.body ? m.body.slice(config.prefix.length).trim() : "";
            const isAllCommandsMenu = body === "0";
            const menuText = isAllCommandsMenu
                ? getAllCommandsText(config, userName, uptime)
                : getMainMenuText(userName, uptime, config.prefix, totalCommands, version);
            const chat = m.chat || m.key?.remoteJid;
            const videoPath = path.join(__dirname, "../assets/menuvideo.mp4");
            const imagePath = path.join(__dirname, "../assets/menu.jpg");
            let sentMenuMsg = null;

            if (!isAllCommandsMenu && fs.existsSync(videoPath)) {
                try {
                    sentMenuMsg = await sock.sendMessage(chat, {
                        video: { url: videoPath },
                        mimetype: 'video/mp4',
                        caption: menuText,
                        gifPlayback: true,
                        autoplay: true
                    }, { quoted: m });
                } catch (videoErr) {
                    console.error('❌ Main menu video upload failed, falling back to image/text:', videoErr.message);
                    if (fs.existsSync(imagePath)) {
                        try {
                            sentMenuMsg = await sock.sendMessage(chat, {
                                image: { url: imagePath },
                                caption: menuText
                            }, { quoted: m });
                        } catch (imageErr) {
                            console.error('❌ Menu image upload failed, falling back to text menu:', imageErr.message);
                            sentMenuMsg = await sock.sendMessage(chat, { text: menuText }, { quoted: m });
                        }
                    } else {
                        sentMenuMsg = await sock.sendMessage(chat, { text: menuText }, { quoted: m });
                    }
                }
            } else if (fs.existsSync(imagePath) && isAllCommandsMenu) {
                try {
                    sentMenuMsg = await sock.sendMessage(chat, {
                        image: { url: imagePath },
                        caption: menuText
                    }, { quoted: m });
                } catch (imageErr) {
                    console.error('❌ Menu image upload failed, falling back to text menu:', imageErr.message);
                    sentMenuMsg = await sock.sendMessage(chat, { text: menuText }, { quoted: m });
                }
            } else if (fs.existsSync(imagePath)) {
                try {
                    sentMenuMsg = await sock.sendMessage(chat, {
                        image: { url: imagePath },
                        caption: menuText
                    }, { quoted: m });
                } catch (imageErr) {
                    console.error('❌ Menu image upload failed, falling back to text menu:', imageErr.message);
                    sentMenuMsg = await sock.sendMessage(chat, { text: menuText }, { quoted: m });
                }
            } else {
                sentMenuMsg = await sock.sendMessage(chat, { text: menuText }, { quoted: m });
            }

            // Send menu audio after the menu text/image, replying to the sent menu message
            try {
                const audioPath = path.join(__dirname, "../assets/menumusic.mp3");
                if (fs.existsSync(audioPath) && sentMenuMsg) {
                    try {
                        await sock.sendMessage(chat, {
                            audio: { url: audioPath },
                            mimetype: 'audio/mpeg'
                        }, { quoted: sentMenuMsg });
                    } catch (audioFallbackErr) {
                        const audioBuffer = fs.readFileSync(audioPath);
                        await sock.sendMessage(chat, {
                            audio: audioBuffer,
                            mimetype: 'audio/mpeg'
                        }, { quoted: sentMenuMsg });
                    }
                }
            } catch (audioErr) {
                console.error('❌ Failed to send menu audio:', audioErr.message);
            }
        } catch (err) {
            console.error("\u274c Menu command error:", err.message);
            await sock.sendMessage(m.chat, { text: "\u274c Failed to load menu." }, { quoted: m });
        }
    }
};

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m ${seconds % 60}s`;
}