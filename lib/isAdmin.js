// lib/isAdmin.js
async function isAdmin(sock, chatId, senderId) {
    try {
        if (!sock?.user) {
            return { isSenderAdmin: false, isBotAdmin: false };
        }
        if (!senderId) {
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        const normalize = (value) => {
            if (!value) return '';
            // Remove session ID (after :) and trim
            return String(value).trim().split(':')[0];
        };

        const extractNumber = (value) => {
            const normalized = normalize(value);
            if (!normalized) return '';
            // Remove everything after @ 
            return normalized.replace(/@.*$/, '');
        };

        const matches = (a, b) => {
            if (!a || !b) return false;
            // First try exact match after normalization
            const normalizedA = normalize(a);
            const normalizedB = normalize(b);
            if (normalizedA && normalizedB && normalizedA === normalizedB) return true;
            
            // If not exact match, try number-only comparison
            const numA = extractNumber(a);
            const numB = extractNumber(b);
            return numA && numB && numA === numB;
        };

        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata?.participants || [];

        const botId = normalize(sock.user?.id || sock.user?.jid || '');
        const botLid = normalize(sock.user?.lid || '');
        
        // Ensure sender ID has proper format
        let senderNorm = normalize(senderId);
        if (!senderNorm.includes('@')) {
            senderNorm = senderNorm + '@s.whatsapp.net';
        }

        let isBotAdmin = false;
        let isSenderAdmin = false;

        for (const p of participants) {
            const pId = normalize(p.id || p.jid || '');
            const pLid = normalize(p.lid || '');
            // Check if participant has any admin role
            const isParticipantAdmin = p.admin && (p.admin === 'admin' || p.admin === 'superadmin' || p.admin === true);

            if (!isBotAdmin && (matches(pId, botId) || matches(pId, botLid) || matches(pLid, botId) || matches(pLid, botLid))) {
                isBotAdmin = isParticipantAdmin;
            }

            if (!isSenderAdmin && (matches(pId, senderNorm) || matches(pLid, senderNorm))) {
                isSenderAdmin = isParticipantAdmin;
            }

            if (isBotAdmin && isSenderAdmin) break;
        }

        return { isSenderAdmin, isBotAdmin };

    } catch (err) {
        console.error('❌ Error in isAdmin:', err.message);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;
