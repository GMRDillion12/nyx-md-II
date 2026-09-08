const fs = require("fs");
const path = require("path");
const reactions = require("./reactions");  // Import the reactions mapping
const isAdmin = require("./isAdmin");
const { getSubMenuText } = require("./menu2");
const { getPrefix } = require("./prefixManager");
const { isOwner, extractPhoneNumber } = require("./isOwner");
const { getSudoList, loadUserGroupData } = require("./database");
const nsfwAuth = require("./nsfwAuth");

let plugins = [];
const commandMap = new Map();
const baseDir = path.join(__dirname, "../plugins");

function registerPlugin(plugin, fullPath) {
    if (!plugin || !plugin.command) return;

    const relativePath = path.relative(baseDir, fullPath);
    plugin.folder = relativePath.split(path.sep)[0];
    plugins.push(plugin);

    const commands = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
    const aliases = Array.isArray(plugin.aliases) ? plugin.aliases : [];

    for (const item of [...commands, ...aliases]) {
        if (!item) continue;
        const key = item.toString().toLowerCase();
        const existingPlugin = commandMap.get(key);

        if (existingPlugin) {
            const existingFolder = existingPlugin.folder || '';
            const currentFolder = plugin.folder || '';

            // Prefer owner folder commands over duplicate aliases from other categories.
            if (existingFolder === 'owner') {
                continue;
            }
            if (currentFolder === 'owner') {
                commandMap.set(key, plugin);
                continue;
            }

            continue;
        }

        commandMap.set(key, plugin);
    }
}

function clearPluginRegistry() {
    plugins = [];
    commandMap.clear();
}

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

                registerPlugin(plugin, fullPath);
            }
        } catch (err) {
            console.error("❌ Failed to load plugin:", fullPath, err.message);
        }
    }
}

// Load plugins ONCE
clearPluginRegistry();
loadPlugins(baseDir);

// Expose a reload helper for runtime reconnection to refresh plugin list
function reloadPlugins() {
    clearPluginRegistry();
    loadPlugins(baseDir);
}

module.exports.reloadPlugins = reloadPlugins;

function getCommandsFromFolder(folder) {
    return plugins
        .filter(plugin => plugin.folder === folder)
        .flatMap(plugin => Array.isArray(plugin.command) ? plugin.command : [plugin.command])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// Get commands WITH descriptions
function getCommandsWithDescFromFolder(folder) {
    return plugins
        .filter(plugin => plugin.folder === folder)
        .map(plugin => {
            const commands = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
            return commands.map(cmd => ({
                name: cmd,
                description: plugin.description || 'No description'
            }));
        })
        .flat()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function getCommandsFromFolders(folders) {
    let cmds = [];
    for (const folder of folders) {
        cmds = cmds.concat(getCommandsFromFolder(folder));
    }
    return cmds;
}

function getCommandsWithDescFromFolders(folders) {
    let cmds = [];
    for (const folder of folders) {
        cmds = cmds.concat(getCommandsWithDescFromFolder(folder));
    }
    return cmds;
}

function getAnimeMenuSections() {
    return [
        { heading: "SFW", commands: getCommandsWithDescFromFolder("animesfw") },
        { heading: "NSFW", commands: getCommandsWithDescFromFolder("animensfw") },
        { heading: "SFW GIF", commands: getCommandsWithDescFromFolder("sfwgif") },
        { heading: "NSFW GIF", commands: getCommandsWithDescFromFolder("nsfwgif") }
    ];
}

function normalizeJid(jid) {
    if (!jid) return '';
    return jid.toString().split(':')[0].trim();
}

function getSenderId(m, isGroup = false, sock = null) {
    if (!m) return '';

    // Prefer explicit participant fields when present
    const participant = (
        m.key?.participant ||
        m.participant ||
        m.message?.extendedTextMessage?.contextInfo?.participant ||
        m.message?.sender ||
        m.sender
    );

    if (participant && String(participant).trim()) {
        return String(participant).trim();
    }

    // If the message is from the current session (fromMe), use the socket user id
    const fromMe = m.key?.fromMe || m.fromMe;
    if (fromMe && sock && (sock.user?.id || sock.user?.jid)) {
        return String(sock.user?.id || sock.user?.jid).trim();
    }

    // Fallback for one-to-one chats: use remoteJid
    if (!isGroup && m.key?.remoteJid) {
        return String(m.key.remoteJid).trim();
    }

    return '';
}

function toWhatsappJid(jid) {
    const number = extractPhoneNumber(jid);
    return number ? `${number}@s.whatsapp.net` : jid.toString();
}

function isGhostGroup(chatId) {
    if (!chatId || !String(chatId).endsWith('@g.us')) return false;
    try {
        const data = loadUserGroupData();
        return Boolean(data?.ghost?.[chatId]?.enabled);
    } catch (error) {
        return false;
    }
}

async function resolveSenderJid(sock, chat, senderRaw) {
    if (!senderRaw || !chat?.endsWith("@g.us")) return senderRaw;
    const senderStr = senderRaw.toString();
    if (!senderStr.includes("@lid")) return senderRaw;

    try {
        const metadata = await sock.groupMetadata(chat);
        const participants = metadata?.participants || [];
        const senderNumber = extractPhoneNumber(senderStr);
        const senderNormalized = senderNumber ? `${senderNumber}@s.whatsapp.net` : senderStr;

        const matched = participants.find(p => {
            const pId = p.id?.toString() || p.jid?.toString() || '';
            const pLid = p.lid?.toString() || '';
            const pIdNumber = extractPhoneNumber(pId);
            const pLidNumber = extractPhoneNumber(pLid);

            return pId === senderStr ||
                pLid === senderStr ||
                (pIdNumber && pIdNumber === senderNumber) ||
                (pLidNumber && pLidNumber === senderNumber);
        });

        if (matched?.id) return matched.id;
        if (matched?.jid) return matched.jid;
        return senderNormalized;
    } catch (err) {
        console.error("[resolveSenderJid] failed to resolve @lid sender:", err);
        return toWhatsappJid(senderRaw);
    }
}

module.exports = async (sock, m, text, config) => {
    try {
        // Get dynamic prefix
        const prefix = getPrefix();
        if (config) config.prefix = prefix;
        
        // Set m.body
        m.body = text;

        // Parse mentioned JIDs and quoted message
        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        m.mentionedJid = contextInfo?.mentionedJid || [];
        
        // Set up quoted message info
        if (contextInfo?.quotedMessage) {
            m.quoted = {
                key: {
                    remoteJid: m.chat || m.key.remoteJid,
                    fromMe: contextInfo.participant === sock.user.id,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: contextInfo.quotedMessage,
                sender: contextInfo.participant || contextInfo.quotedMessage?.conversation?.key?.participant
            };
        } else {
            m.quoted = null;
        }

        if (!text || !text.startsWith(prefix)) return;

        const chat = m.chat || m.key?.remoteJid;
        const isGroup = chat?.endsWith("@g.us");
        const body = text.slice(prefix.length).trim();
        const args = body.split(/\s+/);
        const cmd = args.shift().toLowerCase();

        if (isGroup && isGhostGroup(chat) && cmd !== 'ghost') {
            return;
        }

        // Handle menu number replies - using dynamic prefix like .1, !1, etc.
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        // Allow optional extra selection for some menus (e.g., ".31" or ".3 1" to pick an anime category)
        // Accept both adjacent digit (no space) and spaced digit
        const menuRegex = new RegExp(`^${escapedPrefix}([0-8])(?:\\s*([0-9]))?$`);
        const menuMatch = text && text.trim().match(menuRegex);
        if (menuMatch) {
            const num = parseInt(menuMatch[1]);
            const extra = menuMatch[2] ? menuMatch[2].trim() : null;
            const SUBMENUS = {
                1: { label: "GENERAL MENU", folders: ["general"], category: "general" },
                2: { label: "ADMIN&GROUP MENU", folders: ["group"], category: "group" },
                // For anime menu we support a two-step text flow: ".3" lists 4 categories,
                // ".3 1" shows SFW commands, ".3 2" shows NSFW commands, etc.
                3: { label: "ANIME MENU", folders: ["animesfw", "animensfw", "sfwgif", "nsfwgif"], category: "animensfw" },
                4: { label: "DOWNLOADER MENU", folders: ["downloaders"], category: "downloaders" },
                5: { label: "FUN&GAMES MENU", folders: ["fun"], category: "fun" },
                6: { label: "TOOLS MENU", folders: ["tools"], category: "tools" },
                7: { label: "OWNER MENU", folders: ["owner"], category: "owner" },
                8: { label: "INTERACTIONS MENU", folders: ["interactions"], category: "interactions" }
            };
            const submenu = SUBMENUS[num];
            if (submenu) {
                // If this is the anime menu and the user provided an extra selection
                // (e.g. ".3 1"), show only that folder's commands. If no extra selection,
                // show a compact category list instructing the user to reply with ".3 <n>".
                let menuText;
                if (num === 3 && extra) {
                    const map = { '1': 'animesfw', '2': 'animensfw', '3': 'sfwgif', '4': 'nsfwgif' };
                    const folder = map[extra] || null;
                    if (folder) {
                        const chat = m.chat || m.key?.remoteJid;
                        const senderMenu = getSenderId(m, chat?.endsWith('@g.us'), sock);
                        const ownerNumbersMenu = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber];
                        const ownerPhonesMenu = ownerNumbersMenu.map(n => extractPhoneNumber(n)).filter(Boolean);
                        const senderPhoneMenu = extractPhoneNumber(senderMenu);
                        const isOwnerMenu = senderPhoneMenu && ownerPhonesMenu.includes(senderPhoneMenu);

                        if (['animensfw', 'nsfwgif'].includes(folder)) {
                            const allowed = await nsfwAuth.ensureAccess({
                                senderJid: senderMenu,
                                isOwnerBypass: isOwnerMenu,
                                sock,
                                m,
                                ownerJids: ownerNumbersMenu
                            });
                            if (!allowed) return;
                        }

                        const cmds = getCommandsWithDescFromFolder(folder);
                        menuText = getSubMenuText(num, prefix, cmds);
                    } else {
                        menuText = `Invalid selection. Reply with ${prefix}3 followed by 1-4 to choose a category.`;
                    }
                } else if (num === 3 && !extra) {
                    // Compact category list for anime menu
                    const botPrefix = prefix;
                    menuText = `╭━━★彡 Anime Categories 彡★━━╮\n` +
                        `┃ 1️⃣ SFW (Reply with ${botPrefix}3 1)\n` +
                        `┃ 2️⃣ NSFW (Reply with ${botPrefix}3 2)\n` +
                        `┃ 3️⃣ SFW GIF (Reply with ${botPrefix}3 3)\n` +
                        `┃ 4️⃣ NSFW GIF (Reply with ${botPrefix}3 4)\n` +
                        `┣━━━━━━━━━━━━━━━━━\n` +
                        `┃ 🔙 Reply ${botPrefix}0 for main menu\n` +
                        `╰━━━━━━━━━━━━━━━━━╯`;
                } else {
                    const cmds = getCommandsWithDescFromFolders(submenu.folders);
                    menuText = getSubMenuText(num, prefix, cmds);
                }

                // Send submenu with image, just like main menu
                const chat = m.chat || m.key?.remoteJid;
                const imagePath = path.join(__dirname, "../assets/menu.jpg");
                if (fs.existsSync(imagePath)) {
                    try {
                        const sentMsg = await sock.sendMessage(chat, {
                            image: { url: imagePath },
                            caption: menuText
                        }, { quoted: m });

                        // Add reaction
                        const categoryEmoji = reactions[submenu.category] || reactions.default;
                        try {
                            await sock.sendMessage(chat, { react: { text: categoryEmoji, key: sentMsg.key } });
                        } catch (e) {
                            // Reaction not critical
                        }
                    } catch (imgErr) {
                        // Fallback to text if image loading fails
                        const sentMsg = await sock.sendMessage(chat, { text: menuText }, { quoted: m });
                        const categoryEmoji = reactions[submenu.category] || reactions.default;
                        try {
                            await sock.sendMessage(chat, { react: { text: categoryEmoji, key: sentMsg.key } });
                        } catch (e) {
                            // Reaction not critical
                        }
                    }
                } else {
                    const sentMsg = await sock.sendMessage(chat, { text: menuText }, { quoted: m });
                    const categoryEmoji = reactions[submenu.category] || reactions.default;
                    try {
                        await sock.sendMessage(chat, { react: { text: categoryEmoji, key: sentMsg.key } });
                    } catch (e) {
                        // Reaction not critical
                    }
                }
                return;
            }
        }

        const plugin = commandMap.get(cmd);
        if (!plugin) return;

        // Normalize chat & sender
        const chatNormalized = m.chat || m.key.remoteJid;
        const isGroupNormalized = chatNormalized?.endsWith("@g.us");

        // Use alternate IDs if available (LID -> PN mapping)
        const altSender = m.key?.participantAlt || m.key?.remoteJidAlt || null;
        const rawSender = altSender || getSenderId(m, isGroupNormalized, sock);
        const senderRaw = await resolveSenderJid(sock, chatNormalized, rawSender);
        const sender = toWhatsappJid(senderRaw);
        const senderFallback = toWhatsappJid(senderRaw);

        // ================= OWNER ONLY =================
        const configuredOwners = Array.isArray(config.ownerNumber) ? config.ownerNumber : [];
        const currentSessionOwner = sock.user?.id || sock.user?.jid || sock.user?.phone || '';

        const ownerCandidates = [...configuredOwners, currentSessionOwner]
            .map(n => n ? String(n).trim() : '')
            .filter(Boolean);

        const ownerVariantSet = new Set([
            ...ownerCandidates,
            ...ownerCandidates
                .map(extractPhoneNumber)
                .filter(Boolean)
                .map(phone => `${phone}@s.whatsapp.net`)
        ]);

        const senderCandidates = [
            senderRaw,
            senderFallback,
            sender,
            m.key?.participant,
            m.key?.remoteJid,
            m.sender,
            m.message?.extendedTextMessage?.contextInfo?.participant
        ].filter(Boolean).map(String);

        const senderPhones = senderCandidates
            .map(extractPhoneNumber)
            .filter(Boolean);

        const isStrictOwner = senderPhones.some(senderPhone =>
            ownerCandidates.some(owner => extractPhoneNumber(owner) === senderPhone)
        );

        let isOwnerCheck = senderCandidates.some(candidate => isOwner(candidate, ownerCandidates));

        // If the raw command came from the owner in DM or group, preserve owner bypass for NSFW commands even when the plugin isn't ownerOnly
        if (!isOwnerCheck && isStrictOwner) {
            isOwnerCheck = true;
        }

        // Allow sudo users (config-stored sudo) to act as owners for ownerOnly commands
        if (!isOwnerCheck) {
            try {
                const sudoList = await getSudoList(); // normalized jids like '123@s.whatsapp.net'
                const senderDigits = senderPhones.find(Boolean);
                const senderNormalizedJid = senderDigits ? `${senderDigits}@s.whatsapp.net` : null;
                if (sudoList && Array.isArray(sudoList) && senderNormalizedJid && sudoList.includes(senderNormalizedJid)) {
                    isOwnerCheck = true;
                }
            } catch (e) {
                console.error('[handler] Failed to fetch sudo list:', e?.message || e);
            }
        }

        const isOwnerBypass = isStrictOwner;

        const ownersFormatted = [...new Set(ownerCandidates)].map(n => String(n).trim());
        const senderCandidatesFormatted = [...new Set(senderCandidates)].map(n => String(n).trim());

        if (plugin.ownerOnly) {
            console.log(`\n👑 Owner Check for ${cmd}:`);
            console.log(`   Raw Sender: ${rawSender}`);
            console.log(`   Alternate Sender: ${altSender || 'N/A'}`);
            console.log(`   Resolved Sender: ${senderRaw}`);
            console.log(`   Sender Normalized: ${sender}`);
            console.log(`   Sender Fallback: ${senderFallback}`);
            console.log(`   Sender Candidates: ${senderCandidatesFormatted.join(", ")}`);
            console.log(`   Owner Candidates: ${ownersFormatted.join(", ")}`);
            console.log(`   Is Owner: ${isOwnerCheck}\n`);
            
            if (!isOwnerCheck) {
                return sock.sendMessage(chat, {
                    text: "❌ This command is owner-only."
                }, { quoted: m });
            }
        }

        // ================= PRIVATE MODE =================
        if (config.selfMode && !plugin.ownerOnly && !isOwnerCheck) {
            return sock.sendMessage(chat, {
                text: "🔒 This bot is currently in PRIVATE mode. Only the owner can use commands."
            }, { quoted: m });
        }

        // ================= GROUP ONLY =================
        if (plugin.groupOnly && !isGroup) {
            return sock.sendMessage(chat, {
                text: "❌ This command can only be used in groups."
            }, { quoted: m });
        }

        // ================= ADMIN ONLY =================
        if (plugin.adminOnly && isGroup) {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chat, sender);

            if (!isSenderAdmin) {
                return sock.sendMessage(chat, {
                    text: "❌ You must be a group admin to use this."
                }, { quoted: m });
            }

            if (!isBotAdmin) {
                return sock.sendMessage(chat, {
                    text: "❌ I must be an admin to do that."
                }, { quoted: m });
            }
        }

        // ================= NSFW PASSWORD GATE =================
        if (['animensfw', 'nsfwgif'].includes(plugin.folder)) {
            const ownerJids = [...ownerVariantSet];
            const senderJidCandidates = [sender, senderRaw, senderFallback, m.key?.participant, m.key?.remoteJid, m.sender].filter(Boolean);
            const hasAccess = await nsfwAuth.ensureAccess({
                senderJid: sender,
                senderJids: senderJidCandidates,
                isOwnerBypass: isOwnerCheck,
                sock,
                m,
                ownerJids
            });
            if (!hasAccess) {
                return;
            }
        }

        // ================= REACT TO COMMAND =================
        const emoji = reactions[plugin.category] || reactions.default;
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

        // Try to show a brief 'typing' status after command execution if enabled
        try {
            const ownerAutotyping = plugins.find(p => p.folder === 'owner' && (p.command && (Array.isArray(p.command) ? p.command.includes('autotyping') : p.command === 'autotyping')));
            if (ownerAutotyping && ownerAutotyping.showTypingAfterCommand && typeof ownerAutotyping.showTypingAfterCommand === 'function') {
                // run async but don't await to avoid delaying handler exit (best-effort)
                ownerAutotyping.showTypingAfterCommand(sock, chat).catch(e => {});
            }
        } catch (e) {
            // Non-fatal
        }

    } catch (err) {
        console.error("❌ Handler error:", err);
        await sock.sendMessage(m.chat, {
            text: "❌ An internal error occurred."
        }, { quoted: m });
    }
};

// Export for menu/help
module.exports.isGhostGroup = isGhostGroup;

Object.defineProperty(module.exports, 'plugins', {
    get() {
        return plugins;
    }
});

// expose plugins to socket
module.exports.attachPlugins = (sock) => {
    sock.plugins = plugins;

    // Initialize plugins that expose an init hook for background tasks
    for (const plugin of plugins) {
        if (!plugin) continue;
        try {
            if (typeof plugin.init === 'function') {
                try {
                    plugin.init(sock);
                } catch (errInit) {
                    console.error('[handler.attachPlugins] plugin.init error for', plugin.command || '<unknown>', errInit?.message || errInit);
                }
            }
        } catch (err) {
            console.error('[handler.attachPlugins] failed to init plugin', err?.message || err);
        }
    }
};

module.exports.reloadPlugins = () => {
    plugins = [];
    loadPlugins(baseDir);
    return plugins;
};
