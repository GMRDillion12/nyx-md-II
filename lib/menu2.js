// Main menu logic for WhatsApp bot
const path = require("path");
const fs = require("fs");

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

const MAIN_MENU = [
    { num: 0, emoji: '0️⃣', label: stylizeText("ALL MENU") },
    { num: 1, emoji: '1️⃣', label: stylizeText("GENERAL MENU") },
    { num: 2, emoji: '2️⃣', label: stylizeText("ADMIN&GROUP MENU") },
    { num: 3, emoji: '3️⃣', label: stylizeText("2DArt MENU") },
    { num: 4, emoji: '4️⃣', label: stylizeText("DOWNLOADER MENU") },
    { num: 5, emoji: '5️⃣', label: stylizeText("FUN&GAMES MENU") },
    { num: 6, emoji: '6️⃣', label: stylizeText("TOOLS MENU") },
    { num: 7, emoji: '7️⃣', label: stylizeText("OWNER MENU") },
    { num: 8, emoji: '8️⃣', label: stylizeText("INTERACTIONS MENU") }
];

function getMainMenuText(userName, uptime, prefix, totalCommands, version = "1.0.0") {
    return (
        `╭━━★彡 ${stylizeText('Nyx-MD')} 彡★━━╮\n` +
        `│ *${stylizeText('NYX-MD MAIN MENU')}*\n` +
        `│ *${stylizeText('USER')}*     : *${userName}*\n` +
        `│ *${stylizeText('PREFIX')}*   : [ *${prefix}* ]\n` +
        `│ *${stylizeText('COMMANDS')}* : [ *${totalCommands}* ]\n` +
        `│ *${stylizeText('UPTIME')}*   : [ *${uptime}* ]\n` +
        `│ *${stylizeText('VERSION')}*  : *${version}*\n` +
        `│ *${stylizeText(`Reply with ${prefix}0-8 to open a menu`)}*\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `「 ${stylizeText('Reply Number ⬇️')} 」\n` +
        MAIN_MENU.map(m => `│ ${m.emoji} ${m.label}`).join("\n") +
        `\n╰━━━━━━━━━━━━━━━━━━╯\n` +
        `\n*${stylizeText('Bot by SilverREN♪')}*`
    );
}


function getSubMenuText(type, prefix, commands) {
    let title = "";
    let emoji = '';
    switch(type) {
        case 1: title = "GENERAL MENU"; emoji = '1️⃣'; break;
        case 2: title = "ADMIN&GROUP MENU"; emoji = '2️⃣'; break;
        case 3: title = "2DArt MENU"; emoji = '3️⃣'; break;
        case 4: title = "DOWNLOADER MENU"; emoji = '4️⃣'; break;
        case 5: title = "FUN&GAMES MENU"; emoji = '5️⃣'; break;
        case 6: title = "TOOLS MENU"; emoji = '6️⃣'; break;
        case 7: title = "OWNER MENU"; emoji = '7️⃣'; break;
        case 8: title = "INTERACTIONS MENU"; emoji = '8️⃣'; break;
        default: title = "MENU";
    }

    let content = "";

    // Check if it's an anime menu with sections
    if (Array.isArray(commands) && commands.every(section => section.heading && Array.isArray(section.commands))) {
        content = commands.map((section, index) => {
            const sectionLines = section.commands
                .map(cmd => `┃ 🔹 *${stylizeText(`${prefix}${cmd.name}`)}*\n┃    └─ ${cmd.description}`)
                .join("\n┃\n");
            const separator = index < commands.length - 1 ? "\n┃\n" : "";
            return `┃ 📌 *${stylizeText(section.heading)}*\n┃\n${sectionLines}${separator}`;
        }).join("");
    } 
    // Regular commands with descriptions
    else if (Array.isArray(commands) && commands.length > 0 && commands[0].name && commands[0].description !== undefined) {
        content = commands
            .map(cmd => `┃ 🔹 *${stylizeText(`${prefix}${cmd.name}`)}*\n┃    └─ ${cmd.description}`)
            .join("\n┃\n");
    }
    // Fallback to simple command list
    else {
        content = commands.map(cmd => `┃ 🔹 *${stylizeText(`${prefix}${cmd}`)}*`).join("\n┃\n");
    }

    return (
        `╭━━★彡 ${stylizeText('Nyx-MD')} 彡★━━╮\n` +
        `┃ ${emoji} *${stylizeText(title)}*\n` +
        `┃\n` +
        content + `\n┃\n` +
        `┣━━━━━━━━━━━━━━━━━\n` +
        `┃ 💡 *${stylizeText('Tip: Use')} ${prefix}_command_\n` +
        `┣━━━━━━━━━━━━━━━━━\n` +
        `┃ 🔙 ${stylizeText(`Reply ${prefix}0 for menu`)}\n` +
        `╰━━━━━━━━━━━━━━━━━╯`
    );
}

module.exports = {
    MAIN_MENU,
    getMainMenuText,
    getSubMenuText
};
