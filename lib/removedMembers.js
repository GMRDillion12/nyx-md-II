const fs = require('fs');
const path = require('path');

const removedMembersFile = path.join(__dirname, '..', 'data', 'removedMembers.json');

function ensureDataFile() {
    if (!fs.existsSync(removedMembersFile)) {
        fs.writeFileSync(removedMembersFile, JSON.stringify({}, null, 2), 'utf8');
    }
}

function readData() {
    ensureDataFile();
    try {
        const raw = fs.readFileSync(removedMembersFile, 'utf8');
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error('[REMOVED MEMBERS] Failed to read removedMembers.json:', err.message);
        return {};
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(removedMembersFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('[REMOVED MEMBERS] Failed to write removedMembers.json:', err.message);
    }
}

function normalizeUserJid(jid) {
    if (!jid) return '';
    const raw = typeof jid === 'string' ? jid : String(jid);
    if (raw.includes('@')) return raw;
    return `${raw}@s.whatsapp.net`;
}

function getRemovedMembers(chatId) {
    const data = readData();
    return data[chatId] || {};
}

function removeFromRemovedList(chatId, participantId) {
    const data = readData();
    if (!data[chatId] || !participantId) return false;
    const normalizedChat = String(chatId);
    const normalizedParticipant = normalizeUserJid(participantId);
    if (data[normalizedChat] && data[normalizedChat][normalizedParticipant]) {
        delete data[normalizedChat][normalizedParticipant];
        if (Object.keys(data[normalizedChat]).length === 0) {
            delete data[normalizedChat];
        }
        writeData(data);
        return true;
    }
    return false;
}

function trackRemovedMember(chatId, participantId, name) {
    if (!chatId || !participantId) return null;
    const data = readData();
    const normalizedChat = String(chatId);
    const normalizedParticipant = normalizeUserJid(participantId);
    const userName = name || normalizedParticipant.replace(/@.*$/, '');
    if (!data[normalizedChat]) data[normalizedChat] = {};
    data[normalizedChat][normalizedParticipant] = {
        userId: normalizedParticipant,
        name: userName,
        removedAt: new Date().toISOString()
    };
    writeData(data);
    return data[normalizedChat][normalizedParticipant];
}

module.exports = {
    getRemovedMembers,
    removeFromRemovedList,
    trackRemovedMember,
    normalizeUserJid
};
