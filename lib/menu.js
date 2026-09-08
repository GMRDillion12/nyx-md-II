const fs = require("fs");
const path = require("path");

const FANCY_UPPER = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ';
const FANCY_LOWER = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ';
const FANCY_DIGITS = '0123456789';

function stylizeText(text) {
    return text.split('').map(char => {
        if (char >= 'A' && char <= 'Z') {
            return FANCY_UPPER.charAt(char.charCodeAt(0) - 65);
        }
        if (char >= 'a' && char <= 'z') {
            return FANCY_LOWER.charAt(char.charCodeAt(0) - 97);
        }
        if (char >= '0' && char <= '9') {
            return FANCY_DIGITS.charAt(char.charCodeAt(0) - 48);
        }
        return char;
    }).join('');
}

let cachedCategories = null;

function loadCategories() {
    if (cachedCategories) return cachedCategories;

    const baseDir = path.join(__dirname, "../plugins");
    const categories = {};

    function scanDir(dir) {
        for (const file of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, file);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    scanDir(fullPath);
                } else if (file.endsWith(".js")) {
                    delete require.cache[require.resolve(fullPath)];
                    const plugin = require(fullPath);
                    if (!plugin || !plugin.category || !plugin.command) continue;
                    if (!categories[plugin.category]) categories[plugin.category] = [];
                    categories[plugin.category].push(plugin);
                }
            } catch (err) {
                console.error(`Failed to load plugin: ${fullPath}`, err.message);
            }
        }
    }

    scanDir(baseDir);
    cachedCategories = categories;
    return cachedCategories;
}

function getAllCommandsText(config, userName = "User", uptime = "0 minutes") {
    const categories = loadCategories();
    const p = config.prefix || ".";
    const totalCommands = Object.values(categories).reduce((sum, list) => sum + list.length, 0);
    const totalCategories = Object.keys(categories).length;
    const botName = config.botName || "Nyx-MD";

    let text = `╭━━★彡 ${stylizeText(botName)} 彡★━━╮
│ *${stylizeText('ALL COMMANDS MENU')}*
│ *${stylizeText('BOT NAME')}*   : *${stylizeText(botName)}*
│ *${stylizeText('USER')}*       : ${stylizeText(userName)}
│ *${stylizeText('VERSION')}*    : *${stylizeText('1.7.0')}*
│ *${stylizeText('PREFIX')}*     : [ *${stylizeText(p)}* ]
│ *${stylizeText('COMMANDS')}*   : ${stylizeText(String(totalCommands))}
│ *${stylizeText('CATEGORIES')}* : ${stylizeText(String(totalCategories))}
│ *${stylizeText('UPTIME')}*     : [ *${stylizeText(uptime)}* ]
│ *${stylizeText('DEVELOPER')}*  : *${stylizeText('SilverREN♪')}*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;

    const categoryOrder = [
        "general",
        "owner",
        "group",
        "interactions",
        "animesfw",
        "animensfw",
        "sfwgif",
        "nsfwgif",
        "fun",
        "tools",
        "downloaders"
    ];

    for (const cat of categoryOrder) {
        if (!categories[cat]) continue;
        text += `\n🎴 *${stylizeText(cat.toUpperCase())}*\n`;
        const sortedPlugins = categories[cat].sort((a, b) => {
            const aCmd = Array.isArray(a.command) ? a.command[0] : a.command;
            const bCmd = Array.isArray(b.command) ? b.command[0] : b.command;
            return aCmd.localeCompare(bCmd, undefined, { sensitivity: 'base' });
        });
        for (const plugin of sortedPlugins) {
            const cmds = Array.isArray(plugin.command)
                ? plugin.command.map(c => stylizeText(`${p}${c}`)).join(", ")
                : stylizeText(`${p}${plugin.command}`);
            text += `┣ ✦ ${cmds}\n`;
        }
        text += "┗━━━━━━━━━━━\n";
    }

    for (const cat of Object.keys(categories)) {
        if (categoryOrder.includes(cat)) continue;
        text += `\n🎴 *${stylizeText(cat.toUpperCase())}*\n`;
        for (const plugin of categories[cat]) {
            const cmds = Array.isArray(plugin.command)
                ? plugin.command.map(c => stylizeText(`${p}${c}`)).join(", ")
                : stylizeText(`${p}${plugin.command}`);
            text += `┣ ✦ ${cmds}\n`;
        }
        text += "┗━━━━━━━━━━━\n";
    }

    return text;
}

function reloadMenuCache() {
    cachedCategories = null;
}

module.exports = getAllCommandsText;
module.exports.reloadMenuCache = reloadMenuCache;
