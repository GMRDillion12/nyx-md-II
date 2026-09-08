const fs = require('fs');
const path = require('path');

const DEFAULT_STORAGE_PATH = path.resolve(__dirname, '..', 'data', 'tictactoe-leaderboard.json');

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
        let text = String(value).trim();
        // if value looks like a jid (contains @), prefer the local part to avoid '@lid' showing
        if (text.includes('@')) {
            text = text.split('@')[0];
        }
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
            console.error('[tictactoeLeaderboard] readState failed', err.message);
            return { global: {}, groups: {} };
        }
    }

    function writeState(state) {
        try {
            ensureParentDirectory(storagePath);
            fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));
            return true;
        } catch (err) {
            console.error('[tictactoeLeaderboard] writeState failed', err.message);
            return false;
        }
    }

    function getOrCreateMap(state, chatId) {
        if (!chatId) return null;
        const resolved = findGroupKey(state, chatId) || normalizeJid(chatId) || chatId;
        if (!state.groups[resolved]) {
            state.groups[resolved] = {};
        }
        return state.groups[resolved];
    }

    function findGroupKey(state, chatId) {
        if (!chatId) return null;
        const raw = String(chatId).trim();
        const norm = normalizeJid(raw) || raw;
        // prefer exact normalized or raw matches
        if (state.groups[norm]) return norm;
        if (state.groups[raw]) return raw;

        // try common variant: add @g.us if caller provided just local id
        if (!raw.includes('@')) {
            const gkey = `${raw}@g.us`;
            if (state.groups[gkey]) return gkey;
        }

        // try normalized + @g.us
        if (norm && !norm.includes('@')) {
            const gkey = `${norm}@g.us`;
            if (state.groups[gkey]) return gkey;
        }

        // no match
        return null;
    }

    function ensurePlayer(entryMap, playerKey, displayName = '') {
        const key = normalizeJid(playerKey) || String(playerKey || '').trim() || `unknown-${Date.now()}`;
        if (!entryMap[key]) {
            entryMap[key] = {
                jid: key,
                name: sanitizeName(displayName) || sanitizeName(playerKey) || key,
                rating: 1000,
                xp: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                lastSeen: Date.now()
            };
        }

        const player = entryMap[key];
        player.jid = key;
        if (!player.name) {
            player.name = sanitizeName(displayName) || sanitizeName(playerKey) || key;
        }
        return player;
    }

    function updatePlayer(entryMap, playerKey, displayName = '', result = 'win', extra = {}) {
        const player = ensurePlayer(entryMap, playerKey, displayName);
        if (displayName) {
            player.name = sanitizeName(displayName) || player.name || sanitizeName(playerKey) || player.jid || playerKey;
        }
        player.lastSeen = Date.now();

        // result: 'win' | 'loss' | 'draw'
        if (result === 'win') {
            player.wins += 1;
        } else if (result === 'loss') {
            player.losses += 1;
        } else if (result === 'draw') {
            player.draws += 1;
        }

        // merge rating/xp if supplied (keep persisted values otherwise)
        if (typeof extra.rating === 'number') player.rating = extra.rating;
        if (typeof extra.xp === 'number') player.xp = extra.xp;

        return player;
    }

    function recordResult({ chatId, senderJid, displayName = '', result = 'win', extra = {} }) {
        const state = readState();
        const playerKey = normalizeJid(senderJid) || `unknown-${Date.now()}`;

        updatePlayer(state.global, playerKey, displayName, result, extra);

        if (chatId) {
            const groupMap = getOrCreateMap(state, chatId);
            if (groupMap) {
                updatePlayer(groupMap, playerKey, displayName, result, extra);
            }
        }

        writeState(state);
        return state;
    }

    function sortEntries(entryMap) {
        return Object.values(entryMap || {})
            .sort((a, b) => {
                if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
                if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
                if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
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
        if (!chatId) return [];
        const key = findGroupKey(state, chatId) || normalizeJid(chatId) || chatId;
        const groupMap = state.groups[key] || {};
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
        const groupKey = chatId ? (findGroupKey(state, chatId) || normalizeJid(chatId) || chatId) : null;
        const groupEntries = groupKey ? sortEntries(state.groups[groupKey] || {}) : [];
        const groupEntry = groupKey ? (state.groups[groupKey] ? state.groups[groupKey][playerKey] : null) : null;

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
