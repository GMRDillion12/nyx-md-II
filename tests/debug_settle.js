const service = require('../lib/tictactoe/service');
(async ()=>{
  const game = {
    gameId: `debug_${Date.now()}`,
    chatId: 'test@c.us',
    playerX: '111@s.whatsapp.net',
    playerO: '222@s.whatsapp.net',
    board: Array(9).fill(''),
    currentPlayer: '111@s.whatsapp.net',
    started: true,
    ended: true,
    moveHistory: [],
    createdAt: Date.now()
  };
  const resultInfo = { result: 'win', winner: game.playerX, loser: game.playerO, winningSymbol: 'X' };
  const r1 = await service.settleGame(game, resultInfo);
  console.log('r1', !!r1, r1 && r1.record && r1.record.gameId);
  const r2 = await service.settleGame(game, resultInfo);
  console.log('r2', r2);
})();
