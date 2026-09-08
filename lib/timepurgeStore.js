const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data/timepurge.json');

function ensureDataFile() {
    if (!fs.existsSync(dataFile)) {
        fs.mkdirSync(path.dirname(dataFile), { recursive: true });
        fs.writeFileSync(dataFile, JSON.stringify({}, null, 2), 'utf8');
    }
}

function loadScheduledPurges() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(dataFile, 'utf8');
        const parsed = JSON.parse(raw || '{}');
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
        console.error('[timepurgeStore] failed to load schedule file:', err?.message || err);
    }
    return {};
}

function saveScheduledPurges(data) {
    try {
        ensureDataFile();
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('[timepurgeStore] failed to save schedule file:', err?.message || err);
        return false;
    }
}

function addScheduledPurge(chat, endAt) {
    const schedules = loadScheduledPurges();
    schedules[String(chat)] = { endAt: Number(endAt) || Date.now() };
    saveScheduledPurges(schedules);
}

function removeScheduledPurge(chat) {
    const schedules = loadScheduledPurges();
    const key = String(chat);
    if (schedules[key]) {
        delete schedules[key];
        saveScheduledPurges(schedules);
    }
}

function getScheduledPurge(chat) {
    const schedules = loadScheduledPurges();
    return schedules[String(chat)] || null;
}

module.exports = {
    loadScheduledPurges,
    addScheduledPurge,
    removeScheduledPurge,
    getScheduledPurge,
};
