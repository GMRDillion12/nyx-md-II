module.exports = {
    botName: process.env.BOT_NAME || "Nyx-MD",
    ownerName: process.env.OWNER_NAME || "SilverREN♪",
    ownerNumber: (function() {
        // include both the configured owner and the currently observed linked JID
        const raw = process.env.OWNER_NUMBER || "2348129275261 162131139920109";
        if (Array.isArray(raw)) return raw.map(n => String(n).trim()).filter(Boolean);
        return String(raw)
            .split(/[\s,;|]+/)
            .map(part => part.replace(/\D/g, '').trim())
            .filter(Boolean);
    })(),
    prefix: process.env.PREFIX || ".",
    selfMode: Boolean(process.env.SELF_MODE === 'true'),
    antiCall: Boolean(process.env.ANTI_CALL === 'true'),
};
