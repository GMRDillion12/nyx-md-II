const { getPrefix } = require("../../lib/prefixManager");
const { formatMentionText, buildMentionJids } = require('../../lib/mentions');

const BOARD_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const SYMBOLS = { X: "❌", O: "⭕" };
const WIN_PATTERNS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];
const TURN_TIMEOUT = 60_000; // 60 seconds

global.tictactoeGames = global.tictactoeGames || {};

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

function normalizeJid(jid) {
  if (!jid) return "";
  const normalized = String(jid).trim().toLowerCase();
  return normalized.split(":")[0];
}

function mention(jid, sock) {
  const normalized = normalizeJid(jid);
  return normalized ? formatMentionText(normalized, sock) : "";
}

function formatBoard(board) {
  return `${board[0]} | ${board[1]} | ${board[2]}
${board[3]} | ${board[4]} | ${board[5]}
${board[6]} | ${board[7]} | ${board[8]}`;
}

function createBoard() {
  return [...BOARD_EMOJIS];
}

function getGame(chat) {
  return global.tictactoeGames[chat];
}

function clearGame(chat) {
  const game = getGame(chat);
  if (!game) return;
  if (game.timeout) clearTimeout(game.timeout);
  delete global.tictactoeGames[chat];
}

function getPlayerSymbol(game, player) {
  if (!game) return null;
  if (player === game.playerX) return "X";
  if (player === game.playerO) return "O";
  return null;
}

function getSymbolEmoji(symbol) {
  return symbol === "X" ? SYMBOLS.X : symbol === "O" ? SYMBOLS.O : "";
}

function buildGameHeader(game, sock) {
  if (!game.started) {
    return `🎮 Tic Tac Toe started by ${mention(game.playerX, sock)}\n📢 Type *${getPrefix()}ttt join* to join!`;
  }

  return `🎮 Tic-Tac-Toe Game Started!\n\nPlayers:\n${SYMBOLS.X} ${mention(game.playerX, sock)}\n${SYMBOLS.O} ${mention(game.playerO, sock)}\n\n🎯 Next turn: ${mention(game.currentPlayer, sock)}\n📝 Enter 1-9 to play!`;
}

function getBoardText(game) {
  return formatBoard(game.board);
}

function winnerExists(board, symbol) {
  return WIN_PATTERNS.some(([a, b, c]) => board[a] === symbol && board[b] === symbol && board[c] === symbol);
}

function isDraw(board) {
  return board.every(cell => cell === SYMBOLS.X || cell === SYMBOLS.O);
}

function startTurnTimer(sock, chat) {
  const game = getGame(chat);
  if (!game || !game.started || game.ended) return;
  if (game.timeout) clearTimeout(game.timeout);

  game.timeout = setTimeout(async () => {
    if (!getGame(chat) || !game.started || game.ended) return;

    const skippedPlayer = game.currentPlayer;
    const nextPlayer = skippedPlayer === game.playerX ? game.playerO : game.playerX;
    game.currentPlayer = nextPlayer;

    await sock.sendMessage(chat, {
      text: `⏰ ${mention(skippedPlayer, sock)} took too long! Turn skipped.\n\n${getBoardText(game)}\n\n🎯 Next turn: ${mention(nextPlayer, sock)}\n📝 Enter 1-9 to play!`,
      mentions: buildMentionJids([skippedPlayer, nextPlayer])
    });

    startTurnTimer(sock, chat);
  }, TURN_TIMEOUT);
}

async function sendMessage(sock, chat, text, mentions = [], quoted = null) {
  const payload = { text };
  if (mentions.length) payload.mentions = buildMentionJids(mentions);
  if (quoted) {
    await sock.sendMessage(chat, payload, { quoted });
  } else {
    await sock.sendMessage(chat, payload);
  }
}

async function handleMove(sock, m, chat, game, position) {
  const player = normalizeJid(m.key.participant || m.sender || m.key.remoteJid);
  if (!game) return;

  const playerSymbol = getPlayerSymbol(game, player);
  if (!playerSymbol) {
    return sendMessage(sock, chat, `❌ ${mention(player, sock)}, you are not part of this game.`, [player], m);
  }

  if (!game.started) return;
  if (game.ended) return;

  if (player !== game.currentPlayer) {
    return sendMessage(
      sock,
      chat,
      `❌ ${mention(player, sock)}, it's not your turn! Current player: ${mention(game.currentPlayer, sock)}`,
      [player, game.currentPlayer],
      m
    );
  }

  if (position < 1 || position > 9) {
    return sendMessage(sock, chat, '❌ Invalid position. Enter a number from 1 to 9.', [player], m);
  }

  const index = position - 1;
  if (game.board[index] === SYMBOLS.X || game.board[index] === SYMBOLS.O) {
    return sendMessage(sock, chat, '❌ That cell is already taken. Choose another one.', [player], m);
  }

  game.board[index] = getSymbolEmoji(playerSymbol);

  if (winnerExists(game.board, SYMBOLS.X) || winnerExists(game.board, SYMBOLS.O)) {
    const winner = winnerExists(game.board, SYMBOLS.X) ? game.playerX : game.playerO;
    const winnerName = mention(winner, sock);
    await sendMessage(
      sock,
      chat,
      `✅ ${mention(player, sock)} placed ${getSymbolEmoji(playerSymbol)} at ${position}\n\n${getBoardText(game)}\n\n🎉 ${winnerName} wins!`,
      [player, winner],
      m
    );
    clearGame(chat);
    return;
  }

  if (isDraw(game.board)) {
    await sendMessage(
      sock,
      chat,
      `🤝 It's a draw!\n\n${getBoardText(game)}`,
      [game.playerX, game.playerO],
      m
    );
    clearGame(chat);
    return;
  }

  game.currentPlayer = player === game.playerX ? game.playerO : game.playerX;
  await sendMessage(
    sock,
    chat,
    `✅ ${mention(player, sock)} placed ${getSymbolEmoji(playerSymbol)} at ${position}\n\n${getBoardText(game)}\n\n🎯 Next turn: ${mention(game.currentPlayer, sock)}\n📝 Enter 1-9 to play!`,
    [game.playerX, game.playerO],
    m
  );
  startTurnTimer(sock, chat);
}

module.exports = {
  command: ["ttt"],
  aliases: ["tictactoe"],
  category: "fun",
  description: "Play Tic Tac Toe with another player",

  execute: async (sock, m, args) => {
    const chat = m.chat || m.key.remoteJid;
    const sender = normalizeJid(
      m.key.fromMe ? (sock.user?.id || sock.user?.jid || m.key.remoteJid) : (m.key.participant || m.sender || m.key.remoteJid)
    );
    const sub = (args[0] || "").toLowerCase();
    const game = getGame(chat);
    const isPlayer = game && (sender === game.playerX || sender === game.playerO);
    const send = async (body, mentions = [], quoted = null) => sendMessage(sock, chat, body, mentions, quoted);

    if (/^[1-9]$/.test(sub)) {
      if (!game || !game.started) {
        return await send('❌ No active Tic Tac Toe game in this chat right now.');
      }
      if (game.ended) {
        return await send('❌ This game has already ended. Start a new one with .ttt start.');
      }
      return await handleMove(sock, m, chat, game, Number(sub));
    }

    if (!sub || sub === "help") {
      return await send(
        `🎮 *Tic Tac Toe Help*

Commands:
• \`${getPrefix()}ttt start\` - Start a new game
• \`${getPrefix()}ttt join\` - Join a waiting game
• \`${getPrefix()}ttt status\` - Show current game board
• \`${getPrefix()}ttt stop\` - End the active game
• \`${getPrefix()}ttt leave\` - Leave the current game`
      );
    }

    if (sub === "start") {
      if (game) {
        return await send('⚠️ A game is already active in this chat. Use .ttt status or .ttt stop to manage it.', [sender]);
      }

      global.tictactoeGames[chat] = {
        board: createBoard(),
        playerX: sender,
        playerO: null,
        currentPlayer: sender,
        started: false,
        ended: false,
        timeout: null
      };

      const newGame = getGame(chat);
      return await send(
        `🎮 Tic Tac Toe started by ${mention(sender, sock)}\n📢 Type *${getPrefix()}ttt join* to join!\n\n${getBoardText(newGame)}`,
        [sender]
      );
    }

    if (sub === "join") {
      if (!game) {
        return await send('❌ No game is waiting in this chat. Start one with .ttt start.', [sender]);
      }
      if (game.started) {
        return await send('⚠️ A game is already in progress. Use .ttt status to view it.', [sender]);
      }
      if (sender === game.playerX) {
        return await send('❌ You already started this game. Wait for someone else to join.', [sender]);
      }

      game.playerO = sender;
      game.started = true;
      game.currentPlayer = game.playerX;

      await send(
        `🎮 Tic-Tac-Toe Game Started!\n\n${getBoardText(game)}\n\nPlayers:\n${SYMBOLS.X} ${mention(game.playerX, sock)}\n${SYMBOLS.O} ${mention(game.playerO, sock)}\n\n🎯 Next turn: ${mention(game.currentPlayer, sock)}\n📝 Enter 1-9 to play!`,
        [game.playerX, game.playerO]
      );

      startTurnTimer(sock, chat);
      return;
    }

    if (sub === "status") {
      if (!game) {
        return await send('📊 No active Tic Tac Toe game in this chat right now.', [sender]);
      }

      if (!game.started) {
        return await send(
          `🎮 Tic Tac Toe waiting for a second player.\nStarted by ${mention(game.playerX, sock)}\n\n${getBoardText(game)}\n\nType ${getPrefix()}ttt join to join.`,
          [game.playerX]
        );
      }

      return await send(
        `🎮 Active Tic Tac Toe Game\n\n${getBoardText(game)}\n\nPlayers:\n${SYMBOLS.X} ${mention(game.playerX, sock)}\n${SYMBOLS.O} ${mention(game.playerO, sock)}\n\n🎯 Next turn: ${mention(game.currentPlayer, sock)}\n📝 Enter 1-9 to play!`,
        [game.playerX, game.playerO]
      );
    }

    if (sub === "stop") {
      if (!game) {
        return await send('❌ No game to stop in this chat.', [sender]);
      }
      if (!isPlayer) {
        return await send('❌ Only a player in the current game can stop it.', [sender]);
      }

      clearGame(chat);
      return await send(`🛑 Tic Tac Toe has been stopped by ${mention(sender, sock)}.`, [sender]);
    }

    if (sub === "leave") {
      if (!game) {
        return await send('❌ No active game in this chat.', [sender]);
      }
      if (!isPlayer) {
        return await send('❌ Only players in the current game can leave.', [sender]);
      }

      if (!game.started) {
        clearGame(chat);
        return await send(`🛑 ${mention(sender, sock)} left the waiting game. The game has been cancelled.`, [sender]);
      }

      const remaining = sender === game.playerX ? game.playerO : game.playerX;
      clearGame(chat);
      return await send(`🛑 ${mention(sender, sock)} left the game. ${mention(remaining, sock)} wins by forfeit.`, [sender, remaining]);
    }

    return await send('❌ Unknown subcommand. Use .ttt help for available commands.', [sender]);
  },

  init: (sock) => {
    if (sock.__tttAttached) return;
    sock.__tttAttached = true;

    sock.ev.on("messages.upsert", async ({ messages }) => {
      if (!Array.isArray(messages) || !messages.length) return;

      const prefix = getPrefix();

      await Promise.all(messages.map(async (m) => {
        if (!m || !m.message) return;

        const chat = m.key.remoteJid;
        if (!chat) return;

        const text = getTextFromMessage(m);
        if (!text) return;
        if (text.trim().startsWith(prefix)) return;

        const game = getGame(chat);
        if (!game || !game.started || game.ended) return;

        const trimmed = text.trim();
        if (!/^[1-9]$/.test(trimmed)) return;

        const position = Number(trimmed);
        await handleMove(sock, m, chat, game, position);
      }));
    });
  }
};
