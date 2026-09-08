const fs = require('fs');
const path = require('path');

const DEFAULT_STORAGE_PATH = path.resolve(__dirname, '..', 'data', 'hangman-leaderboard.json');

function ensureParentDirectory(filePath) {
    const parent = path.dirname(filePath);
    fs.mkdirSync(parent, { recursive: true });
}

function createLeaderboardStore(storagePath = DEFAULT_STORAGE_PATH) {
    ensureParentDirectory(storagePath);

    function normalizeJid(value) {
        if (!value) return '';
        return String(value).trim().split(':')[0];
    }

    function sanitizeName(value) {
        if (!value) return '';
        const text = String(value).trim();
        return text.length > 24 ? `${text.slice(0, 21)}...` : text;
    }

    function readState() {
        try {
            if (!fs.existsSync(storagePath)) {
                const initialState = { global: {}, groups: {} };
                fs.writeFileSync(storagePath, JSON.stringify(initialState, null, 2));
                return initialState;
            }

            const contents = fs.readFileSync(storagePath, 'utf8');
            const parsed = JSON.parse(contents);
            return {
                global: parsed?.global && typeof parsed.global === 'object' ? parsed.global : {},
                groups: parsed?.groups && typeof parsed.groups === 'object' ? parsed.groups : {}
            };
        } catch (err) {
            console.error('[hangmanLeaderboard] readState failed', err.message);
            return { global: {}, groups: {} };
        }
    }

    function writeState(state) {
        try {
            ensureParentDirectory(storagePath);
            fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));
            return true;
        } catch (err) {
            console.error('[hangmanLeaderboard] writeState failed', err.message);
            return false;
        }
    }

    function getOrCreateMap(state, chatId) {
        if (!chatId) return null;
        if (!state.groups[chatId]) {
            state.groups[chatId] = {};
        }
        return state.groups[chatId];
    }

    function ensurePlayer(entryMap, playerKey, displayName = '') {
        if (!entryMap[playerKey]) {
            entryMap[playerKey] = {
                jid: playerKey,
                name: sanitizeName(displayName) || playerKey,
                score: 0,
                wins: 0,
                losses: 0,
                streak: 0,
                bestStreak: 0,
                lastSeen: Date.now()
            };
        }

        return entryMap[playerKey];
    }

    function updatePlayer(entryMap, playerKey, displayName = '', win = true) {
        const player = ensurePlayer(entryMap, playerKey, displayName);
        if (displayName) {
            player.name = sanitizeName(displayName) || player.name || playerKey;
        }
        player.lastSeen = Date.now();

        if (win) {
            player.score += 1;
            player.wins += 1;
            player.streak += 1;
            player.bestStreak = Math.max(player.bestStreak, player.streak);
        } else {
            player.losses += 1;
            player.streak = 0;
        }

        return player;
    }

    function recordResult({ chatId, senderJid, displayName = '', win = true }) {
        const state = readState();
        const playerKey = normalizeJid(senderJid) || `unknown-${Date.now()}`;

        updatePlayer(state.global, playerKey, displayName, win);

        if (chatId) {
            const groupMap = getOrCreateMap(state, chatId);
            if (groupMap) {
                updatePlayer(groupMap, playerKey, displayName, win);
            }
        }

        writeState(state);
        return state;
    }

    function sortEntries(entryMap) {
        return Object.values(entryMap || {})
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
                return (b.lastSeen || 0) - (a.lastSeen || 0);
            })
            .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    function getGlobalLeaderboard(limit = 10) {
        const state = readState();
        return sortEntries(state.global).slice(0, limit);
    }

    function getGroupLeaderboard(chatId, limit = 10) {
        const state = readState();
        const groupMap = chatId ? (state.groups[chatId] || {}) : {};
        return sortEntries(groupMap).slice(0, limit);
    }

    function getLeaderboardWithContext(entryMap, senderJid, limit = 10) {
        const sorted = sortEntries(entryMap);
        const playerKey = normalizeJid(senderJid) || '';
        const top = sorted.slice(0, limit);

        if (!playerKey) {
            return { top, self: null };
        }

        const selfEntry = sorted.find((entry) => entry.jid === playerKey) || null;
        return { top, self: selfEntry || null };
    }

    function getPlayerProfile(chatId, senderJid, displayName = '') {
        const state = readState();
        const playerKey = normalizeJid(senderJid) || '';

        if (!playerKey) {
            return {
                name: sanitizeName(displayName) || 'Player',
                global: null,
                group: null
            };
        }

        const globalEntries = sortEntries(state.global);
        const globalEntry = state.global[playerKey];
        const groupEntries = chatId ? sortEntries(state.groups[chatId] || {}) : [];
        const groupEntry = chatId ? (state.groups[chatId] ? state.groups[chatId][playerKey] : null) : null;

        const globalRank = globalEntry ? (globalEntries.find((entry) => entry.jid === playerKey)?.rank || null) : null;
        const groupRank = groupEntry ? (groupEntries.find((entry) => entry.jid === playerKey)?.rank || null) : null;

        return {
            name: sanitizeName(displayName || globalEntry?.name || groupEntry?.name || playerKey) || playerKey,
            global: globalEntry ? { ...globalEntry, rank: globalRank } : null,
            group: groupEntry ? { ...groupEntry, rank: groupRank } : null
        };
    }

    return {
        readState,
        writeState,
        recordResult,
        getGlobalLeaderboard,
        getGroupLeaderboard,
        getLeaderboardWithContext,
        getPlayerProfile,
        normalizeJid
    };
}

const defaultStore = createLeaderboardStore();

module.exports = {
    createLeaderboardStore,
    defaultStore
};
