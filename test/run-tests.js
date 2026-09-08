const assert = require('assert');
const fs = require('fs');
const path = require('path');

const gameEngine = require('../lib/tictactoe/gameEngine');
const xp = require('../lib/tictactoe/xp');
const levels = require('../lib/tictactoe/levels');
const rating = require('../lib/tictactoe/rating');
const service = require('../lib/tictactoe/service');
const DB = require('../lib/database');

function ok(msg) { console.log('\x1b[32m[PASS]\x1b[0m', msg); }
function fail(msg) { console.error('\x1b[31m[FAIL]\x1b[0m', msg); process.exitCode = 1; }

(async () => {
  try {
    // Game engine
    const b = gameEngine.createBoard();
    assert.strictEqual(Array.isArray(b), true, 'Board should be array');
    assert.strictEqual(b.length, 9, 'Board length should be 9');
    ok('gameEngine board creation');

    // XP ranges
    for (let i=0;i<100;i++){
      const w = xp.xpForWin();
      assert.ok(w >= xp.XP_CONFIG.winnerMin && w <= xp.XP_CONFIG.winnerMax, 'winner xp in range');
      const l = xp.xpForLoss();
      assert.ok(l >= xp.XP_CONFIG.loserMin && l <= xp.XP_CONFIG.loserMax, 'loser xp in range');
      const d = xp.xpForDraw();
      assert.ok(d >= xp.XP_CONFIG.drawMin && d <= xp.XP_CONFIG.drawMax, 'draw xp in range');
    }
    ok('xp ranges');

    // Levels
    assert.strictEqual(levels.getLevelFromXP(0), 1, 'level 1 at 0 xp');
    const need1 = levels.getXPRequiredForNextLevel(1);
    assert.ok(need1 > 0, 'need1 > 0');
    assert.strictEqual(levels.getLevelFromXP(need1 - 1), 1);
    assert.strictEqual(levels.getLevelFromXP(need1), 2);
    ok('levels progression');

    // Rating simple
    const d = rating.calculateRatingChange(1000, 1000, 1, 32);
    assert.ok(typeof d === 'number');
    ok('rating calculation');

    // Settlement idempotency (uses DB file backup)
    const dbPath = path.join(__dirname, '..', 'data', 'userGroupData.json');
    const bak = dbPath + '.bak';
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, bak);

    const game = {
      gameId: `test_ttt_${Date.now()}`,
      chatId: 'test@c.us',
      playerX: '111@s.whatsapp.net',
      playerO: '222@s.whatsapp.net',
      board: gameEngine.createBoard(),
      currentPlayer: '111@s.whatsapp.net',
      started: true,
      ended: true,
      moveHistory: [{ by: '111@s.whatsapp.net', position: 1, symbol: 'X', at: Date.now() }],
      createdAt: Date.now()
    };
    const resultInfo = { result: 'win', winner: game.playerX, loser: game.playerO, winningSymbol: 'X' };

    const res1 = await service.settleGame(game, resultInfo);
    assert.ok(res1 && res1.record && res1.record.gameId === game.gameId, 'first settlement returns record');

    const res2 = await service.settleGame(game, resultInfo);
    assert.ok(res2 && res2.record && res2.record.gameId === game.gameId, 'second settlement returns record');

    const data = DB.loadUserGroupData();
    const p1 = data.tttPlayers[game.playerX];
    const p2 = data.tttPlayers[game.playerO];
    assert.ok(p1 && p2, 'players exist after settlement');
    ok('settlement idempotency');

    if (fs.existsSync(bak)) fs.copyFileSync(bak, dbPath);
    if (fs.existsSync(bak)) fs.unlinkSync(bak);

    console.log('\nAll tests executed.');
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
})();
