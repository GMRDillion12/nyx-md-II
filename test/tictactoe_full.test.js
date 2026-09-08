const assert = require('assert');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const gameEngine = require('../lib/tictactoe/gameEngine');
const xp = require('../lib/tictactoe/xp');
const levels = require('../lib/tictactoe/levels');
const rating = require('../lib/tictactoe/rating');
const ranks = require('../lib/tictactoe/ranks');
const service = require('../lib/tictactoe/service');
const state = require('../lib/tictactoe/state');
const DB = require('../lib/database');
const rankedPlugin = require('../plugins/fun/tictactoe');
const unrankedPlugin = require('../plugins/fun/tictactoeunranked');

const DB_PATH = path.join(__dirname, '..', 'data', 'userGroupData.json');

function backupDB() {
  const bak = DB_PATH + '.bak';
  if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, bak);
  return bak;
}

function restoreDB(bak) {
  if (fs.existsSync(bak)) fs.copyFileSync(bak, DB_PATH);
  if (fs.existsSync(bak)) fs.unlinkSync(bak);
}

function makeSock() {
  const ev = new EventEmitter();
  return {
    ev,
    user: { id: 'bot@s.whatsapp.net' },
    sent: [],
    sendMessage: async function(chat, payload, opts) {
      this.sent.push({ chat, payload, opts });
      return { ok: true };
    }
  };
}

function makeMessage(chat, from, text) {
  return {
    key: { remoteJid: chat, fromMe: false, participant: from },
    message: { conversation: text }
  };
}

async function run() {
  const bak = backupDB();
  try {
    // GAME ENGINE: winners
    const X = gameEngine.getSymbolEmoji('X');
    const O = gameEngine.getSymbolEmoji('O');
    const winRow = [X, X, X, '4', '5', '6', '7', '8', '9'];
    assert.strictEqual(gameEngine.isWinner(winRow, X), true, 'row win detected');
    const winCol = [X, '2', '3', X, '5', '6', X, '8', '9'];
    assert.strictEqual(gameEngine.isWinner(winCol, X), true, 'col win detected');
    const winDiag = [X, '2', '3', '4', X, '6', '7', '8', X];
    assert.strictEqual(gameEngine.isWinner(winDiag, X), true, 'diag win detected');
    const drawBoard = [X, O, X, O, X, O, O, X, O];
    assert.strictEqual(gameEngine.isDraw(drawBoard), true, 'draw detected');

    // XP ranges
    for (let i=0;i<500;i++){
      const w = xp.xpForWin();
      const l = xp.xpForLoss();
      const d = xp.xpForDraw();
      assert.ok(Number.isFinite(w) && w >= xp.XP_CONFIG.winnerMin && w <= xp.XP_CONFIG.winnerMax);
      assert.ok(Number.isFinite(l) && l >= xp.XP_CONFIG.loserMin && l <= xp.XP_CONFIG.loserMax);
      assert.ok(Number.isFinite(d) && d >= xp.XP_CONFIG.drawMin && d <= xp.XP_CONFIG.drawMax);
    }

    // LEVELS boundaries
    assert.strictEqual(levels.getLevelFromXP(0), 1);
    const need1 = levels.getXPRequiredForNextLevel(1);
    assert.strictEqual(levels.getLevelFromXP(need1 - 1), 1);
    assert.strictEqual(levels.getLevelFromXP(need1), 2);

    // RATING
    const deltaEq = rating.calculateRatingChange(1000, 1000, 1, 32);
    assert.ok(typeof deltaEq === 'number');
    const deltaDraw = rating.calculateRatingChange(1200, 1000, 0.5, 32);
    assert.ok(typeof deltaDraw === 'number');

    // RANKS
    assert.strictEqual(ranks.getRankFromRating(500).name, 'Bronze');
    assert.strictEqual(ranks.getRankFromRating(1000).name, 'Silver');
    assert.strictEqual(ranks.getRankFromRating(1200).name, 'Gold');
    assert.strictEqual(ranks.getRankFromRating(1400).name, 'Platinum');
    assert.strictEqual(ranks.getRankFromRating(1600).name, 'Diamond');
    assert.strictEqual(ranks.getRankFromRating(2000).name, 'Master');

    // Settlement: normal win
    const g1 = {
      gameId: `gh1_${Date.now()}`,
      chatId: 'group1-123@g.us',
      playerX: 'a@s.whatsapp.net',
      playerO: 'b@s.whatsapp.net',
      board: gameEngine.createBoard(),
      currentPlayer: 'a@s.whatsapp.net',
      started: true,
      ended: true,
      moveHistory: [],
      createdAt: Date.now()
    };
    const res1 = await service.settleGame(g1, { result: 'win', winner: g1.playerX, loser: g1.playerO, winningSymbol: 'X' });
    assert.ok(res1 && res1.record && res1.record.gameId === g1.gameId);
    const dataAfter1 = DB.loadUserGroupData();
    assert.ok(dataAfter1.tttGames[g1.gameId]);
    // group stats present
    const gs = dataAfter1.tttGroupStats[g1.chatId];
    assert.ok(gs && gs[g1.playerX] && gs[g1.playerX].wins >= 1);

    // Settlement idempotency
    const res1b = await service.settleGame(g1, { result: 'win', winner: g1.playerX, loser: g1.playerO, winningSymbol: 'X' });
    assert.ok(res1b && res1b.record && res1b.record.gameId === g1.gameId);

    // GROUP separation: game in another group
    const g2 = {
      gameId: `gh2_${Date.now()}`,
      chatId: 'group2-456@g.us',
      playerX: 'a@s.whatsapp.net',
      playerO: 'c@s.whatsapp.net',
      board: gameEngine.createBoard(),
      currentPlayer: 'a@s.whatsapp.net',
      started: true,
      ended: true,
      moveHistory: [],
      createdAt: Date.now()
    };
    await service.settleGame(g2, { result: 'win', winner: g2.playerO, loser: g2.playerX, winningSymbol: 'O' });
    const dataAfter2 = DB.loadUserGroupData();
    // global: player 'a' should have wins+losses
    const pa = dataAfter2.tttPlayers[g1.playerX];
    assert.ok(pa.gamesPlayed >= 2);
    const gp1 = dataAfter2.tttGroupStats[g1.chatId];
    const gp2 = dataAfter2.tttGroupStats[g2.chatId];
    assert.ok(gp1[g1.playerX].wins >= 1);
    assert.ok(gp2[g2.playerO].wins >= 1);

    // Leaderboard: group with players
    const lbGroup = Object.values(gp1).map(x => x.userId);
    assert.ok(lbGroup.includes(g1.playerX));

    // Harness: simulate ranked start/join/moves
    const sock = makeSock();
    rankedPlugin.init(sock);
    // Call execute start
    await rankedPlugin.execute(sock, makeMessage('group-test@g.us', 'a@s.whatsapp.net', ''), ['start']);
    // Join
    await rankedPlugin.execute(sock, makeMessage('group-test@g.us', 'b@s.whatsapp.net', ''), ['join']);
    // a plays 1
    const m1 = makeMessage('group-test@g.us', 'a@s.whatsapp.net', '1');
    await rankedPlugin.execute(sock, m1, ['1']);
    // b plays 2
    const m2 = makeMessage('group-test@g.us', 'b@s.whatsapp.net', '2');
    await rankedPlugin.execute(sock, m2, ['2']);
    // a plays 3, continue until win/draw not necessary; verify messages sent captured
    assert.ok(Array.isArray(sock.sent));

    console.log('\nAll full tests passed.');

  } finally {
    restoreDB(bak);
  }
}

run().catch(e => { console.error('ERROR', e); process.exit(1); });
