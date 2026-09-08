/**
 * Extract phone number from any WhatsApp JID format
 * Handles: "2348129275261@s.whatsapp.net", "2348129275261:123@s.whatsapp.net", "2348129275261", etc.
 */
function extractPhoneNumber(jid) {
    if (!jid) return "";
    return jid
        .split(":")[0]      // Remove device ID (e.g., ":123")
        .split("@")[0]      // Remove domain (e.g., "@s.whatsapp.net")
        .replace(/\D/g, "") // Remove all non-digits
        .trim();
}

const { loadUserGroupData } = require('./database');

/**
 * Check if a sender is the bot owner
 * @param {string} senderJid - The sender's WhatsApp JID (from m.key.participant or m.key.remoteJid)
 * @param {Array<string>} ownerNumbers - Array of owner phone numbers from config (without @ or :)
 * @returns {boolean} True if sender is the owner
 */
function isOwner(senderJid, ownerNumbers) {
    try {
        if (!senderJid || !ownerNumbers || !Array.isArray(ownerNumbers)) {
            return false;
        }

        // Extract the sender's phone number
        const senderPhone = extractPhoneNumber(senderJid);
        
        // Check if sender's phone matches any owner number
        for (const ownerNum of ownerNumbers) {
            const cleanOwnerNum = extractPhoneNumber(ownerNum);
            if (senderPhone === cleanOwnerNum && senderPhone.length > 0) {
                return true;
            }
        }

        // Also treat sudo users as owners (consult persisted sudo list)
        try {
            const data = loadUserGroupData();
            const sudoList = Array.isArray(data.sudo) ? data.sudo : [];
            for (const s of sudoList) {
                const sPhone = extractPhoneNumber(s);
                if (sPhone && sPhone === senderPhone) return true;
            }
        } catch (e) {
            // ignore and continue
        }

        return false;
    } catch (err) {
        console.error("Error in isOwner check:", err);
        return false;
    }
}

module.exports = { isOwner, extractPhoneNumber };
