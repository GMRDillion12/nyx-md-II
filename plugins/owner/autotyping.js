const fs = require('fs');
const path = require('path');

// Data file lives in project-root /data
const configPath = path.join(__dirname, '..', '..', 'data', 'autotyping.json');

function ensureConfigFile() {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('[autotyping] ensureConfigFile error:', e?.message || e);
  }
}

function loadConfig() {
  ensureConfigFile();
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.error('[autotyping] loadConfig error:', e?.message || e);
    return { enabled: false };
  }
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[autotyping] saveConfig error:', e?.message || e);
    return false;
  }
}

async function autotypingCommand(sock, m, args) {
  const chat = m.chat || m.key?.remoteJid;
  const cfg = loadConfig();

  // support: .autotyping on/off/status or toggle
  const action = Array.isArray(args) && args[0] ? args[0].toString().toLowerCase() : null;
  if (action === 'status') {
    return sock.sendMessage(chat, { text: `🔎 Auto-typing is currently *${cfg.enabled ? 'ENABLED' : 'DISABLED'}*` }, { quoted: m });
  }

  if (action === 'on' || action === 'enable') cfg.enabled = true;
  else if (action === 'off' || action === 'disable') cfg.enabled = false;
  else if (!action) cfg.enabled = !cfg.enabled; // toggle
  else return sock.sendMessage(chat, { text: '❌ Invalid option. Use: .autotyping on|off|status' }, { quoted: m });

  saveConfig(cfg);
  return sock.sendMessage(chat, { text: `✅ Auto-typing has been ${cfg.enabled ? 'ENABLED' : 'DISABLED'}!` }, { quoted: m });
}

function isAutotypingEnabled() {
  try {
    const cfg = loadConfig();
    return Boolean(cfg.enabled);
  } catch (e) {
    console.error('[autotyping] isAutotypingEnabled error:', e?.message || e);
    return false;
  }
}

async function handleAutotypingForMessage(sock, chatId, userMessage) {
  try {
    if (!isAutotypingEnabled()) return false;
    if (!chatId || !sock) return false;

    // subscribe to presence updates (some servers ignore, safe to call)
    try { await sock.presenceSubscribe(chatId); } catch (e) {}

    // show available then composing
    try { await sock.sendPresenceUpdate('available', chatId); } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
    try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}

    const len = (userMessage || '').toString().length || 0;
    const typingDelay = Math.max(3000, Math.min(8000, len * 150));
    await new Promise(r => setTimeout(r, typingDelay));

    try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}
    await new Promise(r => setTimeout(r, 1500));
    try { await sock.sendPresenceUpdate('paused', chatId); } catch (e) {}
    return true;
  } catch (e) {
    console.error('[autotyping] handleAutotypingForMessage error:', e?.message || e);
    return false;
  }
}

async function handleAutotypingForCommand(sock, chatId) {
  try {
    if (!isAutotypingEnabled()) return false;
    if (!chatId || !sock) return false;
    try { await sock.presenceSubscribe(chatId); } catch (e) {}
    try { await sock.sendPresenceUpdate('available', chatId); } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
    try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));
    try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}
    await new Promise(r => setTimeout(r, 1500));
    try { await sock.sendPresenceUpdate('paused', chatId); } catch (e) {}
    return true;
  } catch (e) {
    console.error('[autotyping] handleAutotypingForCommand error:', e?.message || e);
    return false;
  }
}

async function showTypingAfterCommand(sock, chatId) {
  try {
    if (!isAutotypingEnabled()) return false;
    if (!chatId || !sock) return false;
    try { await sock.presenceSubscribe(chatId); } catch (e) {}
    try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
    try { await sock.sendPresenceUpdate('paused', chatId); } catch (e) {}
    return true;
  } catch (e) {
    console.error('[autotyping] showTypingAfterCommand error:', e?.message || e);
    return false;
  }
}

module.exports = {
  command: ['autotyping'],
  category: 'owner',
  ownerOnly: true,
  description: 'Toggle or show status for auto-typing indicators',
  usage: '.autotyping on|off|status',
  async execute(sock, m, args) {
    return autotypingCommandWrapper(sock, m, args);
  }
};

// Expose helper functions on the exported object as properties so other modules can require this file
function autotypingCommandWrapper(sock, m, args) {
  return autotypingCommand(sock, m, args);
}

// Attach helpers to module.exports (consumers can require this file and use these)
module.exports.autotypingCommand = autotypingCommand;
module.exports.isAutotypingEnabled = isAutotypingEnabled;
module.exports.handleAutotypingForMessage = handleAutotypingForMessage;
module.exports.handleAutotypingForCommand = handleAutotypingForCommand;
module.exports.showTypingAfterCommand = showTypingAfterCommand;
