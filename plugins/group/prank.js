const { loadUserGroupData, saveUserGroupData } = require('../../lib/database');
const isAdmin = require('../../lib/isAdmin');

const prankTimers = new Map();

const prankPool = [
  {
    id: 'removed',
    title: '🚨 Universal Removal',
    text: '⚠️ You have been removed from the universe. Please re-enter your reality in 3... 2... 1... welcome back 😜'
  },
  {
    id: 'selfdestruct',
    title: '💥 Self-Destruct',
    text: '🧨 Self-destruct sequence initiated... 5... 4... 3... 2... 1... KA-BOOM! 😜'
  },
  {
    id: 'ghostmode',
    title: '👻 Ghost Mode',
    text: '👻 The group has entered ghost mode. All members are now temporarily invisible to the laws of normal chat.'
  },
  {
    id: 'confetti',
    title: '🎉 Confetti Storm',
    text: '🎊 A surprise confetti storm has been launched. Please remain calm and celebrate responsibly.'
  },
  {
    id: 'wifi',
    title: '📡 Wi-Fi Glitch',
    text: '📶 The Wi-Fi has briefly become sentient and is now acting suspiciously. Please stand by.'
  },
  {
    id: 'minions',
    title: '🧒 Minion Alert',
    text: '🧠 A tiny minion has appeared and is now in charge of the conversation. Expect chaos.'
  },
  {
    id: 'rocket',
    title: '🚀 Rocket Launch',
    text: '🚀 The group is launching into orbit. Please keep your hands inside the chat until landing.'
  },
  {
    id: 'laser',
    title: '🔦 Laser Beam',
    text: '🔦 A dramatic laser beam just scanned the room. The suspense is unbearable.'
  },
  {
    id: 'timewarp',
    title: '⏰ Time Warp',
    text: '⏳ Time has warped. The last message may now be from the future. Please act normal.'
  },
  {
    id: 'mystery',
    title: '🕵️ Mystery Mode',
    text: '🕵️ A mysterious force has entered the group. Nobody knows why, but it feels important.'
  },
  {
    id: 'piano',
    title: '🎹 Piano Drop',
    text: '🎹 A giant piano has just appeared above the chat. It is currently undecided.'
  },
  {
    id: 'nuclear',
    title: '☢️ Nuclear Popcorn',
    text: '🍿 The popcorn machine has gone nuclear. The crunching is now a matter of national security.'
  },
  {
    id: 'drama',
    title: '🎭 Drama Mode',
    text: '🎭 A dramatic plot twist has been triggered. Please prepare for emotional damage.'
  },
  {
    id: 'meteor',
    title: '☄️ Meteor Shower',
    text: '☄️ The sky is raining tiny meteors. The group has been selected for cosmic entertainment.'
  },
  {
    id: 'banana',
    title: '🍌 Banana Alert',
    text: '🍌 A banana has entered the chat and is now the most powerful object in the room.'
  },
  {
    id: 'suspense',
    title: '🎬 Suspense',
    text: '🎬 The music got louder. Something important is about to happen. Or maybe not.'
  },
  {
    id: 'fortune',
    title: '🔮 Fortune Cookie',
    text: '🔮 The fortune cookie has spoken: “A prank is coming. Expect delight.”'
  },
  {
    id: 'shadow',
    title: '🌑 Shadow Clone',
    text: '🌑 A shadow clone of the group has appeared. It is strangely more organized.'
  },
  {
    id: 'pirate',
    title: '🏴‍☠️ Pirate Alert',
    text: '🏴‍☠️ Ahoy! The chat has been boarded by pirates. They demand snacks and dramatic flair.'
  },
  {
    id: 'wizard',
    title: '🧙 Wizard Visit',
    text: '🧙 A wizard has entered the chat and is now casting ridiculous spells.'
  },
  {
    id: 'bunny',
    title: '🐰 Bunny Raid',
    text: '🐰 A squad of rabbits has hijacked the conversation. They are not apologizing.'
  },
  {
    id: 'spaceship',
    title: '🛸 UFO Incoming',
    text: '🛸 A UFO has entered the chat and is currently being very mysterious.'
  },
  {
    id: 'cactus',
    title: '🌵 Cactus Mode',
    text: '🌵 The group has been transformed into a cactus-themed experience. Please adapt.'
  },
  {
    id: 'riddle',
    title: '🧩 Riddle Burst',
    text: '🧩 A sudden burst of riddles has hit the room. Your brain is now required to participate.'
  },
  {
    id: 'ghostwriter',
    title: '✍️ Ghostwriter',
    text: '✍️ The ghostwriter has taken over the chat. Everything sounds more dramatic now.'
  },
  {
    id: 'thunder',
    title: '⛈️ Thunder Clap',
    text: '⛈️ A dramatic thunder clap has echoed through the group. No one is sure why.'
  },
  {
    id: 'bubble',
    title: '🫧 Bubble Burst',
    text: '🫧 Bubbles are now floating through the chat. Please do not panic. They are harmless.'
  },
  {
    id: 'mood',
    title: '🎭 Mood Swing',
    text: '🎭 The group mood has shifted unexpectedly. Expect chaos, laughter, or both.'
  },
  {
    id: 'clock',
    title: '🕰️ Clockwork',
    text: '🕰️ The clockwork gremlins have started a tiny conspiracy in the background.'
  },
  {
    id: 'silly',
    title: '😹 Silly Mode',
    text: '😹 Silly mode has been activated. The next few messages will be gloriously unnecessary.'
  }
];

function getPrankState(data, chatId) {
  const state = data?.prank?.[chatId] || {};
  return {
    enabled: Boolean(state.enabled),
    intervalMs: Number(state.intervalMs) || 900000,
    lastPrankAt: Number(state.lastPrankAt) || 0,
    lastMessage: state.lastMessage || ''
  };
}

function setPrankState(data, chatId, patch) {
  if (!data.prank) data.prank = {};
  data.prank[chatId] = {
    ...(data.prank[chatId] || {}),
    ...patch
  };
  return data.prank[chatId];
}

function parseInterval(rawValue) {
  if (!rawValue) return null;
  const value = String(rawValue).trim().toLowerCase();
  const match = value.match(/^(\d+(?:\.\d+)?)(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    sec: 1000,
    secs: 1000,
    second: 1000,
    seconds: 1000,
    m: 60 * 1000,
    min: 60 * 1000,
    mins: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    h: 60 * 60 * 1000,
    hr: 60 * 60 * 1000,
    hrs: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };
  const ms = amount * (multipliers[unit] || 1000);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function formatInterval(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'Not set';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getRandomPrank() {
  return prankPool[Math.floor(Math.random() * prankPool.length)];
}

function clearTimer(chatId) {
  const existing = prankTimers.get(chatId);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }
  prankTimers.delete(chatId);
}

function schedulePrank(sock, chatId, config) {
  clearTimer(chatId);
  const data = loadUserGroupData();
  const state = getPrankState(data, chatId);
  if (!state.enabled || !state.intervalMs) return;

  const now = Date.now();
  const lastPrankAt = Number(state.lastPrankAt) || 0;
  const nextDelay = Math.max(1000, (lastPrankAt > 0 ? (lastPrankAt + state.intervalMs - now) : state.intervalMs));

  const timer = setTimeout(async () => {
    try {
      const currentData = loadUserGroupData();
      const currentState = getPrankState(currentData, chatId);
      if (!currentState.enabled) return;
      const prank = getRandomPrank();
      await sock.sendMessage(chatId, {
        text: `🎭 *Prank Triggered* 🎭\n\n${prank.text}`
      });
      setPrankState(currentData, chatId, {
        enabled: true,
        intervalMs: currentState.intervalMs,
        lastPrankAt: Date.now(),
        lastMessage: prank.id
      });
      saveUserGroupData(currentData);
      schedulePrank(sock, chatId, config);
    } catch (err) {
      console.error('[prank] schedulePrank failed', err.message || err);
      schedulePrank(sock, chatId, config);
    }
  }, nextDelay);

  prankTimers.set(chatId, { timer, intervalMs: state.intervalMs });
}

function restorePranks(sock) {
  try {
    const data = loadUserGroupData();
    const chats = Object.keys(data?.prank || {});
    chats.forEach((chatId) => {
      const state = getPrankState(data, chatId);
      if (state.enabled && state.intervalMs) {
        schedulePrank(sock, chatId, {});
      }
    });
  } catch (err) {
    console.error('[prank] restorePranks failed', err.message || err);
  }
}

restorePranks({ sendMessage: () => Promise.resolve() });

module.exports = {
  command: ['prank'],
  category: 'group',
  description: 'Toggle random group pranks and set their interval',
  groupOnly: true,
  adminOnly: true,

  async execute(sock, m, args, config) {
    const chat = m.chat;
    if (!chat || !chat.endsWith('@g.us')) {
      return sock.sendMessage(chat || m.key?.remoteJid, {
        text: '❌ This command can only be used in groups.'
      }, { quoted: m });
    }

    const rawText = (m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '').trim();
    const prefix = config?.prefix || '.';
    const text = rawText.startsWith(prefix) ? rawText.slice(prefix.length) : rawText;
    const tokens = text.split(/\s+/).filter(Boolean);
    const subCommand = (tokens[1] || '').toLowerCase();
    const remainder = tokens.slice(2).join(' ').trim();

    const senderRaw = m.key?.participant || m.key?.remoteJid || m.sender || '';
    const sender = senderRaw.toString();
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chat, sender);

    if (!isSenderAdmin) {
      return sock.sendMessage(chat, {
        text: '❌ Only group admins can control prank mode.'
      }, { quoted: m });
    }

    if (!isBotAdmin) {
      return sock.sendMessage(chat, {
        text: '❌ I need to be an admin to run prank events properly.'
      }, { quoted: m });
    }

    const data = loadUserGroupData();
    const state = getPrankState(data, chat);

    if (!subCommand || subCommand === 'status') {
      return sock.sendMessage(chat, {
        text: `🎭 *Group Pranks*\n\nStatus: ${state.enabled ? '✅ ON' : '❌ OFF'}\nInterval: ${formatInterval(state.intervalMs)}\nLast prank: ${state.lastPrankAt ? new Date(state.lastPrankAt).toLocaleString() : 'Never'}\n\nCommands:\n• .prank on\n• .prank off\n• .prank interval 10s / 7m / 23h / 48h\n• .prank now\n• .prank help`
      }, { quoted: m });
    }

    if (subCommand === 'help') {
      return sock.sendMessage(chat, {
        text: '🎭 *Prank System Help*\n\n• .prank on — enable random group pranks\n• .prank off — disable prank mode\n• .prank interval 10s / 7m / 23h / 48h — set the delay between pranks\n• .prank now — trigger a prank instantly\n• .prank status — show current config'
      }, { quoted: m });
    }

    if (subCommand === 'on') {
      setPrankState(data, chat, {
        enabled: true,
        intervalMs: state.intervalMs || 900000,
        lastPrankAt: state.lastPrankAt || 0,
        lastMessage: state.lastMessage || ''
      });
      saveUserGroupData(data);
      schedulePrank(sock, chat, config);
      return sock.sendMessage(chat, {
        text: `✅ Prank mode enabled. Random pranks will fire every ${formatInterval(state.intervalMs || 900000)}.`
      }, { quoted: m });
    }

    if (subCommand === 'off') {
      clearTimer(chat);
      setPrankState(data, chat, {
        enabled: false,
        intervalMs: state.intervalMs || 900000,
        lastPrankAt: state.lastPrankAt || 0,
        lastMessage: state.lastMessage || ''
      });
      saveUserGroupData(data);
      return sock.sendMessage(chat, {
        text: '🛑 Prank mode disabled. No more random group pranks will be sent.'
      }, { quoted: m });
    }

    if (subCommand === 'interval') {
      const parsed = parseInterval(remainder);
      if (!parsed) {
        return sock.sendMessage(chat, {
          text: '⚠️ Usage: .prank interval 10s / 7m / 23h / 48h'
        }, { quoted: m });
      }
      setPrankState(data, chat, {
        enabled: state.enabled,
        intervalMs: parsed,
        lastPrankAt: state.lastPrankAt || 0,
        lastMessage: state.lastMessage || ''
      });
      saveUserGroupData(data);
      if (state.enabled) schedulePrank(sock, chat, config);
      return sock.sendMessage(chat, {
        text: `✅ Prank interval updated to ${formatInterval(parsed)}.`
      }, { quoted: m });
    }

    if (subCommand === 'now') {
      const prank = getRandomPrank();
      setPrankState(data, chat, {
        enabled: state.enabled,
        intervalMs: state.intervalMs || 900000,
        lastPrankAt: Date.now(),
        lastMessage: prank.id
      });
      saveUserGroupData(data);
      if (state.enabled) schedulePrank(sock, chat, config);
      return sock.sendMessage(chat, {
        text: `🎭 *Instant Prank* 🎭\n\n${prank.text}`
      }, { quoted: m });
    }

    return sock.sendMessage(chat, {
      text: '⚠️ Unknown prank option. Try .prank help.'
    }, { quoted: m });
  }
};
