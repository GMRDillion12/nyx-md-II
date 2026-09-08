const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { formatMentionText } = require('../../lib/mentions');

const dbPath = path.join(__dirname, '..', '..', 'data', 'riddle_xp.json');
const XP_PER_CORRECT = 10;
const LEVEL_BASE = 50;
const RIDDLE_TIMEOUT = 30000;
const API_URL = 'https://api.shizo.top/games/emoji-riddle?apikey=shizo';

global.riddleGame = global.riddleGame || {};
global.userXP = global.userXP || {};

function loadXP() {
  try {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (err) {
    console.error('[RIDDLE DB] Load error:', err.message);
    return {};
  }
}

function saveXP() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(global.userXP, null, 2));
  } catch (err) {
    console.error('[RIDDLE DB] Save error:', err.message);
  }
}

global.userXP = loadXP();

// Keyword → emoji mapping to make emoji clues more relevant to answers
const emojiMap = {
  apple: '🍎',
  banana: '🍌',
  cat: '🐱',
  dog: '🐶',
  car: '🚗',
  bus: '🚌',
  train: '🚆',
  book: '📚',
  music: '🎵',
  guitar: '🎸',
  cake: '🎂',
  star: '⭐',
  sun: '☀️',
  moon: '🌙',
  fire: '🔥',
  water: '💧',
  phone: '📱',
  computer: '💻',
  house: '🏠',
  key: '🔑',
  money: '💰',
  love: '❤️',
  heart: '❤️',
  camera: '📷',
  tree: '🌳',
  school: '🎓',
  teacher: '🧑\u200d🏫',
  student: '🧑\u200d🎓',
  pizza: '🍕',
  coffee: '☕',
  pen: '✏️',
  clock: '⏰',
  king: '🤴',
  queen: '👸',
  man: '👨',
  woman: '👩',
  boy: '👦',
  girl: '👧',
  bird: '🐦',
  fish: '🐟',
  phone: '📱',
  laptop: '💻',
  camera: '📷',
  doctor: '🩺',
  police: '👮',
  plane: '✈️',
  boat: '⛵',
  chef: '👩\u200d🍳',
  sword: '🗡️',
  crown: '👑',
  robot: '🤖',
  cake: '🎂',
  birthday: '🎉'
};

// Friendly labels for common API category/type values
const categoryLabels = {
  subject: 'Subject',
  animals: 'Animals',
  food: 'Food',
  sport: 'Sports',
  technology: 'Technology',
  movies: 'Movies',
  flags: 'Flags',
  books: 'Books',
  nature: 'Nature',
  science: 'Science',
  music: 'Music',
  general: 'General'
};

function generateEmojisFromAnswer(answer) {
  if (!answer) return '';
  const words = answer
    .toLowerCase()
    .replace(/[\W_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const emojis = [];
  for (const w of words) {
    if (emojiMap[w]) {
      if (!emojis.includes(emojiMap[w])) emojis.push(emojiMap[w]);
    }
  }
  // If no direct mapping, try substring matches
  if (!emojis.length) {
    for (const key of Object.keys(emojiMap)) {
      if (answer.includes(key) && !emojis.includes(emojiMap[key])) emojis.push(emojiMap[key]);
      if (emojis.length >= 3) break;
    }
  }
  // Limit to 3 emojis for brevity
  if (emojis.length) return emojis.slice(0, 3).join(' ');
  return '';
}
async function fetchRiddle() {
  try {
    const response = await axios.get(API_URL, { timeout: 10000 });
    const payload = response.data;
    if (payload && payload.status && payload.data) {
      const answer = (payload.data.answer || 'riddle').toLowerCase();
      // Prefer generated emojis based on the answer to keep clues relevant.
      const gen = generateEmojisFromAnswer(answer);
      const rawQuestion = payload.data.question || '🧩❓';
      const question = gen || rawQuestion || '🧩❓';
      const typeRaw = (payload.data.type || 'general').toString().toLowerCase();
      const type = categoryLabels[typeRaw] || payload.data.type || 'General';
      return { question, answer, type };
    }
  } catch (err) {
    console.error('[RIDDLE API] Fetch failed:', err.message);
  }
  return {
    question: '🧩❓',
    answer: 'riddle',
    type: 'General'
  };
}

function getText(m) {
  return (
    m.text ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    ''
  ).trim();
}

function getUser(m) {
  return m.sender || m.key?.participant || m.key?.remoteJid || '';
}

function getChat(m) {
  return m.chat || m.key?.remoteJid || '';
}

function formatHint(answer) {
  if (!answer) return '';
  if (answer.length <= 2) return '_'.repeat(answer.length);
  return `${answer[0]}${'_'.repeat(answer.length - 2)}${answer.slice(-1)}`;
}

function getLeaderboard() {
  return Object.entries(global.userXP)
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, 10);
}

module.exports = {
  command: ['riddle'],
  aliases: ['riddleskip', 'riddlescore', 'riddlexp', 'leaderboard', 'riddlehint', 'riddlestatus', 'riddlehelp', 'riddlestats'],
  category: 'fun',
  description: 'Emoji riddle game with XP and leaderboards',

  execute: async (sock, m) => {
    try {
      const chat = getChat(m);
      const user = getUser(m);
      if (!chat || !user) return;

      const text = getText(m);
      const rawCmd = text.split(/\s+/)[0] || '';
      const cmd = rawCmd.replace(/^[.#!/\\]/, '').toLowerCase();
      const args = text.trim().split(/\s+/).slice(1);
      const sub = args[0]?.toLowerCase() || '';
      const answer = args.slice(1).join(' ').toLowerCase();
      const active = global.riddleGame[chat];

      const send = async (payload) => sock.sendMessage(chat, payload, { quoted: m });
      const sendText = async (body, mentions = []) => send({ text: body, mentions });

      const allowed = ['riddle', 'answer', 'riddleskip', 'riddlescore', 'riddlexp', 'leaderboard', 'riddlehint', 'riddlestatus', 'riddlehelp', 'riddlestats'];
      if (!allowed.includes(cmd)) return;

      if (cmd === 'riddle') {
        if (!sub) {
          const status = active ? `📊 Active riddle • Category: ${active.type}` : '📊 No active riddle. Use .riddle start';
          return await sendText(`🧩 *EMOJI RIDDLE GAME*\n\n${status}\n\nCommands:\n• .riddle start\n• .riddle stop\n• .riddle answer <guess>\n• .riddle hint\n• .riddle skip\n• .riddlestatus\n• .riddlescore\n• .leaderboard\n• .riddlexp\n• .riddlehelp\n• .riddlestats`);
        }

        if (sub === 'start') {
          if (active) return await sendText('⚠️ A riddle is already active. Use .riddle stop or .riddleskip.');
          const loading = await send({ text: '🔄 Fetching riddle...' });
          const riddle = await fetchRiddle();
          global.riddleGame[chat] = { answer: riddle.answer, type: riddle.type, timer: null };
          global.riddleGame[chat].timer = setTimeout(async () => {
            if (!global.riddleGame[chat]) return;
            await sock.sendMessage(chat, { text: `⏰ Time's up!\n\nQuestion: ${riddle.question}\nAnswer: *${global.riddleGame[chat].answer.toUpperCase()}*\nCategory: *${global.riddleGame[chat].type}*` });
            delete global.riddleGame[chat];
          }, RIDDLE_TIMEOUT);
          return await send({ text: `🧩 *Riddle Started!*\n\nQuestion: ${riddle.question}\nCategory: *${riddle.type}*\n\nReply with .riddle answer <guess>`, edit: loading.key });
        }

        if (sub === 'stop') {
          if (!active) return await sendText('❌ No active riddle to stop.');
          clearTimeout(active.timer);
          const result = `🛑 *Riddle Stopped!*\n\nAnswer: *${active.answer.toUpperCase()}*\nCategory: *${active.type}*`;
          delete global.riddleGame[chat];
          return await sendText(result);
        }

        if (sub === 'answer') {
          if (!active) return await sendText('❌ No active riddle. Use .riddle start.');
          if (!answer) return await sendText('⚠️ Usage: .riddle answer <your guess>');
          if (answer === active.answer.toLowerCase()) {
            clearTimeout(active.timer);
            const profile = global.userXP[user] || { xp: 0, level: 1 };
            profile.xp += XP_PER_CORRECT;
            const needed = profile.level * LEVEL_BASE;
            const leveledUp = profile.xp >= needed;
            if (leveledUp) profile.level++;
            global.userXP[user] = profile;
            saveXP();
            delete global.riddleGame[chat];
            const userMention = formatMentionText(user, sock);
            return await sendText(`🎉 *Correct!*\n\n${userMention} solved it!\nAnswer: *${active.answer.toUpperCase()}*\nCategory: *${active.type}*\n\nXP: +${XP_PER_CORRECT}\nTotal XP: ${profile.xp}\nLevel: ${profile.level}${leveledUp ? ' 🔥 Level Up!' : ''}`, [user]);
          }
          return await sendText('❌ Wrong answer. Try again.');
        }

        if (sub === 'hint') {
          if (!active) return await sendText('❌ No active riddle to hint.');
          return await sendText(`💡 Hint: ${formatHint(active.answer)}\nAnswer length: ${active.answer.length}`);
        }

        if (sub === 'skip') {
          if (!active) return await sendText('❌ No active riddle to skip.');
          clearTimeout(active.timer);
          const result = `⏭️ *Riddle Skipped!*\n\nAnswer: *${active.answer.toUpperCase()}*\nCategory: *${active.type}*`;
          delete global.riddleGame[chat];
          return await sendText(result);
        }

        if (sub === 'status') {
          return await sendText(active ? `📊 Active riddle • Category: ${active.type} • Time left: ${Math.max(0, Math.ceil((active.timer._idleStart + active.timer._idleTimeout - Date.now()) / 1000))}s` : '📊 No active riddle.');
        }

        if (sub === 'help') {
          return await sendText(`🧩 *Riddle Help*\n\nCommands:\n• .riddle start\n• .riddle stop\n• .riddle answer <guess>\n• .riddle hint\n• .riddle skip\n• .riddlestatus\n• .riddlescore\n• .leaderboard\n• .riddlexp\n• .riddlestats`);
        }

        return await sendText('⚠️ Unknown riddle option. Use .riddle help.');
      }

      if (cmd === 'riddleskip') {
        if (!active) return await sendText('❌ No active riddle to skip.');
        clearTimeout(active.timer);
        const result = `⏭️ *Riddle Skipped!*\n\nAnswer: *${active.answer.toUpperCase()}*\nCategory: *${active.type}*`;
        delete global.riddleGame[chat];
        return await sendText(result);
      }

      if (cmd === 'riddlescore') {
        const board = getLeaderboard();
        if (!board.length) return await sendText('📊 No scores yet. Play some riddles!');
        const textLines = board.map((entry, index) => `${index + 1}. ${formatMentionText(entry[0], sock)} — XP: ${entry[1].xp} | Level: ${entry[1].level}`);
        return await sendText(`🏆 *Riddle Leaderboard*\n\n${textLines.join('\n')}`, board.map(entry => entry[0]));
      }

      if (cmd === 'riddlexp') {
        const target = args[0] ? `${args[0].replace(/@/g, '')}@s.whatsapp.net` : user;
        const profile = global.userXP[target];
        if (!profile) return await sendText('❌ This user has no XP yet.');
        return await sendText(`👤 ${formatMentionText(target, sock)}\nXP: ${profile.xp}\nLevel: ${profile.level}`, [target]);
      }

      if (cmd === 'leaderboard') {
        const board = getLeaderboard();
        if (!board.length) return await sendText('🌎 No leaderboard data yet.');
        const textLines = board.map((entry, index) => `${index + 1}. ${formatMentionText(entry[0], sock)} — XP: ${entry[1].xp} | Level: ${entry[1].level}`);
        return await sendText(`🌎 *Global Leaderboard*\n\n${textLines.join('\n')}`, board.map(entry => entry[0]));
      }

      if (cmd === 'riddlehint') {
        if (!active) return await sendText('❌ No active riddle to hint.');
        return await sendText(`💡 Hint: ${formatHint(active.answer)}\nAnswer length: ${active.answer.length}`);
      }

      if (cmd === 'riddlestatus') {
        return await sendText(active ? `📊 Active riddle • Category: ${active.type} • Time left: ${Math.max(0, Math.ceil((active.timer._idleStart + active.timer._idleTimeout - Date.now()) / 1000))}s` : '📊 No active riddle.');
      }

      if (cmd === 'riddlehelp') {
        return await sendText(`🧩 *Riddle Help*\n\nCommands:\n• .riddle start\n• .riddle stop\n• .riddle answer <guess>\n• .riddle hint\n• .riddle skip\n• .riddlestatus\n• .riddlescore\n• .leaderboard\n• .riddlexp\n• .riddlestats`);
      }

      if (cmd === 'riddlestats') {
        const users = Object.keys(global.userXP).length;
        const totalXP = Object.values(global.userXP).reduce((sum, profile) => sum + (profile.xp || 0), 0);
        const totalLevels = Object.values(global.userXP).reduce((sum, profile) => sum + (profile.level || 0), 0);
        const avgLevel = users > 0 ? (totalLevels / users).toFixed(1) : 0;
        return await sendText(`📊 *Riddle Stats*\n\nPlayers: ${users}\nTotal XP: ${totalXP}\nAverage Level: ${avgLevel}\n${active ? `Active Game: ${active.type}` : 'No active game currently.'}`);
      }
    } catch (error) {
      console.error('[RIDDLE PLUGIN] Fatal error:', error);
      await sock.sendMessage(chat, { text: '❌ Riddle plugin error. Try again later.' }, { quoted: m });
    }
  }
};
