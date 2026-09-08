const DB = require('../database');
const { getLevelFromXP, getLevelProgress } = require('./levels');
const { calculateRatingChange, calculateDrawDelta } = require('./rating');
const { xpForWin, xpForLoss, xpForDraw } = require('./xp');
const { getRankFromRating } = require('./ranks');
const { normalizeJid, getPhoneNumber } = require('../mentions');
const { ensureGroupPlayerStats } = require('./state');
const tttLeaderboard = require('../tictactoeLeaderboard').defaultStore;

function ensureStructures(data) {
  if (!data.tttPlayers) data.tttPlayers = {};
  if (!data.tttGames) data.tttGames = {};
  if (!data.tttGroupStats) data.tttGroupStats = {};
}

async function settleGame(game, resultInfo) {
  // resultInfo: { result: 'win'|'draw'|'forfeit', winner: jid|null, loser: jid|null, winningSymbol }
    if (!game) return null;

    const data = DB.loadUserGroupData();
    ensureStructures(data);

    // if already marked settled in-memory, return persisted record if present
  if (game.settled) {
    if (data.tttGames[game.gameId]) return { record: data.tttGames[game.gameId], playerUpdates: {} };
    return null;
  }

    game.settled = true; // in-memory guard
  ensureStructures(data);

  // idempotency: if game already persisted, do nothing
  if (data.tttGames[game.gameId]) {
    return { record: data.tttGames[game.gameId], playerUpdates: {} };
  }

  const pX = game.playerX;
  const pO = game.playerO;
  const startedAt = game.createdAt || Date.now();
  const finishedAt = Date.now();

  // Helper: try to find an existing key in an object that corresponds to userId
  function findExistingKey(obj, id) {
    if (!obj || !id) return null;
    const nid = normalizeJid(id) || String(id).trim();
    if (!nid) return null;
    if (obj[nid]) return nid;
    if (obj[id]) return id;

    const idPhone = (() => {
      try {
        return require('../mentions').getPhoneNumber(nid);
      } catch (e) {
        return null;
      }
    })();
    const idLocal = String(nid).split('@')[0];

    for (const k of Object.keys(obj)) {
      const kn = normalizeJid(k) || String(k).trim();
      if (!kn) continue;
      if (kn === nid || k === id) return k;

      const kPhone = (() => {
        try {
          return require('../mentions').getPhoneNumber(kn);
        } catch (e) {
          return null;
        }
      })();
      const kLocal = String(kn).split('@')[0];

      if (idPhone && kPhone && idPhone === kPhone) return k;
      if (idLocal && kLocal && idLocal === kLocal) return k;
    }
    return null;
  }

  // determine canonical keys for players to avoid duplicate records across id formats
  const keyX = findExistingKey(data.tttPlayers, pX) || pX;
  const keyO = findExistingKey(data.tttPlayers, pO) || pO;

  // fetch or init players using their canonical keys
  data.tttPlayers[keyX] = data.tttPlayers[keyX] || { userId: keyX, xp: 0, rating: 1000, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, createdAt: Date.now(), updatedAt: Date.now() };
  data.tttPlayers[keyO] = data.tttPlayers[keyO] || { userId: keyO, xp: 0, rating: 1000, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, createdAt: Date.now(), updatedAt: Date.now() };

  const record = {
    gameId: game.gameId,
    chatId: game.chatId,
    playerX: pX,
    playerO: pO,
    winner: resultInfo.winner || null,
    loser: resultInfo.loser || null,
    result: resultInfo.result,
    winningSymbol: resultInfo.winningSymbol || null,
    moves: game.moveHistory || [],
    xpAwardedX: 0,
    xpAwardedO: 0,
    ratingChangeX: 0,
    ratingChangeO: 0,
    startedAt,
    finishedAt
  };

  // Determine XP and rating changes
  if (resultInfo.result === 'win' || resultInfo.result === 'forfeit') {
    const winner = resultInfo.winner;
    const loser = resultInfo.loser;
    const xpWinner = xpForWin();
    const xpLoser = xpForLoss();

    // map to canonical player keys if present
    const canonicalWinner = winner ? (findExistingKey(data.tttPlayers, winner) || winner) : null;
    const canonicalLoser = loser ? (findExistingKey(data.tttPlayers, loser) || loser) : null;

    const winnerIsX = canonicalWinner === keyX;

    // rating
    const ratingWinnerBefore = (canonicalWinner && data.tttPlayers[canonicalWinner] && data.tttPlayers[canonicalWinner].rating) || 1000;
    const ratingLoserBefore = (canonicalLoser && data.tttPlayers[canonicalLoser] && data.tttPlayers[canonicalLoser].rating) || 1000;
    const deltaWinner = calculateRatingChange(ratingWinnerBefore, ratingLoserBefore, 1);
    const deltaLoser = calculateRatingChange(ratingLoserBefore, ratingWinnerBefore, 0);

    // apply
    if (canonicalWinner) {
      const w = data.tttPlayers[canonicalWinner];
      w.xp = Math.max(0, (w.xp || 0) + xpWinner);
      w.rating = Math.max(0, (w.rating || 1000) + deltaWinner);
      w.updatedAt = Date.now();
      w.wins = (w.wins || 0) + 1;
      w.gamesPlayed = (w.gamesPlayed || 0) + 1;
    }
    if (canonicalLoser) {
      const l = data.tttPlayers[canonicalLoser];
      l.xp = Math.max(0, (l.xp || 0) + xpLoser);
      l.rating = Math.max(0, (l.rating || 1000) + deltaLoser);
      l.updatedAt = Date.now();
      l.losses = (l.losses || 0) + 1;
      l.gamesPlayed = (l.gamesPlayed || 0) + 1;
    }

    // record in record (keep original playerX/playerO values for compatibility)
    if (winnerIsX) {
      record.xpAwardedX = xpWinner;
      record.xpAwardedO = xpLoser;
      record.ratingChangeX = deltaWinner;
      record.ratingChangeO = deltaLoser;
    } else {
      record.xpAwardedO = xpWinner;
      record.xpAwardedX = xpLoser;
      record.ratingChangeO = deltaWinner;
      record.ratingChangeX = deltaLoser;
    }
  } else if (resultInfo.result === 'draw') {
    const drawXP = xpForDraw();
    const baseX = data.tttPlayers[keyX] || data.tttPlayers[pX];
    const baseO = data.tttPlayers[keyO] || data.tttPlayers[pO];
    const drawDelta = calculateDrawDelta((baseX && (baseX.rating || 1000)) || 1000, (baseO && (baseO.rating || 1000)) || 1000);

    baseX.xp = Math.max(0, (baseX.xp || 0) + drawXP);
    baseO.xp = Math.max(0, (baseO.xp || 0) + drawXP);

    baseX.rating = Math.max(0, (baseX.rating || 1000) + drawDelta);
    baseO.rating = Math.max(0, (baseO.rating || 1000) + drawDelta);

    baseX.updatedAt = Date.now();
    baseO.updatedAt = Date.now();

    baseX.draws = (baseX.draws || 0) + 1;
    baseO.draws = (baseO.draws || 0) + 1;

    baseX.gamesPlayed = (baseX.gamesPlayed || 0) + 1;
    baseO.gamesPlayed = (baseO.gamesPlayed || 0) + 1;

    record.xpAwardedX = drawXP;
    record.xpAwardedO = drawXP;
    record.ratingChangeX = drawDelta;
    record.ratingChangeO = drawDelta;
  }

  // Update group stats (defensive: handle malformed or older records)
  let group = data.tttGroupStats[game.chatId];
  if (!group || typeof group !== 'object') group = {};

  // Only update group stats if we have valid players
  const hasPX = !!pX;
  const hasPO = !!pO;

  const gKeyX = hasPX ? (findExistingKey(group, pX) || pX) : null;
  const gKeyO = hasPO ? (findExistingKey(group, pO) || pO) : null;

  if (gKeyX) ensureGroupPlayerStats(group, gKeyX);
  if (gKeyO) ensureGroupPlayerStats(group, gKeyO);

  if (gKeyX) group[gKeyX].gamesPlayed = (group[gKeyX].gamesPlayed || 0) + 1;
  if (gKeyO) group[gKeyO].gamesPlayed = (group[gKeyO].gamesPlayed || 0) + 1;

  if (record.result === 'win') {
    const gw = record.winner ? (findExistingKey(group, record.winner) || record.winner) : null;
    const gl = record.loser ? (findExistingKey(group, record.loser) || record.loser) : null;
    if (gw) ensureGroupPlayerStats(group, gw);
    if (gl) ensureGroupPlayerStats(group, gl);
    if (gw) group[gw].wins = (group[gw].wins || 0) + 1;
    if (gl) group[gl].losses = (group[gl].losses || 0) + 1;
  } else if (record.result === 'draw') {
    if (gKeyX) group[gKeyX].draws = (group[gKeyX].draws || 0) + 1;
    if (gKeyO) group[gKeyO].draws = (group[gKeyO].draws || 0) + 1;
  }

  data.tttGroupStats[game.chatId] = group;

  // persist game record
  data.tttGames[game.gameId] = record;

  // Save data
  DB.saveUserGroupData(data);

  try {
    // Update persistent leaderboard store so leaderboards survive restarts
    const canonicalX = findExistingKey(data.tttPlayers, pX) || pX;
    const canonicalO = findExistingKey(data.tttPlayers, pO) || pO;

    if (record.result === 'win' || record.result === 'forfeit') {
      const winner = record.winner ? (findExistingKey(data.tttPlayers, record.winner) || record.winner) : null;
      const loser = record.loser ? (findExistingKey(data.tttPlayers, record.loser) || record.loser) : null;
      if (winner) {
        const pl = data.tttPlayers[winner] || {};
        tttLeaderboard.recordResult({ chatId: game.chatId, senderJid: winner, displayName: winner, result: 'win', extra: { rating: pl.rating, xp: pl.xp } });
      }
      if (loser) {
        const pl = data.tttPlayers[loser] || {};
        tttLeaderboard.recordResult({ chatId: game.chatId, senderJid: loser, displayName: loser, result: 'loss', extra: { rating: pl.rating, xp: pl.xp } });
      }
    } else if (record.result === 'draw') {
      const px = data.tttPlayers[canonicalX] || {};
      const po = data.tttPlayers[canonicalO] || {};
      tttLeaderboard.recordResult({ chatId: game.chatId, senderJid: canonicalX, displayName: canonicalX, result: 'draw', extra: { rating: px.rating, xp: px.xp } });
      tttLeaderboard.recordResult({ chatId: game.chatId, senderJid: canonicalO, displayName: canonicalO, result: 'draw', extra: { rating: po.rating, xp: po.xp } });
    }
  } catch (e) {
    console.error('[tictactoe] Failed to update leaderboard store', e && e.message);
  }

  // compute level-ups and rank changes info to return
  const playerUpdates = {};
  // return updates keyed by the original player ids (pX, pO) for compatibility
  for (const originalId of [pX, pO]) {
    const canonical = findExistingKey(data.tttPlayers, originalId) || originalId;
    const pl = data.tttPlayers[canonical] || { xp: 0, rating: 1000 };
    const xpAwarded = originalId === pX ? record.xpAwardedX : record.xpAwardedO;
    const beforeXP = (pl.xp || 0) - (xpAwarded || 0);
    const beforeLevel = getLevelFromXP(beforeXP);
    const afterLevel = getLevelFromXP(pl.xp || 0);
    const leveledUp = afterLevel > beforeLevel;

    const beforeRating = (pl.rating || 1000) - (originalId === pX ? record.ratingChangeX : record.ratingChangeO);
    const afterRating = pl.rating || 1000;
    const oldRank = getRankFromRating(beforeRating);
    const newRank = getRankFromRating(afterRating);
    const rankChanged = oldRank.name !== newRank.name;

    playerUpdates[originalId] = {
      beforeLevel,
      afterLevel,
      leveledUp,
      beforeRating,
      afterRating,
      oldRank,
      newRank,
      rankChanged,
      xp: pl.xp,
      rating: pl.rating
    };
  }

  return { record, playerUpdates };
}

module.exports = { settleGame };
