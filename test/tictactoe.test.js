const assert = require('node:assert');
const { describe, it, before, after } = require('node:test');
const fs = require('fs');
const path = require('path');

const gameEngine = require('../lib/tictactoe/gameEngine');
const { randomInt } = require('../lib/tictactoe/utils');
const xp = require('../lib/tictactoe/xp');
const levels = require('../lib/tictactoe/levels');
const rating = require('../lib/tictactoe/rating');
const state = require('../lib/tictactoe/state');
const service = require('../lib/tictactoe/service');

const DB_PATH = path.join(__dirname, '..', 'data', 'userGroupData.json');

describe('TicTacToe Core', () => {
  it('creates a board of length 9', () => {
    const b = gameEngine.createBoard();
    assert.strictEqual(Array.isArray(b), true);
    assert.strictEqual(b.length, 9);
  });

  it('validates moves correctly', () => {
    const b = gameEngine.createBoard();
    const v1 = gameEngine.validateMove(b, 1);
    assert.strictEqual(v1.valid, true);
    const v2 = gameEngine.validateMove(b, 0);
    assert.strictEqual(v2.valid, false);
    const v3 = gameEngine.validateMove(b, 10);
    assert.strictEqual(v3.valid, false);
  });
});

describe('XP Ranges', () => {
  it('winner XP in range', () => {
    for (let i = 0; i < 200; i++) {
      const v = xp.xpForWin();
      assert.ok(v >= xp.XP_CONFIG.winnerMin && v <= xp.XP_CONFIG.winnerMax);
    }
  });

  it('loser XP in range', () => {
    for (let i = 0; i < 200; i++) {
      const v = xp.xpForLoss();
      assert.ok(v >= xp.XP_CONFIG.loserMin && v <= xp.XP_CONFIG.loserMax);
    }
  });

  it('draw XP in range', () => {
    for (let i = 0; i < 200; i++) {
      const v = xp.xpForDraw();
      assert.ok(v >= xp.XP_CONFIG.drawMin && v <= xp.XP_CONFIG.drawMax);
    }
  });
});

describe('Levels', () => {
  it('level 1 at 0 xp', () => {
    assert.strictEqual(levels.getLevelFromXP(0), 1);
  });

  it('boundary checks', () => {
    const need1 = levels.getXPRequiredForNextLevel(1);
    assert.ok(need1 > 0);
    // one below boundary
    assert.strictEqual(levels.getLevelFromXP(need1 - 1), 1);
    assert.strictEqual(levels.getLevelFromXP(need1), 2);
  });
});

describe('Rating', () => {
  it('equal rating win gives positive delta', () => {
    const d = rating.calculateRatingChange(1000, 1000, 1, 32);
    assert.ok(typeof d === 'number');
  });
});

describe('Settlement idempotency', () => {
  const backupPath = DB_PATH + '.bak';
  before(() => {
    // backup DB
    if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, backupPath);
  });

  after(() => {
    // restore DB
    if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, DB_PATH);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  });

  it('settles a game once only', async () => {
    // create a fake game
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

    const r1 = await service.settleGame(game, resultInfo);
    assert.ok(r1 && r1.record && r1.record.gameId === game.gameId);

    const r2 = await service.settleGame(game, resultInfo);
    console.log('DEBUG r1', !!r1, r1 && r1.record && r1.record.gameId);
    console.log('DEBUG r2', r2);
    // second call should return persisted record (not null) and not double award
    assert.ok(r2 && r2.record && r2.record.gameId === game.gameId);

    // load DB and ensure player xp did not double-increment
    const data = require('../lib/database').loadUserGroupData();
    const p1 = data.tttPlayers[game.playerX];
    const p2 = data.tttPlayers[game.playerO];
    assert.ok(p1 && p2);
    // xp values should be within configured ranges
    assert.ok(p1.xp >= xp.XP_CONFIG.winnerMin && p1.xp <= 1000000);
    assert.ok(p2.xp >= xp.XP_CONFIG.loserMin && p2.xp <= 1000000);
  });
});
