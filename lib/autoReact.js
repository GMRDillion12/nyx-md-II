const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'autoReact.json');
const defaultData = {
  enabled: false,
  mode: 'bot',
  groups: {}
};

function ensureDataFile() {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function normalizeGroupSettings(groups) {
  if (!groups || typeof groups !== 'object') return {};

  return Object.entries(groups).reduce((acc, [key, value]) => {
    if (!key) return acc;
    const enabled = typeof value?.enabled === 'boolean' ? value.enabled : false;
    const mode = value?.mode === 'all' ? 'all' : 'bot';
    acc[key] = { enabled, mode };
    return acc;
  }, {});
}

function normalizeSettings(data) {
  if (!data || typeof data !== 'object') return { ...defaultData };

  const enabled = typeof data.enabled === 'boolean' ? data.enabled : defaultData.enabled;
  const mode = data.mode === 'all' ? 'all' : 'bot';
  const groups = normalizeGroupSettings(data.groups || {});

  return { enabled, mode, groups };
}

function load() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw);
    return normalizeSettings(data);
  } catch (error) {
    console.error('[autoReact] Failed to load config, resetting:', error.message);
    save(defaultData);
    return { ...defaultData };
  }
}

function save(data) {
  try {
    const normalized = normalizeSettings(data);
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  } catch (error) {
    console.error('[autoReact] Failed to save config:', error.message);
    return null;
  }
}

function pickEmoji(mode) {
  if (mode === 'bot') return '⏳';
  const emojis = [
    '😂','🤣','😊','🙂','🙃','😍','🥰','😘','😗','😚','😙',
    '😋','😛','😜','😝','🤪','🤩','😎','🥳','🤗','🤝','👏',
    '🙌','👍','👋','🤙','✌️','🫡','✊','🤛','🤜','🖐️','✋',
    '👌','✍️','🤞','🫱','🤟','🫶','🙏','💪','🫠','😇','🥲',
    '😌','😉','😏','🤭','🤫','😶','😑','🙄','😤','😈','👻',
    '💀','☠️','👽','🤖','🎃','🧙‍♂️','🧛‍♀️','🧟‍♂️','🐶','🐱','🦄',
    '🐉','🐙','🦋','🐝','🐞','🪰','🦀','🐳','🐬','🦩','🦢',
    '🌸','🌺','🌻','🌼','🌷','🌹','🥀','🍀','🍁','🍂','🍃',
    '☀️','🌤️','⛅','🌧️','⛈️','🌩️','🌪️','🌈','❄️','⚡','🔥',
    '✨','💫','🌟','⭐','🌙','☄️','💥','🎆','🎇','🎉','🎊',
    '🎈','🎁','🥂','🍻','🍾','🍷','🍹','🍸','🍺','🍕','🍔',
    '🍟','🌮','🍣','🍜','🍱','🍩','🍪','🍫','🍰','🍦','🍭',
    '🍿','☕','🍵','🥤','🧋','🧃','🌮','🍜','🥟','🥨','🧀',
    '📣','📢','📯','🎤','🎧','🎵','🎶','🎼','🎹','🥁','🎷',
    '🎺','🎸','🎻','🪕','🪗','🎮','🕹️','📱','💻','🖥️','🧩',
    '🔔','💡','🧠','🛠️','⚙️','⚡','🚀','🛸','🪐','🌍','🌎',
    '🌏','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','💎','🧿','📌',
    '🧷','🔒','🔓','🧭','⏳','⌛','⏰','🕰️','📅','🗓️','📝',
    '💬','🗨️','🫢','🫣','🤭','🥺','😢','😭','😡','😠','😤',
    '🤬','😳','😱','😨','😰','😥','😓','😕','🤯','😵','🤪'
  ];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

async function processAutoReact(sock, m, text, config) {
  try {
    const settings = load();
    if (m.key?.fromMe) return;
    if (!m.chat || !m.key) return;

    const chatSettings = settings.groups?.[m.chat];
    const activeSettings = chatSettings || { enabled: settings.enabled, mode: settings.mode };

    if (!activeSettings.enabled) return;

    const shouldReact = activeSettings.mode === 'all' || (activeSettings.mode === 'bot' && text?.startsWith(config.prefix));
    if (!shouldReact) return;

    const emoji = pickEmoji(activeSettings.mode);
    await sock.sendMessage(m.chat, {
      react: {
        text: emoji,
        key: m.key
      }
    });
  } catch (error) {
    console.error('[autoReact] Reaction failed:', error.message);
  }
}

module.exports = {
  load,
  save,
  processAutoReact
};
