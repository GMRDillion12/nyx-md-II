const { normalizeJid } = require('../../lib/mentions');

module.exports = {
  command: ['guess'],
  category: 'fun',
  description: 'Route guess to active word or hangman game',

  async execute(sock, m, args, config) {
    const chat = m.chat || m.key?.remoteJid;
    if (!chat) return;

    const raw = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
    const prefix = config.prefix || '.';
    const text = raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : raw;
    const tokens = text.split(/\s+/).filter(Boolean);
    const guessText = tokens.slice(1).join(' ').trim();

    // Prefer hangman if active in this chat
    const hangmanActive = global.hangmanGames && global.hangmanGames[chat];
    const wordActive = global.wordGameSessions && global.wordGameSessions[chat];

    if (!hangmanActive && !wordActive) {
      return sock.sendMessage(chat, { text: '❌ No active game. Start a Hangman with .hg start or a Word game with .word start.' }, { quoted: m });
    }

    if (hangmanActive) {
      // invoke hangman's internal guess handler by fabricating a .hangman guess message
      try {
        const hangman = require('./hangman');
        const prefixLocal = (config && config.prefix) || '.';
        const fakeMsg = Object.assign({}, m, { message: { conversation: `${prefixLocal}hangman guess ${guessText}` } });
        if (typeof hangman.execute === 'function') {
          return await hangman.execute(sock, fakeMsg, [], config);
        }
      } catch (e) {
        // fallthrough to direct message
      }
    }

    if (wordActive) {
      try {
        const words = require('./words');
        if (typeof words._externalGuess === 'function') {
          return await words._externalGuess(sock, m, args, config);
        }
      } catch (e) {
        // fallthrough
      }

      // fallback: replicate simple guess behavior
      const game = global.wordGameSessions[chat];
      if (!game) return sock.sendMessage(chat, { text: '❌ No active word game. Start one with .word start' }, { quoted: m });
      const guess = guessText || args.join(' ').trim();
      if (!guess) return sock.sendMessage(chat, { text: '❌ Provide a guess. Example: `.guess apple`' }, { quoted: m });

      const normalizedAnswer = game.answer.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedGuess = guess.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (normalizedGuess === normalizedAnswer) {
        const senderFull = m.sender || (m.key && m.key.participant) || '';
        const sender = (senderFull && normalizeJid(senderFull).replace(/@.*$/, '')) || 'unknown';
        const DB = require('../../lib/database');
        const db = DB.loadUserGroupData();
        db.wordGameLeaderboard = db.wordGameLeaderboard || {};
        db.wordGameLeaderboard[chat] = db.wordGameLeaderboard[chat] || {};
        db.wordGameLeaderboard[chat][sender] = (db.wordGameLeaderboard[chat][sender] || 0) + 1;
        DB.saveUserGroupData(db);

        delete global.wordGameSessions[chat];
        return sock.sendMessage(chat, { text: `🏆 Correct! The word was *${game.answer}*.` }, { quoted: m });
      }

      game.attempts += 1;
      const remaining = game.maxAttempts - game.attempts;
      if (game.revealOnWrong) {
        const wordsModule = require('./words');
        if (typeof wordsModule.revealRandomLetters === 'function') {
          game.revealed = wordsModule.revealRandomLetters(game.answer, game.revealed || [], game.revealOnWrong);
        }
      }

      if (remaining <= 0) {
        const correct = game.answer;
        delete global.wordGameSessions[chat];
        return sock.sendMessage(chat, { text: `💥 Game over! You used all attempts.\nThe correct word was: *${correct}*` }, { quoted: m });
      }

      const mask = require('./words').maskWord;
      const masked = typeof mask === 'function' ? mask(game.answer, game.revealed || []) : game.answer.replace(/./g, '_');
      return sock.sendMessage(chat, { text: `❌ Wrong guess. Try again!\n• Attempts left: ${remaining}\n• Word: ${masked}\n• Hint: ${game.question}` }, { quoted: m });
    }

    return sock.sendMessage(chat, { text: '❌ Unable to process guess right now.' }, { quoted: m });
  }
};
