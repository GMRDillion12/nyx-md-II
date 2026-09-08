const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const Pino = require("pino");
const qrcode = require("qrcode-terminal");
const readline = require("readline"); // Added to ask you questions in the terminal
const path = require("path");
const config = require("./config");
const handler = require("./lib/handler");
const { getPrefix } = require("./lib/prefixManager");
const { handleParticipantUpdate } = require("./lib/welcome");
const { enforceAntilink } = require("./plugins/group/antilink");
const { enforceAntistatus } = require("./plugins/group/antistatus");
const { processAutoReact } = require("./lib/autoReact");
const { processAutoSticker } = require("./lib/autosticker");
const { initAutoApprove } = require("./lib/autoapprove");
const { getMutedUsers } = require("./lib/database");
const { normalizeJid } = require("./lib/mentions");
const antidelete = require('./lib/antidelete');

// Connection / reconnection helpers
let currentSock = null;
let reconnectAttempts = 0;
let isStarting = false;
const MAX_RECONNECT_BACKOFF = 60000; // 1 minute

const hasTerminal = process.stdin?.isTTY && process.stdout?.isTTY;
const rl = hasTerminal ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const question = async (text) => {
    if (!rl || rl.closed) return null;
    return new Promise((resolve) => {
        try {
            rl.question(text, resolve);
        } catch (err) {
            console.error('[question] terminal prompt unavailable:', err.message);
            resolve(null);
        }
    });
};

function extractMessageText(m) {
    return (m.message?.conversation
        || m.message?.extendedTextMessage?.text
        || m.message?.buttonsResponseMessage?.selectedButtonId
        || m.message?.listResponseMessage?.singleSelectReply?.selectedRowId
        || m.message?.imageMessage?.caption
        || m.message?.videoMessage?.caption
        || m.message?.documentMessage?.caption
        || ""
    ).trim();
}

function getMessageSenderId(m) {
    return (
        m.key?.participant ||
        m.key?.participantAlt ||
        m.key?.remoteJidAlt ||
        m.participant ||
        m.sender ||
        m.message?.extendedTextMessage?.contextInfo?.participant ||
        ''
    );
}

async function startNyx() {
    if (isStarting) {
        console.log('startNyx already running, skipping concurrent start');
        return;
    }
    isStarting = true;
    try {
        // Clean up previous socket if any (best-effort)
        try {
            if (currentSock) {
                try { currentSock.ev.removeAllListeners(); } catch (e) {}
                try { currentSock.ws && currentSock.ws.close && currentSock.ws.close(); } catch (e) {}
                currentSock = null;
            }
        } catch (e) {}
    const authFolder = path.join(__dirname, "auth");
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const logger = Pino({ level: "fatal" });
    const { version } = await fetchLatestBaileysVersion();

    let usePairingCode = false;
    let phoneNumber = "";

    // =========================================================
    // THE PERFECT DUAL-SYSTEM: Ask user which method to use
    // =========================================================
    if (!state.creds.registered) {
        console.log("\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮");
        console.log("┃  NYX-MD CONNECTION SETUP    ┃");
        console.log("╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯");
        console.log("1. Scan QR Code");
        console.log("2. Use Pairing Code");

        let answer = null;
        if (hasTerminal) {
            answer = await question("\nReply with 1 or 2: ");
        } else {
            console.log('⚠️ No interactive terminal detected. Defaulting to QR mode.');
        }

        if (answer && answer.trim() === "2") {
            usePairingCode = true;
            let rawNumber = await question("Enter your WhatsApp number (Country code first, NO '+' e.g. 2348012345678): ");
            // This line automatically cleans up any accidental spaces or dashes you type
            phoneNumber = rawNumber ? rawNumber.replace(/[^0-9]/g, '') : '';
        } else {
            console.log("\nGenerating QR Code... Please wait.\n");
        }
    }
    // =========================================================

    const sock = makeWASocket({
        auth: state,
        logger: logger,
        printQRInTerminal: false, // We handle this manually below to avoid terminal spam
        syncFullHistory: false,
        version: version,
        // 🚨 CRITICAL FIX: Changed from Safari to Ubuntu/Chrome. This stops WhatsApp from rejecting the code!
        browser: ["Ubuntu", "Chrome", "20.0.0"], 
        markOnlineOnConnect: true,

        // Network Optimization
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 3000,
        longPollTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
    });

    handler.attachPlugins(sock);
    try { initAutoApprove(sock); } catch (e) { console.error('[autoapprove] initAutoApprove failed', e); }
    sock.ev.on("creds.update", saveCreds);
    // store current socket reference globally so tag formatting can resolve contact names
    currentSock = sock;
    global.currentSock = sock;
    // Done starting (finalizer will also clear if needed)
    
    // rest of function continues...

    // ================== PAIRING CODE GENERATOR ==================
    if (usePairingCode && !state.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log("\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮");
                console.log(`🔑 YOUR PAIRING CODE: ${code}`);
                console.log("╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n");
            } catch (err) {
                console.error("❌ Failed to get pairing code:", err.message);
            }
        }, 3000); // 3-second delay ensures socket is ready
    }
    // ============================================================

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // ================== QR CODE GENERATOR ==================
        if (qr && !usePairingCode) {
            console.log("Open WhatsApp → Linked Devices → Link a Device");
            qrcode.generate(qr, { small: true });
        }
        // =======================================================

        if (connection === "open") {
            console.log("✅ Nyx-MD connected!");
            // reset reconnect attempts on successful connection
            reconnectAttempts = 0;
            // reload plugins (ensure latest code) and attach to this socket
            try { handler.reloadPlugins(); handler.attachPlugins(sock); } catch (e) { console.error('plugin reload failed', e); }
            try { initAutoApprove(sock); } catch (e) { console.error('[autoapprove] initAutoApprove failed', e); }

            setTimeout(async () => {
                // Send to owner (your WhatsApp)
                const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
                
                for (let i = 0; i < 3; i++) {
                    try {
                        const userInfo = sock.user || {};
                        const userName = userInfo.name || userInfo.notify || "Connected User";
                        const userJid = userInfo.id || sock.user?.jid;

                        let botNumber = "Unknown";
                        if (userJid) {
                            botNumber = userJid.split("@")[0];
                            if (botNumber.startsWith("234")) botNumber = "+" + botNumber;
                        }

                        const timeString = new Date().toLocaleString("en-US", {
                            weekday: "short", year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Lagos"
                        });

                        const message = `
╭━━━★彡 NYX-MD CONNECTED 彡★━━━╮
┃
┃ 🎉 *Successfully Connected!*
┃
┃ 👤 Bot: ${config.botName}
┃ 👤 Owner: ${config.ownerName}
┃ 📱 Number: ${botNumber}
┃ ⏰ Time: ${timeString}
┃
┃ 💡 *Available Commands:*
┃ • .menu - View submenus
┃ • .ping - Check bot status
┃ • .help - Get help
┃ • .0 - View all commands
┃
┃ ✨ Bot is now ready to use!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                        await sock.sendMessage(ownerJid, { text: message });

                        console.log(`✅ Connected message sent to owner!`);
                        break;
                    } catch (err) {
                        console.log(`⚠️ Failed to send connected message (attempt ${i+1}):`, err.message);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }, 5000);
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
            console.log("❌ Nyx-MD disconnected. Reason:", statusCode || "Unknown");

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405;
            if (shouldReconnect) {
                // exponential backoff
                const backoff = Math.min(MAX_RECONNECT_BACKOFF, 2000 * Math.pow(2, reconnectAttempts));
                reconnectAttempts = Math.min(16, reconnectAttempts + 1);
                console.log(`🔁 Attempting reconnect in ${backoff}ms (attempt ${reconnectAttempts})`);
                // best-effort cleanup of previous socket
                try { currentSock && currentSock.ev.removeAllListeners(); } catch (e) {}
                try { currentSock && currentSock.ws && currentSock.ws.close && currentSock.ws.close(); } catch (e) {}
                currentSock = null;
                global.currentSock = null;
                setTimeout(() => startNyx().catch(err => console.error('reconnect failed', err)), backoff);
            } else if (statusCode === 405) {
                console.log("🚫 405 error - WhatsApp blocking this client. Wait 30-60 min.");
            } else {
                console.log("🚫 Logged out. Delete 'auth' folder and relink.");
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        if (!messages?.length) return;

        await Promise.all(messages.map(async (m) => {
            if (!m.message) return;
            const text = extractMessageText(m);
            m.chat = m.key.remoteJid;

            const activePrefix = getPrefix();
            config.prefix = activePrefix;

            // --- Antidelete: handle deletions and store incoming messages ---
            try {
                // If this message is a protocolMessage (revoke), handle revocation
                if (m.message?.protocolMessage) {
                    try { await antidelete.handleMessageRevocation(sock, m); } catch (e) { console.error('antidelete revoke error', e); }
                    return;
                }

                // Store message for potential later revocation handling (best-effort)
                try { antidelete.storeMessage(sock, m).catch(() => {}); } catch (e) {}
            } catch (e) {
                console.error('antidelete integration error', e);
            }

            // Auto-delete messages from muted users in groups before processing commands.
            try {
                const chatId = m.chat || m.key?.remoteJid;
                if (chatId?.endsWith('@g.us')) {
                    const senderId = getMessageSenderId(m);
                    const normalizedSender = normalizeJid(senderId);
                    if (normalizedSender) {
                        const mutedUsers = await getMutedUsers(chatId);
                        if (Array.isArray(mutedUsers) && mutedUsers.includes(normalizedSender)) {
                            try {
                                await sock.sendMessage(chatId, { delete: m.key });
                            } catch (err) {
                                console.error('[mute] failed to delete muted user message:', err?.message || err);
                            }
                            return;
                        }
                    }
                }
            } catch (err) {
                console.error('[mute] mute enforcement error:', err?.message || err);
            }

            const isCommand = text && text.startsWith(activePrefix);

            // If it's a command, prioritize running the handler for lowest latency.
            if (isCommand) {
                try {
                    await handler(sock, m, text, config);
                } catch (err) {
                    console.error("Handler error:", err);
                }

                // Best-effort background tasks (do not delay command response)
                try {
                    processAutoReact(sock, m, text, config).catch(() => {});
                } catch (e) {}
                try {
                    const ownerAutotyping = sock.plugins?.find(p => p.folder === 'owner' && (p.command && (Array.isArray(p.command) ? p.command.includes('autotyping') : p.command === 'autotyping')));
                    if (ownerAutotyping && ownerAutotyping.handleAutotypingForMessage && typeof ownerAutotyping.handleAutotypingForMessage === 'function') {
                        ownerAutotyping.handleAutotypingForMessage(sock, m.chat, text).catch(() => {});
                    }
                } catch (e) {}
                // Do not continue processing this message further
                return;
            }

            // Non-command messages: enforce group rules then react
            try {
                if (text) {
                    await enforceAntilink(sock, m, text, config);
                }
            } catch (err) {
                console.error("Antilink enforcement error:", err);
            }

            try {
                await enforceAntistatus(sock, m, text, config);
            } catch (err) {
                console.error("Antistatus enforcement error:", err);
            }

            try {
                processAutoReact(sock, m, text, config).catch(() => {});
            } catch (err) {
                console.error("Auto-react error:", err);
            }

            try {
                processAutoSticker(sock, m, text, config).catch(() => {});
            } catch (err) {
                console.error("Auto-sticker error:", err);
            }

            // Fire autotyping for regular incoming messages (best-effort)
            try {
                const ownerAutotyping = sock.plugins?.find(p => p.folder === 'owner' && (p.command && (Array.isArray(p.command) ? p.command.includes('autotyping') : p.command === 'autotyping')));
                if (ownerAutotyping && ownerAutotyping.handleAutotypingForMessage && typeof ownerAutotyping.handleAutotypingForMessage === 'function') {
                    // run async and don't await (best-effort)
                    ownerAutotyping.handleAutotypingForMessage(sock, m.chat, text).catch(() => {});
                }
            } catch (e) {
                // non-fatal
            }
        }));
    });

    sock.ev.on("group-participants.update", async (update) => {
        try {
            await handleParticipantUpdate(sock, update);
        } catch (err) {
            console.error("Welcome handler error:", err);
        }
    });

    process.on('SIGINT', async () => {
        console.log("🛑 Ctrl+C pressed - saving session and exiting...");
        await saveCreds();
        process.exit(0);
    });
    } finally {
        // ensure flag is cleared when startup completes or fails
        isStarting = false;
    }
}

startNyx().catch(err => {
    console.error("Start failed:", err);
    setTimeout(startNyx, 10000);
});
