const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "database", "groupSettings.json");

function loadDB() {
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, "{}");
    return JSON.parse(fs.readFileSync(dbPath));
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function getGroup(db, jid) {
    if (!db[jid]) {
        db[jid] = {
            welcome: false,
            antilink: false,
            antispam: false
        };
    }
    return db[jid];
}

module.exports = async (sock, m, text, config) => {
    if (!m.key.remoteJid.endsWith("@g.us")) return;

    const db = loadDB();
    const group = getGroup(db, m.key.remoteJid);

    const sender = m.key.participant;
    const body = text || "";

    /* ================= AUTO REACT ================= */
    if (body.startsWith(config.prefix)) {
        try {
            await sock.sendMessage(m.chat, {
                react: {
                    text: "⚡",
                    key: m.key
                }
            });
        } catch {}
    }

    /* ================= ANTI LINK ================= */
    if (
        group.antilink &&
        body.match(/chat\.whatsapp\.com|https?:\/\//i)
    ) {
        const meta = await sock.groupMetadata(m.chat);
        const admins = meta.participants
            .filter(p => p.admin)
            .map(p => p.id);

        if (!admins.includes(sender)) {
            await sock.sendMessage(m.chat, {
                text: "🚫 Links are not allowed here."
            }, { quoted: m });

            await sock.groupParticipantsUpdate(
                m.chat,
                [sender],
                "remove"
            );
        }
    }

    /* ================= ANTI SPAM ================= */
    if (group.antispam) {
        const now = Date.now();
        if (!group.lastMsg) group.lastMsg = {};

        if (!group.lastMsg[sender]) {
            group.lastMsg[sender] = now;
        } else {
            if (now - group.lastMsg[sender] < 1500) {
                await sock.sendMessage(m.chat, {
                    text: "⚠️ Stop spamming."
                }, { quoted: m });
            }
            group.lastMsg[sender] = now;
        }
        saveDB(db);
    }
};
