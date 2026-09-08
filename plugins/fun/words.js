const axios = require('axios');
const DB = require('../../lib/database');

const API_URL = 'https://api.shizo.top/games/gtw?apikey=shizo';
const FALLBACK_WORDS = [
  'apple','banana','orange','elephant','guitar','puzzle','rocket','diamond','butterfly','penguin',
  'mountain','river','computer','javascript','network','calendar','library','island','ocean','picture',
  'sunshine','rainbow','museum','stadium','gardener','chocolate','airplane','starfish','building','keyboard'
];
const DIFFICULTIES = ['easy', 'normal', 'hard'];

function extractMessageText(m) {
  return (m.message?.conversation
    || m.message?.extendedTextMessage?.text
    || m.message?.buttonsResponseMessage?.selectedButtonId
    || m.message?.listResponseMessage?.singleSelectReply?.selectedRowId
    || m.message?.imageMessage?.caption
    || m.message?.videoMessage?.caption
    || m.message?.documentMessage?.caption
    || '').toString().trim();
}

function maskWord(word, revealedIndexes = []) {
  return word.split('').map((ch, i) => (/[A-Za-z0-9]/.test(ch) ? (revealedIndexes.includes(i) ? ch : '_') : ch)).join('');
}

function revealRandomLetters(word, revealedIndexes = [], count = 1) {
  const candidates = [];
  for (let i = 0; i < word.length; i++) {
    if (/[A-Za-z0-9]/.test(word[i]) && !revealedIndexes.includes(i)) candidates.push(i);
  }
  if (!candidates.length) return revealedIndexes;

  while (revealedIndexes.length < Math.min(revealedIndexes.length + count, candidates.length)) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (!revealedIndexes.includes(pick)) revealedIndexes.push(pick);
  }

  return Array.from(new Set(revealedIndexes)).sort((a, b) => a - b);
}

function now() { return Date.now(); }

function buildUsage(prefix = '.') {
  return [
    'Usage:',
    '• `' + prefix + 'word start [easy|normal|hard]` - start a new game',
    '• `' + prefix + 'word stop` - stop the current game',
    '• `' + prefix + 'word hint` - reveal extra letters',
    '• `' + prefix + 'word status` - show current game status',
    '• `' + prefix + 'word leaderboard` - show top winners',
    '• `' + prefix + 'guess <word>` - submit your answer'
  ].join('\n');
}

async function fetchGameData() {
  try {
    const response = await axios.get(API_URL, { timeout: 10000 });
    const body = response.data || {};
    const payload = body.data || body.result || body;
    const answer = String(payload.answer || payload.word || payload.text || '').trim();
    const question = String(payload.question || payload.prompt || payload.hint || payload.description || '').trim();
    if (answer) return { answer, question };
  } catch (err) {
    console.warn('[words] fetchGameData failed:', err?.message || err);
  }
  return null;
}

module.exports = {
  command: ['word', 'words'],
  category: 'fun',
  description: 'Play Guess The Word using the Shizo API',
  usage: '.word start [easy|normal|hard] - start game, .word stop - stop game, .word hint - reveal letters, .word leaderboard - top winners, .guess <word> - answer',

  async execute(sock, m, args, config) {
    const chat = m.chat || m.key?.remoteJid;
    if (!chat) return;

    const senderFull = m.sender || (m.key && m.key.participant) || '';
    const { normalizeJid, formatMentionText, buildMentionJids } = require('../../lib/mentions');
    const senderNormalized = (senderFull && normalizeJid(senderFull)) || '';
    const sender = senderNormalized.replace(/@.*$/, '');

    if (!global.wordGameSessions) global.wordGameSessions = {};

    const db = DB.loadUserGroupData();
    db.wordGameLeaderboard = db.wordGameLeaderboard || db.guessTheWordLeaderboard || {};

    const rawText = extractMessageText(m);
    const prefix = config.prefix || '.';
    const tokens = rawText.startsWith(prefix)
      ? rawText.slice(prefix.length).trim().split(/\s+/)
      : [];
    const command = tokens[0]?.toLowerCase() || '';
    const sub = tokens[1]?.toLowerCase();
    const game = global.wordGameSessions[chat];
    const isWordCommand = command === 'word' || command === 'words';

    if (isWordCommand) {
      const shouldShowHelp = !sub || sub === 'help' || sub === 'usage';
      const shouldLeaderboard = sub === 'leaderboard';
      const shouldStop = sub === 'stop';
      const shouldHint = sub === 'hint';
      const shouldStatus = sub === 'status';
      const shouldStart = sub === 'start' || DIFFICULTIES.includes(sub);
      const difficulty = sub === 'start'
        ? (DIFFICULTIES.includes(tokens[2]?.toLowerCase()) ? tokens[2].toLowerCase() : 'normal')
        : (DIFFICULTIES.includes(sub) ? sub : 'normal');

      if (shouldShowHelp) {
        return sock.sendMessage(chat, { text: buildUsage(prefix) }, { quoted: m });
      }

      if (shouldLeaderboard) {
        const board = db.wordGameLeaderboard[chat] || {};
        const entries = Object.entries(board).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return sock.sendMessage(chat, { text: '🏆 No leaderboard entries yet. Win games to appear here!' }, { quoted: m });
        const msg = entries.slice(0, 10).map(([jid, score], idx) => `${idx + 1}. ${formatMentionText(jid, sock)} — ${score} wins`).join('\n');
        return sock.sendMessage(chat, { text: `🏆 Leaderboard:\n\n${msg}`, mentions: buildMentionJids(entries.slice(0, 10).map(([jid]) => jid)) }, { quoted: m });
      }

      if (shouldStop) {
        if (!game) return sock.sendMessage(chat, { text: '❌ No active game to stop.' }, { quoted: m });
        delete global.wordGameSessions[chat];
        return sock.sendMessage(chat, { text: '🛑 The word game has been stopped.' }, { quoted: m });
      }

      if (shouldHint) {
        if (!game) return sock.sendMessage(chat, { text: '❌ No active game. Start one with `.word start`.' }, { quoted: m });
        const revealCount = game.difficulty === 'hard' ? 1 : 2;
        game.revealed = revealRandomLetters(game.answer, game.revealed || [], revealCount);
        const masked = maskWord(game.answer, game.revealed);
        return sock.sendMessage(chat, { text: `💡 Hint: ${masked}\nAttempts left: ${game.maxAttempts - game.attempts}` }, { quoted: m });
      }

      if (shouldStatus) {
        if (!game) return sock.sendMessage(chat, { text: '❌ No active game.' }, { quoted: m });
        const masked = maskWord(game.answer, game.revealed || []);
        const timeLeft = Math.max(0, Math.round((game.expiresAt - now()) / 1000));
        return sock.sendMessage(chat, {
          text: `📊 Game status:\n• Word: ${masked}\n• Attempts left: ${game.maxAttempts - game.attempts}\n• Started by: ${game.startedBy}\n• Time left: ${timeLeft}s`
        }, { quoted: m });
      }

      if (shouldStart) {
        if (game) return sock.sendMessage(chat, { text: '⚠️ A game is already active. Use `.guess <word>` to answer or `.word stop` to cancel.' }, { quoted: m });

        const payload = await fetchGameData();
        let answer = payload?.answer || '';
        let question = payload?.question || '';
        if (!answer) {
          answer = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
          question = `Guess the word with ${answer.length} letters.`;
        }

        const paramsByDifficulty = {
          easy: { maxAttempts: Math.max(8, answer.length + 2), revealOnWrong: 2 },
          normal: { maxAttempts: Math.max(5, Math.ceil(answer.length / 1.2)), revealOnWrong: 1 },
          hard: { maxAttempts: Math.max(3, Math.ceil(answer.length / 2)), revealOnWrong: 0 }
        };
        const params = paramsByDifficulty[difficulty] || paramsByDifficulty.normal;

        const cleanAnswer = answer.trim();
        const revealed = [];
        if (/[A-Za-z0-9]/.test(cleanAnswer[0])) revealed.push(0);
        if (cleanAnswer.length > 1 && /[A-Za-z0-9]/.test(cleanAnswer.at(-1))) revealed.push(cleanAnswer.length - 1);

        const gameData = {
          answer: cleanAnswer,
          question: question || `Guess the word with ${cleanAnswer.length} characters.`,
          attempts: 0,
          maxAttempts: params.maxAttempts,
          revealOnWrong: params.revealOnWrong,
          difficulty,
          revealed,
          startedBy: sender || 'unknown',
          createdAt: now(),
          expiresAt: now() + 1000 * 60 * 10
        };

        global.wordGameSessions[chat] = gameData;
        const masked = maskWord(gameData.answer, gameData.revealed);
        return sock.sendMessage(chat, {
          text: '🎯 Guess The Word started! (' + difficulty + ')\n' +
            '• Clue: ' + gameData.question + '\n' +
            '• Word: ' + masked + '\n' +
            '• Attempts left: ' + gameData.maxAttempts + '\n\n' +
            'Reply with `' + prefix + 'guess <word>` to answer, `' + prefix + 'word hint` for letters, `' + prefix + 'word stop` to end.'
        }, { quoted: m });
      }

      return sock.sendMessage(chat, { text: buildUsage(prefix) }, { quoted: m });
    }

    if (command === 'guess') {
      if (!game) return sock.sendMessage(chat, { text: '❌ No active game. Start one with `.word start`.' }, { quoted: m });
      if (game.expiresAt && now() > game.expiresAt) {
        delete global.wordGameSessions[chat];
        return sock.sendMessage(chat, { text: '⏱️ The game has expired. Start again with `.word start`.' }, { quoted: m });
      }

      const guess = args.join(' ').trim();
      if (!guess) return sock.sendMessage(chat, { text: '❌ Provide a guess. Example: `.guess apple`' }, { quoted: m });

      const normalizedAnswer = game.answer.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedGuess = guess.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (normalizedGuess === normalizedAnswer) {
        const jid = sender || 'unknown';
        db.wordGameLeaderboard[chat] = db.wordGameLeaderboard[chat] || {};
        db.wordGameLeaderboard[chat][jid] = (db.wordGameLeaderboard[chat][jid] || 0) + 1;
        DB.saveUserGroupData(db);

        delete global.wordGameSessions[chat];
        return sock.sendMessage(chat, { text: `🏆 Correct! The word was *${game.answer}*.\n${jid} now has ${db.wordGameLeaderboard[chat][jid]} wins.` }, { quoted: m });
      }

      game.attempts += 1;
      const remaining = game.maxAttempts - game.attempts;
      if (game.revealOnWrong) {
        game.revealed = revealRandomLetters(game.answer, game.revealed || [], game.revealOnWrong);
      }

      if (remaining <= 0) {
        const correct = game.answer;
        delete global.wordGameSessions[chat];
        return sock.sendMessage(chat, { text: `💥 Game over! You used all attempts.\nThe correct word was: *${correct}*` }, { quoted: m });
      }

      const masked = maskWord(game.answer, game.revealed || []);
      return sock.sendMessage(chat, { text: `❌ Wrong guess. Try again!\n• Attempts left: ${remaining}\n• Word: ${masked}\n• Hint: ${game.question}` }, { quoted: m });
    }

    return sock.sendMessage(chat, { text: '❌ Invalid command. Use `.word start` or `.words` to see usage.' }, { quoted: m });
  }
};

// External guess handler for centralized routing (plugins/fun/guess.js)
module.exports._externalGuess = async function (sockParam, mParam, argsParam, configParam) {
  const chatParam = mParam.chat || mParam.key?.remoteJid;
  if (!chatParam) return;
  const gameParam = global.wordGameSessions[chatParam];
  if (!gameParam) return sockParam.sendMessage(chatParam, { text: '❌ No active game. Start one with `.word start`.' }, { quoted: mParam });
  if (gameParam.expiresAt && now() > gameParam.expiresAt) {
    delete global.wordGameSessions[chatParam];
    return sockParam.sendMessage(chatParam, { text: '⏱️ The game has expired. Start again with `.word start`.' }, { quoted: mParam });
  }

  const guess = (argsParam && argsParam.length ? argsParam.join(' ') : '').trim();
  if (!guess) return sockParam.sendMessage(chatParam, { text: '❌ Provide a guess. Example: `.guess apple`' }, { quoted: mParam });

  const normalizedAnswer = gameParam.answer.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedGuess = guess.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalizedGuess === normalizedAnswer) {
    const senderFullLocal = mParam.sender || (mParam.key && mParam.key.participant) || '';
    const senderLocal = (senderFullLocal && senderFullLocal.replace(/@.*$/, '')) || 'unknown';
    const dbLocal = DB.loadUserGroupData();
    dbLocal.wordGameLeaderboard = dbLocal.wordGameLeaderboard || {};
    dbLocal.wordGameLeaderboard[chatParam] = dbLocal.wordGameLeaderboard[chatParam] || {};
    dbLocal.wordGameLeaderboard[chatParam][senderLocal] = (dbLocal.wordGameLeaderboard[chatParam][senderLocal] || 0) + 1;
    DB.saveUserGroupData(dbLocal);

    delete global.wordGameSessions[chatParam];
    return sockParam.sendMessage(chatParam, { text: `🏆 Correct! The word was *${gameParam.answer}*.` }, { quoted: mParam });
  }

  gameParam.attempts += 1;
  const remaining = gameParam.maxAttempts - gameParam.attempts;
  if (gameParam.revealOnWrong) {
    gameParam.revealed = revealRandomLetters(gameParam.answer, gameParam.revealed || [], gameParam.revealOnWrong);
  }

  if (remaining <= 0) {
    const correct = gameParam.answer;
    delete global.wordGameSessions[chatParam];
    return sockParam.sendMessage(chatParam, { text: `💥 Game over! You used all attempts.\nThe correct word was: *${correct}*` }, { quoted: mParam });
  }

  const masked = maskWord(gameParam.answer, gameParam.revealed || []);
  return sockParam.sendMessage(chatParam, { text: `❌ Wrong guess. Try again!\n• Attempts left: ${remaining}\n• Word: ${masked}\n• Hint: ${gameParam.question}` }, { quoted: mParam });
};
