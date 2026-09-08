const { getPrefix } = require("../../lib/prefixManager");
const DB = require("../../lib/database");
const { formatMentionText, buildMentionJids, normalizeJid } = require("../../lib/mentions");
const { defaultStore } = require("../../lib/tictactoeLeaderboard");
const { settleGame } = require("../../lib/tictactoe/service");
const { createBoard, isWinner, isDraw, getSymbolEmoji } = require("../../lib/tictactoe/gameEngine");
const { getLevelFromXP } = require("../../lib/tictactoe/levels");
const { getRankFromRating } = require("../../lib/tictactoe/ranks");

const BOARD_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const SYMBOLS = { X: "❌", O: "⭕" };
const TURN_TIMEOUT = 60_000;

async function resolveGroupLabel(sock, chatId) {
  if (!chatId || !String(chatId).endsWith('@g.us')) return chatId || 'this group';
  try {
    const metadata = await sock.groupMetadata(chatId).catch(() => null);
    return metadata?.subject || chatId;
  } catch (_error) {
    return chatId || 'this group';
  }
}

global.tttRankedGames = global.tttRankedGames || {};
global.tttRankedPlayerLocks = global.tttRankedPlayerLocks || {};

function getTextFromMessage(m) {
  return (
    m.text ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    m.message?.buttonsResponseMessage?.selectedButtonId ||
    m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ""
  ).trim();
}

function getSafeJid(value) {
  return normalizeJid(value || "") || String(value || "").trim().split(":")[0].split("/")[0] || "";
}

function getPlayerLock(jid) {
  const key = getSafeJid(jid);
  if (!key) return null;
  return global.tttRankedPlayerLocks[key] || null;
}

function setPlayerLock(jid, chatId) {
  const key = getSafeJid(jid);
  if (!key) return;
  global.tttRankedPlayerLocks[key] = chatId || key;
}

function clearPlayerLock(jid) {
  const key = getSafeJid(jid);
  if (!key) return;
  delete global.tttRankedPlayerLocks[key];
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

function clearPlayerLocksForGame(game) {
  if (!game) return;
  if (game.playerX) clearPlayerLock(game.playerX);
  if (game.playerO) clearPlayerLock(game.playerO);
}

function formatBoard(board) {
  const rows = [];
  for (let i = 0; i < 9; i += 3) {
    rows.push(`│ ${board[i]} │ ${board[i + 1]} │ ${board[i + 2]} │`);
  }
  return [
    "╭───┬───┬───╮",
    rows[0],
    "├───┼───┼───┤",
    rows[1],
    "├───┼───┼───┤",
    rows[2],
    "╰───┴───┴───╯"
  ].join("\n");
}

function renderBoard(board) {
  return formatBoard(board);
}

function getPlayerSymbol(game, player) {
  if (!game) return null;
  if (player === game.playerX) return "X";
  if (player === game.playerO) return "O";
  return null;
}

function mentionTag(jid, sock, fallbackName = "") {
  const displayName = fallbackName || String(jid || "").split("@", 1)[0] || "Player";
  const tag = formatMentionText(jid, sock, displayName);
  return tag || `@${displayName.replace(/^@/, "")}`;
}

function formatDelta(value) {
  const num = Number(value) || 0;
  return `${num >= 0 ? "+" : ""}${num}`;
}

function buildPremiumResultCard(sock, game, record, introText = "") {
  if (!record) return introText || "";

  const line = (text) => `║ ${text}`;
  const title = "🏆 Ranked Match Result";
  const borderTop = "╔═══════════════════════════════════════════════════════╗";
  const borderMid = "╠═══════════════════════════════════════════════════════╣";
  const borderBottom = "╚═══════════════════════════════════════════════════════╝";

  const rows = [borderTop, line(title.padEnd(51, ' ')), borderMid];

  if (record.result === "draw") {
    const xTag = mentionTag(game.playerX, sock, getDisplayNameForJid(game.playerX));
    const oTag = mentionTag(game.playerO, sock, getDisplayNameForJid(game.playerO));
    const xRank = getRankFromRating(getRankedProfileData(game.playerX)?.rating || 1000);
    const oRank = getRankFromRating(getRankedProfileData(game.playerO)?.rating || 1000);
    const ratingDelta = Number(record.ratingChangeX || 0);
    const xpDelta = Number(record.xpAwardedX || 0);

    rows.push(line(`🤝 ${xTag} ${xRank.emoji} receives ${formatDelta(ratingDelta)} rating and ${formatDelta(xpDelta)} XP`.padEnd(51, ' ')));
    rows.push(line(`🤝 ${oTag} ${oRank.emoji} receives ${formatDelta(ratingDelta)} rating and ${formatDelta(xpDelta)} XP`.padEnd(51, ' ')));
  } else {
    const winner = record.winner || null;
    const loser = record.loser || null;
    if (!winner || !loser) return introText || "";

    const winnerTag = mentionTag(winner, sock, getDisplayNameForJid(winner));
    const loserTag = mentionTag(loser, sock, getDisplayNameForJid(loser));
    const winnerRank = getRankFromRating(getRankedProfileData(winner)?.rating || 1000);
    const loserRank = getRankFromRating(getRankedProfileData(loser)?.rating || 1000);

    const winnerIsX = winner === game.playerX;
    const winnerRating = Number(winnerIsX ? (record.ratingChangeX || 0) : (record.ratingChangeO || 0));
    const loserRating = Number(winnerIsX ? (record.ratingChangeO || 0) : (record.ratingChangeX || 0));
    const winnerXp = Number(winnerIsX ? (record.xpAwardedX || 0) : (record.xpAwardedO || 0));
    const loserXp = Number(winnerIsX ? (record.xpAwardedO || 0) : (record.xpAwardedX || 0));

    rows.push(line(`🎉 ${winnerTag} ${winnerRank.emoji} wins the match`.padEnd(51, ' ')));
    rows.push(line(`✨ ${winnerTag} gets ${formatDelta(winnerRating)} rating and ${formatDelta(winnerXp)} XP`.padEnd(51, ' ')));
    rows.push(line(`💫 ${loserTag} ${loserRank.emoji} gets ${formatDelta(loserRating)} rating and ${formatDelta(loserXp)} XP`.padEnd(51, ' ')));
  }

  if (introText) {
    rows.push(line(`ℹ️ ${introText.replace(/\n/g, ' ')}`.slice(0, 51).padEnd(51, ' ')));
  }

  rows.push(borderBottom);
  return rows.join("\n");
}

function getDisplayNameForJid(jid, fallback = "Player") {
  const key = getSafeJid(jid);
  if (!key) return fallback;
  const local = key.split("@")[0] || fallback;
  return local || fallback;
}

function getRankedProfileData(senderJid) {
  const data = DB.loadUserGroupData();
  const original = getSafeJid(senderJid);
  if (!original) return null;
  const players = data.tttPlayers || {};
  const profileKey = Object.keys(players).find((key) => {
    const normalized = getSafeJid(key);
    if (!normalized) return false;
    return normalized === original || normalized.split("@")[0] === original.split("@")[0];
  }) || original;
  const profile = players[profileKey] || {
    userId: original,
    rating: 1000,
    xp: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
    displayName: getDisplayNameForJid(original)
  };
  return { ...profile, userId: profile.userId || original, displayName: profile.displayName || getDisplayNameForJid(original) };
}

function ensurePlayerEntry(data, userId) {
  const user = getSafeJid(userId);
  if (!user) return null;
  data.tttPlayers = data.tttPlayers || {};
  if (!data.tttPlayers[user]) {
    data.tttPlayers[user] = {
      userId: user,
      rating: 1000,
      xp: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      displayName: getDisplayNameForJid(user),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  data.tttPlayers[user].userId = user;
  data.tttPlayers[user].updatedAt = Date.now();
  return data.tttPlayers[user];
}

function ensureGroupEntry(data, chatId) {
  const groupId = getSafeJid(chatId) || String(chatId || "").trim();
  if (!groupId) return null;
  data.tttGroupStats = data.tttGroupStats || {};
  if (!data.tttGroupStats[groupId]) {
    data.tttGroupStats[groupId] = {};
  }
  return data.tttGroupStats[groupId];
}

function formatOrdinal(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value || "");
  const suffix = ["th", "st", "nd", "rd"]; 
  const v = num % 100;
  return `${num}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
}

function createLeaderboardRows(statsMap, senderJid = "") {
  const entries = Object.values(statsMap || {}).map((entry) => {
    const userId = getSafeJid(entry.userId || entry.jid || entry.id || "") || entry.userId || entry.jid || "";
    const rating = Number(entry.rating || 1000);
    const xp = Number(entry.xp || 0);
    const wins = Number(entry.wins || 0);
    const losses = Number(entry.losses || 0);
    const draws = Number(entry.draws || 0);
    const displayName = entry.displayName || (userId ? getDisplayNameForJid(userId) : "Player");
    return {
      userId,
      displayName,
      rating,
      xp,
      wins,
      losses,
      draws,
      level: getLevelFromXP(xp)
    };
  }).filter((entry) => entry.userId).sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.xp !== a.xp) return b.xp - a.xp;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (a.displayName || "").localeCompare(b.displayName || "");
  }).map((entry, index) => ({ ...entry, rank: index + 1 }));

  const selfRank = senderJid ? entries.findIndex((entry) => getSafeJid(entry.userId) === getSafeJid(senderJid)) : -1;
  return { entries, selfRank: selfRank >= 0 ? entries[selfRank].rank : null };
}

function buildLeaderboardText({ title, entries, selfRank, senderJid, chatId }, sock) {
  if (!entries.length) {
    return `🏆 *${title}*\nNo scores yet. Start a ranked match and win to appear here.`;
  }

  const medal = ["🥇", "🥈", "🥉"];
  const lines = [`🏆 *${title}*`, ""];
  const mentions = [];

  entries.slice(0, 10).forEach((entry, index) => {
    const rank = entry.rank;
    const badge = medal[index] || `#${rank}`;
    const tag = formatMentionText(entry.userId, sock, entry.displayName || getDisplayNameForJid(entry.userId));
    const rankData = getRankFromRating(entry.rating || 1000);
    if (entry.userId) mentions.push(entry.userId);

    lines.push(
      `${badge} ${tag}\n` +
      `   • ${rankData.emoji} ${rankData.name} | Rating: ${entry.rating || 1000} | XP: ${entry.xp || 0} | Level: ${entry.level || 1}\n` +
      `   • W: ${entry.wins || 0} | L: ${entry.losses || 0} | D: ${entry.draws || 0}`
    );
  });

  if (selfRank) {
    lines.push("");
    lines.push(`📌 You are rank ${formatOrdinal(selfRank)} out of ${entries.length}.`);
  }

  return { text: lines.join("\n"), mentions: buildMentionJids(mentions) };
}

async function sendChatMessage(sock, chatId, text, mentions = [], quoted = null) {
  const payload = { text };
  if (mentions.length) payload.mentions = buildMentionJids(mentions);
  if (quoted) {
    await sock.sendMessage(chatId, payload, { quoted });
  } else {
    await sock.sendMessage(chatId, payload);
  }
}

async function finalizeRankedGame(sock, chatId, game, resultInfo, extraText = "") {
  if (!game || game.ended) return;

  game.ended = true;
  const data = DB.loadUserGroupData();
  data.tttPlayers = data.tttPlayers || {};
  data.tttGroupStats = data.tttGroupStats || {};

  const winner = resultInfo.winner || null;
  const loser = resultInfo.loser || null;
  let settlement = null;

  if (game.playerX && game.playerO && (winner || resultInfo.result === "draw")) {
    settlement = await settleGame(game, {
      result: resultInfo.result || "win",
      winner,
      loser,
      winningSymbol: resultInfo.winningSymbol || "X"
    });
    if (settlement && settlement.record) {
      if (resultInfo.result === "draw") {
        defaultStore.recordResult({
          chatId: game.chatId,
          senderJid: game.playerX,
          displayName: getDisplayNameForJid(game.playerX),
          result: "draw",
          extra: { rating: getRankedProfileData(game.playerX)?.rating || 1000, xp: getRankedProfileData(game.playerX)?.xp || 0 }
        });
        defaultStore.recordResult({
          chatId: game.chatId,
          senderJid: game.playerO,
          displayName: getDisplayNameForJid(game.playerO),
          result: "draw",
          extra: { rating: getRankedProfileData(game.playerO)?.rating || 1000, xp: getRankedProfileData(game.playerO)?.xp || 0 }
        });
      } else {
        defaultStore.recordResult({
          chatId: game.chatId,
          senderJid: winner,
          displayName: getDisplayNameForJid(winner),
          result: "win",
          extra: { rating: getRankedProfileData(winner)?.rating || 1000, xp: getRankedProfileData(winner)?.xp || 0 }
        });
        defaultStore.recordResult({
          chatId: game.chatId,
          senderJid: loser,
          displayName: getDisplayNameForJid(loser),
          result: "loss",
          extra: { rating: getRankedProfileData(loser)?.rating || 1000, xp: getRankedProfileData(loser)?.xp || 0 }
        });
      }
    }
  }

  clearGame(chatId);
  clearPlayerLocksForGame(game);

  const players = [game.playerX, game.playerO].filter(Boolean);
  const premiumCard = buildPremiumResultCard(sock, game, settlement && settlement.record ? settlement.record : null, extraText);
  const finalText = [premiumCard, renderBoard(game.board)].filter(Boolean).join("\n\n").trim();
  await sendChatMessage(sock, chatId, finalText, players, null);
}

async function handleMove(sock, m, chatId, game, position) {
  const sender = getSafeJid(m.key?.participant || m.sender || m.key?.remoteJid || "");
  if (!game || !game.started || game.ended) return;

  const symbol = getPlayerSymbol(game, sender);
  if (!symbol) {
    await sendChatMessage(sock, chatId, `❌ ${mentionTag(sender, sock, getDisplayNameForJid(sender))}, you are not part of this ranked match.`, [sender], m);
    return;
  }

  if (sender !== game.currentPlayer) {
    await sendChatMessage(sock, chatId, `❌ ${mentionTag(sender, sock, getDisplayNameForJid(sender))}, it is not your turn. Current turn: ${mentionTag(game.currentPlayer, sock, getDisplayNameForJid(game.currentPlayer))}.`, [sender, game.currentPlayer], m);
    return;
  }

  if (position < 1 || position > 9) {
    await sendChatMessage(sock, chatId, `❌ ${mentionTag(sender, sock, getDisplayNameForJid(sender))}, choose a number from 1 to 9.`, [sender], m);
    return;
  }

  const index = position - 1;
  if (game.board[index] === SYMBOLS.X || game.board[index] === SYMBOLS.O) {
    await sendChatMessage(sock, chatId, `❌ That square is already taken. Pick another move.`, [sender], m);
    return;
  }

  game.board[index] = getSymbolEmoji(symbol);
  game.moveHistory.push({ player: sender, symbol, position, timestamp: Date.now() });

  const xWinner = isWinner(game.board, SYMBOLS.X);
  const oWinner = isWinner(game.board, SYMBOLS.O);
  if (xWinner || oWinner) {
    const winner = xWinner ? game.playerX : game.playerO;
    const loser = winner === game.playerX ? game.playerO : game.playerX;
    const endText = `✅ ${mentionTag(sender, sock, getDisplayNameForJid(sender))} played ${getSymbolEmoji(symbol)} at ${position}.\n\n${renderBoard(game.board)}\n\n🎉 ${mentionTag(winner, sock, getDisplayNameForJid(winner))} wins the ranked match!`;
    await finalizeRankedGame(sock, chatId, game, { result: "win", winner, loser, winningSymbol: symbol }, endText);
    return;
  }

  if (isDraw(game.board)) {
    const drawText = `🤝 Draw!\n\n${renderBoard(game.board)}\n\nThis ranked round ended without a winner.`;
    await finalizeRankedGame(sock, chatId, game, { result: "draw", winner: null, loser: null, winningSymbol: null }, drawText);
    return;
  }

  game.currentPlayer = sender === game.playerX ? game.playerO : game.playerX;
  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = setTimeout(async () => {
    if (!getGame(chatId) || getGame(chatId).ended) return;
    const currentGame = getGame(chatId);
    const skipped = currentGame.currentPlayer;
    const nextPlayer = skipped === currentGame.playerX ? currentGame.playerO : currentGame.playerX;
    currentGame.currentPlayer = nextPlayer;
    await sendChatMessage(sock, chatId, `⏰ ${mentionTag(skipped, sock, getDisplayNameForJid(skipped))} timed out. Turn skipped.\n\n${renderBoard(currentGame.board)}\n\n🎯 Next turn: ${mentionTag(nextPlayer, sock, getDisplayNameForJid(nextPlayer))}.`, [skipped, nextPlayer]);
    if (currentGame.timeout) clearTimeout(currentGame.timeout);
    currentGame.timeout = setTimeout(async () => {
      const again = getGame(chatId);
      if (!again || again.ended) return;
      const timeoutWinner = again.currentPlayer === again.playerX ? again.playerO : again.playerX;
      const timeoutLoser = again.currentPlayer;
      const timedText = `⏰ ${mentionTag(timeoutLoser, sock, getDisplayNameForJid(timeoutLoser))} ran out of time again.\n\n${renderBoard(again.board)}\n\n🎉 ${mentionTag(timeoutWinner, sock, getDisplayNameForJid(timeoutWinner))} wins by timeout.`;
      await finalizeRankedGame(sock, chatId, again, { result: "forfeit", winner: timeoutWinner, loser: timeoutLoser, winningSymbol: again.currentPlayer === again.playerX ? "O" : "X" }, timedText);
    }, TURN_TIMEOUT);
  }, TURN_TIMEOUT);

  await sendChatMessage(sock, chatId, `✅ ${mentionTag(sender, sock, getDisplayNameForJid(sender))} placed ${getSymbolEmoji(symbol)} at ${position}.\n\n${renderBoard(game.board)}\n\n🎯 Next turn: ${mentionTag(game.currentPlayer, sock, getDisplayNameForJid(game.currentPlayer))}.`, [game.playerX, game.playerO], m);
}

function getSafeStatsForChat(chatId) {
  const data = DB.loadUserGroupData();
  const groupStats = (data.tttGroupStats || {})[chatId] || {};
  return groupStats;
}

async function showLeaderboard(sock, m, chatId, mode = "group") {
  const data = DB.loadUserGroupData();
  const senderJid = m.key?.participant || m.sender || m.key?.remoteJid || "";

  let payload;
  if (mode === "global") {
    const players = data.tttPlayers || {};
    const { entries, selfRank } = createLeaderboardRows(players, senderJid);
    payload = buildLeaderboardText({ title: "Global Tic Tac Toe Leaderboard", entries, selfRank, senderJid }, sock);
  } else {
    const groupStats = data.tttGroupStats?.[chatId] || {};
    const { entries, selfRank } = createLeaderboardRows(groupStats, senderJid);
    const groupLabel = await resolveGroupLabel(sock, chatId);
    payload = buildLeaderboardText({ title: `Tic Tac Toe Leaderboard — ${groupLabel}`, entries, selfRank, senderJid }, sock);
  }

  const text = typeof payload === "string" ? payload : payload?.text || "🏆 *Tic Tac Toe Leaderboard*\nNo scores yet.";
  const mentions = Array.isArray(payload?.mentions) ? payload.mentions : [];
  await sendChatMessage(sock, chatId, text, mentions, m);
}

async function showProfile(sock, m, chatId) {
  const sender = getSafeJid(m.key?.participant || m.sender || m.key?.remoteJid || "");
  const profile = getRankedProfileData(sender);
  if (!profile) {
    await sendChatMessage(sock, chatId, "🧾 *Tic Tac Toe Profile*\nNo ranked data yet. Start a game to begin your ladder journey.", [], m);
    return;
  }

  const level = getLevelFromXP(profile.xp || 0);
  const rankData = getRankFromRating(profile.rating || 1000);
  const groupStats = getSafeStatsForChat(chatId);
  const playerGroup = groupStats && (groupStats[profile.userId] || groupStats[getSafeJid(profile.userId)] || null);
  const rankingText = [
    "🧾 *Tic Tac Toe Profile*",
    "",
    `👤 ${mentionTag(sender, sock, profile.displayName || getDisplayNameForJid(sender))}`,
    `${rankData.emoji} *${rankData.name}* | Rating: ${(profile.rating || 1000)}`,
    `✨ XP: ${(profile.xp || 0)}`,
    `📈 Level: ${level}`,
    `✅ Wins: ${(profile.wins || 0)}`,
    `❌ Losses: ${(profile.losses || 0)}`,
    `🤝 Draws: ${(profile.draws || 0)}`,
    `🎮 Games: ${(profile.gamesPlayed || 0)}`,
    "",
    playerGroup ? `👥 Group wins: ${playerGroup.wins || 0} | Group losses: ${playerGroup.losses || 0}` : "👥 Group stats: no games yet in this chat"
  ].join("\n");

  await sendChatMessage(sock, chatId, rankingText, [sender], m);
}

module.exports = {
  command: ["ttr"],
  aliases: ["tttr", "tictactoe-rank", "rankedtictactoe"],
  resolveGroupLabel,
  category: "fun",
  description: "Ranked Tic Tac Toe with persistent stats, XP, ratings, and leaderboards",

  execute: async (sock, m, args = []) => {
    const chatId = m.chat || m.key?.remoteJid;
    const sender = getSafeJid(m.key?.participant || m.sender || m.key?.remoteJid || "");
    const sub = (args[0] || "").toLowerCase();
    const textValue = getTextFromMessage(m);
    const parsed = textValue ? textValue.split(/\s+/).filter(Boolean) : [];
    const directNumber = parsed.find((token) => /^[1-9]$/.test(token));
    const game = getGame(chatId);

    if (directNumber && game && game.started && !game.ended) {
      return await handleMove(sock, m, chatId, game, Number(directNumber));
    }

    if (!sub || sub === "help" || sub === "h") {
      const prefix = getPrefix();
      const helpText = `🎮 *Ranked Tic Tac Toe*

Commands:
• \`${prefix}ttr start\` — start a ranked match
• \`${prefix}ttr join\` — join a waiting ranked match
• \`${prefix}ttr status\` — view the current board
• \`${prefix}ttr stop\` — end the current ranked match
• \`${prefix}ttr group\` — show this group leaderboard
• \`${prefix}ttr global\` — show the global leaderboard
• \`${prefix}ttr profile\` — show your ranked stats
• \`${prefix}ttr help\` — show this help menu

Rules:
• Only one ranked match per player at a time.
• Ratings, XP, wins, losses, and draws persist after restart.
• The first player to align 3 marks wins the ranked round.`;
      return await sendChatMessage(sock, chatId, helpText, sender ? [sender] : [], m);
    }

    if (sub === "start") {
      if (game) {
        return await sendChatMessage(sock, chatId, `⚠️ A ranked game is already active in this chat. Use .ttr status or .ttr stop.`, [sender], m);
      }

      const activeInAnotherChat = getPlayerLock(sender);
      if (activeInAnotherChat && activeInAnotherChat !== chatId) {
        return await sendChatMessage(sock, chatId, `❌ You already have an active ranked match in another chat. Finish it before starting a new one.`, [sender], m);
      }

      const newGame = {
        gameId: `tttr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        chatId,
        playerX: sender,
        playerO: null,
        currentPlayer: sender,
        board: createBoard(),
        started: false,
        ended: false,
        timeout: null,
        createdAt: Date.now(),
        moveHistory: [],
        settled: false
      };

      setPlayerLock(sender, chatId);
      global.tttRankedGames[chatId] = newGame;

      return await sendChatMessage(sock, chatId, `🎮 Ranked game started by ${mentionTag(sender, sock, getDisplayNameForJid(sender))}.\n📢 Type *${getPrefix()}ttr join* to challenge them.\n\n${renderBoard(newGame.board)}`, [sender], m);
    }

    if (sub === "join") {
      if (!game) {
        return await sendChatMessage(sock, chatId, `❌ No ranked game is waiting in this chat. Start one with .ttr start.`, [sender], m);
      }

      if (game.started) {
        return await sendChatMessage(sock, chatId, `⚠️ The ranked match is already in progress. Use .ttr status to view it.`, [sender], m);
      }

      if (sender === game.playerX) {
        return await sendChatMessage(sock, chatId, `❌ You already created this ranked game. Wait for an opponent to join.`, [sender], m);
      }

      if (getPlayerLock(sender) && getPlayerLock(sender) !== chatId) {
        return await sendChatMessage(sock, chatId, `❌ You already have an active ranked match in another chat. Finish that before joining another one.`, [sender], m);
      }

      game.playerO = sender;
      game.started = true;
      game.currentPlayer = game.playerX;
      setPlayerLock(sender, chatId);
      game.timeout = setTimeout(async () => {
        if (!getGame(chatId) || getGame(chatId).ended) return;
        const currentGame = getGame(chatId);
        const timedOut = currentGame.currentPlayer;
        const nextPlayer = timedOut === currentGame.playerX ? currentGame.playerO : currentGame.playerX;
        currentGame.currentPlayer = nextPlayer;
        await sendChatMessage(sock, chatId, `⏰ ${mentionTag(timedOut, sock, getDisplayNameForJid(timedOut))} timed out. The turn was skipped.\n\n${renderBoard(currentGame.board)}\n\n🎯 Next turn: ${mentionTag(nextPlayer, sock, getDisplayNameForJid(nextPlayer))}.`, [timedOut, nextPlayer]);
      }, TURN_TIMEOUT);

      return await sendChatMessage(sock, chatId, `🎮 Ranked game started!\n\n${renderBoard(game.board)}\n\nPlayers:\n${SYMBOLS.X} ${mentionTag(game.playerX, sock, getDisplayNameForJid(game.playerX))}\n${SYMBOLS.O} ${mentionTag(game.playerO, sock, getDisplayNameForJid(game.playerO))}\n\n🎯 Next turn: ${mentionTag(game.currentPlayer, sock, getDisplayNameForJid(game.currentPlayer))}.`, [game.playerX, game.playerO], m);
    }

    if (sub === "status") {
      if (!game) {
        return await sendChatMessage(sock, chatId, `📊 No active ranked game in this chat right now.`, [sender], m);
      }

      if (!game.started) {
        return await sendChatMessage(sock, chatId, `🎮 Ranked match waiting for an opponent.\nHosted by ${mentionTag(game.playerX, sock, getDisplayNameForJid(game.playerX))}\n\n${renderBoard(game.board)}`, [game.playerX], m);
      }

      return await sendChatMessage(sock, chatId, `🎮 Ranked match in progress\n\n${renderBoard(game.board)}\n\n${SYMBOLS.X} ${mentionTag(game.playerX, sock, getDisplayNameForJid(game.playerX))}\n${SYMBOLS.O} ${mentionTag(game.playerO, sock, getDisplayNameForJid(game.playerO))}\n\n🎯 Next turn: ${mentionTag(game.currentPlayer, sock, getDisplayNameForJid(game.currentPlayer))}.`, [game.playerX, game.playerO], m);
    }

    if (sub === "stop") {
      if (!game) {
        return await sendChatMessage(sock, chatId, `❌ There is no ranked game to stop here.`, [sender], m);
      }

      if (sender !== game.playerX && sender !== game.playerO) {
        return await sendChatMessage(sock, chatId, `❌ Only players in this ranked game can stop it.`, [sender], m);
      }

      if (!game.started) {
        const oldChat = chatId;
        clearGame(oldChat);
        clearPlayerLocksForGame(game);
        return await sendChatMessage(sock, chatId, `🛑 ${mentionTag(sender, sock, getDisplayNameForJid(sender))} cancelled the waiting ranked match.`, [sender], m);
      }

      const winner = sender === game.playerX ? game.playerO : game.playerX;
      const loser = sender;
      const stopText = `🛑 ${mentionTag(sender, sock, getDisplayNameForJid(sender))} stopped the ranked match.\n\n${renderBoard(game.board)}\n\n🎉 ${mentionTag(winner, sock, getDisplayNameForJid(winner))} wins by forfeit.`;
      await finalizeRankedGame(sock, chatId, game, { result: "forfeit", winner, loser, winningSymbol: sender === game.playerX ? "O" : "X" }, stopText);
      return;
    }

    if (sub === "leave") {
      if (!game) {
        return await sendChatMessage(sock, chatId, `❌ No ranked game is active in this chat.`, [sender], m);
      }

      if (sender !== game.playerX && sender !== game.playerO) {
        return await sendChatMessage(sock, chatId, `❌ Only players in the current ranked match can leave it.`, [sender], m);
      }

      if (!game.started) {
        clearGame(chatId);
        clearPlayerLock(sender);
        return await sendChatMessage(sock, chatId, `🛑 ${mentionTag(sender, sock, getDisplayNameForJid(sender))} left the waiting ranked game and it was cancelled.`, [sender], m);
      }

      const winner = sender === game.playerX ? game.playerO : game.playerX;
      const loser = sender;
      const leaveText = `🚪 ${mentionTag(sender, sock, getDisplayNameForJid(sender))} left the ranked match.\n\n${renderBoard(game.board)}\n\n🎉 ${mentionTag(winner, sock, getDisplayNameForJid(winner))} wins by forfeit.`;
      await finalizeRankedGame(sock, chatId, game, { result: "forfeit", winner, loser, winningSymbol: sender === game.playerX ? "O" : "X" }, leaveText);
      return;
    }

    if (sub === "group" || sub === "leaderboard" || sub === "lb") {
      await showLeaderboard(sock, m, chatId, "group");
      return;
    }

    if (sub === "global") {
      await showLeaderboard(sock, m, chatId, "global");
      return;
    }

    if (sub === "profile" || sub === "stats") {
      await showProfile(sock, m, chatId);
      return;
    }

    return await sendChatMessage(sock, chatId, `❌ Unknown command. Use .ttr help for the full ranked command list.`, [sender], m);
  },

  init: (sock) => {
    if (sock.__tttRankedAttached) return;
    sock.__tttRankedAttached = true;

    sock.ev.on("messages.upsert", async ({ messages }) => {
      if (!Array.isArray(messages) || !messages.length) return;
      const prefix = getPrefix();
      for (const m of messages) {
        if (!m || !m.message) continue;
        const chatId = m.key?.remoteJid;
        if (!chatId) continue;
        const text = getTextFromMessage(m);
        if (!text || text.startsWith(prefix)) continue;
        const game = getGame(chatId);
        if (!game || !game.started || game.ended) continue;
        const sender = getSafeJid(m.key?.participant || m.sender || m.key?.remoteJid || "");
        if (!sender) continue;
        const trimmed = text.trim();
        if (!/^[1-9]$/.test(trimmed)) continue;
        if (sender !== game.currentPlayer) continue;
        await handleMove(sock, m, chatId, game, Number(trimmed));
      }
    });
  }
};
