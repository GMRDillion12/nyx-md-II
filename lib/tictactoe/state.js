global.tttRankedGames = global.tttRankedGames || {};

function createGame({ gameId, chatId, playerX, playerO = null, board, currentPlayer, started = false }) {
  const game = {
    gameId,
    chatId,
    playerX,
    playerO,
    board,
    currentPlayer,
    started,
    ended: false,
    timeout: null,
    createdAt: Date.now(),
    moveHistory: [],
    settled: false
  };
  global.tttRankedGames[chatId] = game;
  return game;
}

function getGame(chatId) {
  return global.tttRankedGames[chatId];
}

function clearGame(chatId) {
  const game = getGame(chatId);
  if (!game) return;
  if (game.timeout) clearTimeout(game.timeout);
  delete global.tttRankedGames[chatId];
}

// Ensure group player stats exist for a given userId.
// This is a small, shared helper used to safely initialize
// per-group tictactoe stats without overwriting existing records.
function ensureGroupPlayerStats(group, userId) {
  if (!group || typeof group !== 'object') return null;
  const id = String(userId || '');
  if (!id) return null;
  if (!group[id]) {
    group[id] = { userId: id, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
  } else {
    // ensure fields exist but do not overwrite existing values
    const rec = group[id];
    if (typeof rec !== 'object') {
      group[id] = { userId: id, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
    } else {
      if (rec.userId == null) rec.userId = id;
      if (typeof rec.gamesPlayed !== 'number') rec.gamesPlayed = 0;
      if (typeof rec.wins !== 'number') rec.wins = 0;
      if (typeof rec.losses !== 'number') rec.losses = 0;
      if (typeof rec.draws !== 'number') rec.draws = 0;
    }
  }
  return group[id];
}

module.exports = { createGame, getGame, clearGame, ensureGroupPlayerStats };
