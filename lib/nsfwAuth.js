const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractPhoneNumber } = require('./isOwner');

const DATA_PATH = path.join(__dirname, '..', 'data', 'nsfw_auth.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    const initialData = {
      password: 'princevegeta!',
      passwordHash: crypto.createHash('sha256').update('princevegeta!').digest('hex'),
      registered: {}
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8') || '{}';
    const parsed = JSON.parse(raw);
    if (!parsed.password) parsed.password = 'princevegeta!';
    if (!parsed.passwordHash) parsed.passwordHash = crypto.createHash('sha256').update(parsed.password).digest('hex');
    if (!parsed.registered) parsed.registered = {};
    return parsed;
  } catch (e) {
    const fallbackData = {
      password: 'princevegeta!',
      passwordHash: crypto.createHash('sha256').update('princevegeta!').digest('hex'),
      registered: {}
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(fallbackData, null, 2), 'utf8');
    return fallbackData;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(plain) {
  return crypto.createHash('sha256').update(String(plain || '')).digest('hex');
}

function normalizeJid(jid) {
  if (!jid) return '';
  const raw = String(jid).trim();
  const withoutDevice = raw.split(':')[0].trim();
  const digits = withoutDevice.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function buildJidCandidates(jids) {
  const values = Array.isArray(jids) ? jids : [jids];
  const candidates = new Set();

  for (const jid of values) {
    if (!jid) continue;
    const raw = String(jid).trim();
    const normalized = normalizeJid(raw);
    if (normalized) {
      candidates.add(normalized);
      candidates.add(raw);
    }
  }

  return [...candidates].filter(Boolean);
}

function isOwnerMatch(senderJid, ownerJids = []) {
  const senderNorm = normalizeJid(senderJid || '');
  const senderPhone = extractPhoneNumber(senderJid || '');
  if (!senderNorm && !senderPhone) return false;

  return (ownerJids || []).some(owner => {
    const ownerNorm = normalizeJid(owner || '');
    const ownerPhone = extractPhoneNumber(owner || '');
    return Boolean(
      (senderNorm && ownerNorm && senderNorm === ownerNorm) ||
      (senderPhone && ownerPhone && senderPhone === ownerPhone)
    );
  });
}

// Public API
const nsfwAuth = {
  init() {
    this._data = ensureDataFile();
  },

  getPassword() {
    if (!this._data) this.init();
    return this._data.password;
  },

  getPasswordHash() {
    if (!this._data) this.init();
    return this._data.passwordHash;
  },

  async isRegistered(jid) {
    if (!this._data) this.init();
    const candidates = buildJidCandidates(jid);
    return candidates.some(norm => Boolean(this._data.registered && this._data.registered[norm]));
  },

  async register(jid, plainPassword) {
    if (!this._data) this.init();
    const attemptHash = hashPassword(plainPassword);
    const ok = attemptHash === this._data.passwordHash;
    const norm = normalizeJid(jid);
    if (ok) {
      this._data.registered = this._data.registered || {};
      this._data.registered[norm] = { at: new Date().toISOString() };
      saveData(this._data);
    }
    return ok;
  },

  async unregister(jid) {
    if (!this._data) this.init();
    const norm = normalizeJid(jid);
    if (this._data.registered && this._data.registered[norm]) {
      delete this._data.registered[norm];
      saveData(this._data);
      return true;
    }
    return false;
  },

  getRegisteredUsers() {
    if (!this._data) this.init();
    return Object.keys(this._data.registered || {});
  },

  async changePassword(newPlain) {
    if (!this._data) this.init();
    const newHash = hashPassword(newPlain);
    this._data.password = String(newPlain);
    this._data.passwordHash = newHash;
    // invalidate registrations
    this._data.registered = {};
    saveData(this._data);
  },

  // Helper to verify access; ownerBypass boolean true => allow
  async ensureAccess({ senderJid, senderJids = null, isOwnerBypass = false, sock = null, m = null, ownerJids = [] }) {
    if (!this._data) this.init();
    const candidates = senderJids ? buildJidCandidates(senderJids) : buildJidCandidates(senderJid);
    const registeredMatches = candidates.filter(norm => Boolean(this._data.registered && this._data.registered[norm]));
    const hasRegistered = registeredMatches.length > 0;
    const hasOwnerAccess = isOwnerBypass || candidates.some(candidate => isOwnerMatch(candidate, ownerJids));

    console.log('[nsfwAuth] NSFW access check', {
      senderJid,
      senderJids,
      candidates,
      hasRegistered,
      registeredMatches,
      hasOwnerAccess,
      isOwnerBypass,
      ownerJids
    });

    if (hasOwnerAccess) return true;
    if (!candidates.length) return false;
    if (hasRegistered) return true;

    const norm = candidates[0];
    if (!norm) return false;

    // Not registered: prompt user to register and notify owner(s)
    try {
      const chat = m?.chat || m?.key?.remoteJid || norm;
      const prompt = '🔞 This command requires NSFW access. Register with: .npass register <password>';
      await sock.sendMessage(chat, { text: prompt }, { quoted: m });

      // notify owners about attempted access (include attempted password if available in message text)
      const attemptText = (m?.text || m?.message?.conversation || m?.message?.extendedTextMessage?.text || '') || '';
      const attemptedPassword = (attemptText.match(/register\s+(\S+)/i) || [])[1] || null;
      const ownerMessage = `🔔 NSFW access attempt\nUser: ${norm}\nChat: ${chat}\nCommand: ${m?.text || ''}\nAttempted password: ${attemptedPassword || '<none>'}`;

      for (const o of ownerJids || []) {
        const oj = normalizeJid(o);
        if (!oj) continue;
        try { await sock.sendMessage(oj, { text: ownerMessage }); } catch (e) {}
      }
    } catch (e) {
      // swallow
    }

    return false;
  }
};

nsfwAuth.init();
module.exports = nsfwAuth;
