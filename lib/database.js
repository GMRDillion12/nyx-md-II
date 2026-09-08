const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/userGroupData.json');
let cachedData = null;
let writeLock = Promise.resolve();

function createDefaultData() {
    return {
        antibadword: {},
        antilink: {},
        antistatus: {},
        antitag: {},
        welcome: {},
        goodbye: {},
        chatbot: {},
        prank: {},
        ghost: {},
        warnings: {},
        sudo: [],
        groupSettings: {}
    };
}

function ensureDataFile() {
    if (!cachedData) {
        if (!fs.existsSync(dataPath)) {
            const initialData = createDefaultData();
            fs.mkdirSync(path.dirname(dataPath), { recursive: true });
            fs.writeFileSync(dataPath, JSON.stringify(initialData, null, 2));
            cachedData = initialData;
        } else {
            try {
                cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                if (!cachedData.groupSettings) cachedData.groupSettings = {};
                if (!cachedData.prank) cachedData.prank = {};
            } catch (error) {
                console.error('[DATABASE] Invalid JSON, resetting data store:', error.message);
                cachedData = createDefaultData();
                fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
            }
        }
    }
}

function loadUserGroupData() {
    ensureDataFile();
    return cachedData;
}

function saveUserGroupData(data) {
    try {
        cachedData = data;
        fs.mkdirSync(path.dirname(dataPath), { recursive: true });
        // Serialize writes to avoid races and write atomically
        const tempPath = `${dataPath}.tmp`;
        writeLock = writeLock.then(() => {
            return new Promise((resolve, reject) => {
                try {
                    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
                    fs.renameSync(tempPath, dataPath);
                    resolve();
                } catch (e) {
                    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
                    reject(e);
                }
            });
        }).catch(e => {
            console.error('[DATABASE] Failed to save user group data:', e.message);
        });
    } catch (e) {
        console.error('[DATABASE] Failed to save user group data:', e.message);
    }
}

//
// ✅ WELCOME SYSTEM
//
async function addWelcome(jid, enabled, message) {
    const data = loadUserGroupData();
    if (!data.welcome) data.welcome = {};

    const existing = data.welcome[jid] || {};
    const defaultMessage = `╔═⚔️ WELCOME ⚔️═╗
║ 👤 User: {user}
║ 🏠 Group: {group}
╠═══════════════╣
║ 🎉 Welcome to the group!
╚═══════════════╝`;

    data.welcome[jid] = {
        enabled,
        message: message != null ? message : existing.message || defaultMessage,
    };

    saveUserGroupData(data);
    return true;
}

async function delWelcome(jid) {
    const data = loadUserGroupData();
    if (!data.welcome) data.welcome = {};
    if (!data.welcome[jid]) {
        data.welcome[jid] = { enabled: false, message: null };
    } else {
        data.welcome[jid].enabled = false;
    }
    saveUserGroupData(data);
    return true;
}

async function isWelcomeOn(jid) {
    const data = loadUserGroupData();
    return data.welcome?.[jid]?.enabled || false;
}

async function getWelcome(jid) {
    const data = loadUserGroupData();
    return data.welcome?.[jid]?.message || null;
}

//
// ✅ GOODBYE SYSTEM
//
async function addGoodbye(jid, enabled, message) {
    const data = loadUserGroupData();
    if (!data.goodbye) data.goodbye = {};

    const existing = data.goodbye[jid] || {};
    const defaultMessage = `╔═⚔️ GOODBYE ⚔️═╗
║ 👤 User: {user}
║ 🏠 Group: {group}
╠═══════════════╣
║ 👋 Goodbye!
╚═══════════════╝`;

    data.goodbye[jid] = {
        enabled,
        message: message != null ? message : existing.message || defaultMessage,
    };

    saveUserGroupData(data);
    return true;
}

async function delGoodBye(jid) {
    const data = loadUserGroupData();
    if (!data.goodbye) data.goodbye = {};
    if (!data.goodbye[jid]) {
        data.goodbye[jid] = { enabled: false, message: null };
    } else {
        data.goodbye[jid].enabled = false;
    }
    saveUserGroupData(data);
    return true;
}

async function isGoodByeOn(jid) {
    const data = loadUserGroupData();
    return data.goodbye?.[jid]?.enabled || false;
}

async function getGoodbye(jid) {
    const data = loadUserGroupData();
    return data.goodbye?.[jid]?.message || null;
}

//
// ✅ ANTILINK
//
async function setAntilink(groupId, type) {
    const data = loadUserGroupData();
    if (!data.antilink) data.antilink = {};

    const existing = data.antilink[groupId] || { exclude: [] };
    data.antilink[groupId] = { ...existing, enabled: type === 'on' };
    saveUserGroupData(data);
}

async function getAntilink(groupId) {
    const data = loadUserGroupData();
    return data.antilink?.[groupId] || null;
}

async function setAntistatus(groupId, type) {
    const data = loadUserGroupData();
    if (!data.antistatus) data.antistatus = {};

    const existing = data.antistatus[groupId] || {};
    data.antistatus[groupId] = { ...existing, enabled: type === 'on' };
    saveUserGroupData(data);
}

async function getAntistatus(groupId) {
    const data = loadUserGroupData();
    return data.antistatus?.[groupId] || null;
}

async function addAntistatusWarning(groupId, userId) {
    const data = loadUserGroupData();
    if (!data.antistatusWarnings) data.antistatusWarnings = {};
    if (!data.antistatusWarnings[groupId]) data.antistatusWarnings[groupId] = {};

    const count = (data.antistatusWarnings[groupId][userId] || 0) + 1;
    data.antistatusWarnings[groupId][userId] = count;
    saveUserGroupData(data);
    return count;
}

async function getAntistatusWarning(groupId, userId) {
    const data = loadUserGroupData();
    return data.antistatusWarnings?.[groupId]?.[userId] || 0;
}

async function resetAntistatusWarning(groupId, userId) {
    const data = loadUserGroupData();
    if (!data.antistatusWarnings) data.antistatusWarnings = {};
    if (!data.antistatusWarnings[groupId]) data.antistatusWarnings[groupId] = {};
    delete data.antistatusWarnings[groupId][userId];
    saveUserGroupData(data);
}

async function clearAntistatusWarnings(groupId) {
    const data = loadUserGroupData();
    if (!data.antistatusWarnings) data.antistatusWarnings = {};
    delete data.antistatusWarnings[groupId];
    saveUserGroupData(data);
}

async function addWarning(groupId, userId) {
    const data = loadUserGroupData();
    if (!data.warnings) data.warnings = {};
    if (!data.warnings[groupId]) data.warnings[groupId] = {};

    const count = (data.warnings[groupId][userId] || 0) + 1;
    data.warnings[groupId][userId] = count;
    saveUserGroupData(data);
    return count;
}

async function getWarning(groupId, userId) {
    const data = loadUserGroupData();
    return data.warnings?.[groupId]?.[userId] || 0;
}

async function resetWarning(groupId, userId) {
    const data = loadUserGroupData();
    if (!data.warnings) data.warnings = {};
    if (!data.warnings[groupId]) data.warnings[groupId] = {};
    delete data.warnings[groupId][userId];
    saveUserGroupData(data);
}

async function clearWarnings(groupId) {
    const data = loadUserGroupData();
    if (!data.warnings) data.warnings = {};
    delete data.warnings[groupId];
    saveUserGroupData(data);
}

async function addAntilinkExclude(groupId, phrase) {
    const data = loadUserGroupData();
    if (!data.antilink) data.antilink = {};
    if (!data.antilink[groupId]) data.antilink[groupId] = { enabled: false, exclude: [] };

    const normalized = phrase.trim().toLowerCase();
    const existing = data.antilink[groupId].exclude || [];
    if (!existing.includes(normalized)) {
        existing.push(normalized);
    }
    data.antilink[groupId].exclude = existing;
    saveUserGroupData(data);
    return existing;
}

function normalizeJid(jid) {
    if (!jid) return '';
    const parts = String(jid).split(':')[0].split('@')[0].replace(/\D/g, '');
    return parts ? `${parts}@s.whatsapp.net` : '';
}

async function getSudoList() {
    const data = loadUserGroupData();
    if (!Array.isArray(data.sudo)) data.sudo = [];
    return data.sudo.map(normalizeJid).filter(Boolean);
}

async function addSudo(jid) {
    const data = loadUserGroupData();
    if (!Array.isArray(data.sudo)) data.sudo = [];
    const normalized = normalizeJid(jid);
    if (!normalized) return false;
    if (!data.sudo.includes(normalized)) {
        data.sudo.push(normalized);
        saveUserGroupData(data);
        return true;
    }
    return false;
}

async function removeSudo(jid) {
    const data = loadUserGroupData();
    if (!Array.isArray(data.sudo)) data.sudo = [];
    const normalized = normalizeJid(jid);
    if (!normalized) return false;
    const index = data.sudo.indexOf(normalized);
    if (index === -1) return false;
    data.sudo.splice(index, 1);
    saveUserGroupData(data);
    return true;
}

async function removeAntilinkExclude(groupId, phrase) {
    const data = loadUserGroupData();
    if (!data.antilink?.[groupId]?.exclude) return [];
    const normalized = phrase.trim().toLowerCase();
    data.antilink[groupId].exclude = data.antilink[groupId].exclude.filter(x => x !== normalized);
    saveUserGroupData(data);
    return data.antilink[groupId].exclude;
}

async function getAntilinkExcludes(groupId) {
    const data = loadUserGroupData();
    return data.antilink?.[groupId]?.exclude || [];
}

//
// ✅ EXPORTS
//
module.exports = {
    loadUserGroupData,
    saveUserGroupData,
    
    addWelcome,
    delWelcome,
    isWelcomeOn,
    getWelcome,

    addGoodbye,
    delGoodBye,
    isGoodByeOn,
    getGoodbye,

    setAntilink,
    getAntilink,
    addAntilinkExclude,
    removeAntilinkExclude,
    getAntilinkExcludes,
    addWarning,
    getWarning,
    resetWarning,
    clearWarnings,
    addAntistatusWarning,
    getAntistatusWarning,
    resetAntistatusWarning,
    clearAntistatusWarnings,
    getSudoList,
    addSudo,
    removeSudo,
    setAntistatus,
    getAntistatus
};

// Group-level generic settings getter/updater
function getGroupSettings(groupId) {
    const data = loadUserGroupData();
    if (!data.groupSettings) data.groupSettings = {};
    return data.groupSettings[groupId] || {};
}

function updateGroupSettings(groupId, updates) {
    const data = loadUserGroupData();
    if (!data.groupSettings) data.groupSettings = {};
    const existing = data.groupSettings[groupId] || {};
    data.groupSettings[groupId] = { ...existing, ...updates };
    saveUserGroupData(data);
    return data.groupSettings[groupId];
}

async function addMutedUser(groupId, userId) {
    const data = loadUserGroupData();
    if (!data.groupSettings) data.groupSettings = {};
    const existing = Array.isArray(data.groupSettings[groupId]?.mutedUsers)
        ? data.groupSettings[groupId].mutedUsers.map(normalizeJid).filter(Boolean)
        : [];
    const normalized = normalizeJid(userId);
    if (!normalized) return false;
    if (!existing.includes(normalized)) {
        existing.push(normalized);
        data.groupSettings[groupId] = { ...data.groupSettings[groupId], mutedUsers: existing };
        saveUserGroupData(data);
    }
    return true;
}

async function removeMutedUser(groupId, userId) {
    const data = loadUserGroupData();
    if (!data.groupSettings) data.groupSettings = {};
    const existing = Array.isArray(data.groupSettings[groupId]?.mutedUsers)
        ? data.groupSettings[groupId].mutedUsers.map(normalizeJid).filter(Boolean)
        : [];
    const normalized = normalizeJid(userId);
    if (!normalized) return false;
    const filtered = existing.filter(jid => jid !== normalized);
    if (filtered.length === existing.length) return false;
    data.groupSettings[groupId] = { ...data.groupSettings[groupId], mutedUsers: filtered };
    saveUserGroupData(data);
    return true;
}

async function getMutedUsers(groupId) {
    const data = loadUserGroupData();
    if (!data.groupSettings) return [];
    return Array.isArray(data.groupSettings[groupId]?.mutedUsers)
        ? data.groupSettings[groupId].mutedUsers.map(normalizeJid).filter(Boolean)
        : [];
}

async function isUserMuted(groupId, userId) {
    const normalized = normalizeJid(userId);
    if (!normalized) return false;
    const mutedUsers = await getMutedUsers(groupId);
    return mutedUsers.includes(normalized);
}

module.exports.getGroupSettings = getGroupSettings;
module.exports.updateGroupSettings = updateGroupSettings;
module.exports.addMutedUser = addMutedUser;
module.exports.removeMutedUser = removeMutedUser;
module.exports.getMutedUsers = getMutedUsers;
module.exports.isUserMuted = isUserMuted;
