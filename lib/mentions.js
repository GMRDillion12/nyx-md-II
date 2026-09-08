const { proto } = require('@whiskeysockets/baileys');

function _safeStr(v) {
  if (!v && v !== 0) return '';
  return String(v).trim();
}

function normalizeJid(jid) {
  if (!jid) return '';
  let raw = _safeStr(jid);
  if (!raw) return '';

  raw = raw.split(':')[0].split('/')[0].trim();

  if (raw.includes('@')) return raw;
  if (/^\d{8,}$/.test(raw.replace(/[^0-9]/g, ''))) {
    return raw.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  }

  return '';
}

function getPhoneNumber(jid) {
  if (!jid) return null;
  const normalized = normalizeJid(jid);
  if (!normalized || normalized.includes('@lid')) return null;
  const id = normalized.split('@')[0] || '';
  const digits = String(id).replace(/[^0-9]/g, '');
  return digits.length >= 8 ? digits : null;
}

function normalizePhoneLocal(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function localMatches(a, b) {
  const aa = normalizePhoneLocal(a);
  const bb = normalizePhoneLocal(b);
  if (!aa || !bb) return false;
  return aa === bb;
}

// Note: phone/contact-id helpers removed. Mentions should rely on WhatsApp
// participant JIDs and server-side display names. Avoid synthesizing or
// deriving phone-based JIDs here.

function _findInMap(map, key) {
  if (!map || !key) return null;
  try {
    if (typeof map.get === 'function') return map.get(key) || null;
  } catch (e) {}
  return map[key] || null;
}

async function resolveParticipant(sock, jid, context = {}) {
  const original = jid || '';
  const normalized = normalizeJid(original);

  const res = {
    originalJid: original,
    pnJid: null,
    lidJid: null,
    mentionJid: null,
    phoneNumber: null,
    displayName: null,
    source: 'unknown'
  };

  if (!sock) {
    res.mentionJid = normalized || original || '';
    return res;
  }

  function acceptCandidate(candidate, src) {
    if (!candidate) return;
    const c = normalizeJid(candidate) || candidate;
    if (c && c.includes('@')) {
      res.pnJid = res.pnJid || c;
      res.mentionJid = res.mentionJid || c;
    }
    res.source = src || res.source;
  }

  const m = context.message || context.m || null;
  if (m && m.key) {
    ['participant', 'participantAlt', 'participantPn', 'senderPn', 'senderLid', 'remoteJidAlt'].forEach(k => {
      if (m.key[k]) acceptCandidate(m.key[k], `message.key.${k}`);
    });
    if (m.participant) acceptCandidate(m.participant, 'message.participant');
    if (m.sender) acceptCandidate(m.sender, 'message.sender');
  }

  const groupId = context.groupId || (m && m.key && m.key.remoteJid) || null;
  if (groupId && typeof sock.groupMetadata === 'function') {
    try {
      const gm = await sock.groupMetadata(groupId).catch(() => null);
      if (gm && Array.isArray(gm.participants)) {
        const srcValue = original || normalized || '';
        const found = gm.participants.find((p) => {
          const pid = p.id || p.jid || p.participant || '';
          if (!pid) return false;
          if (pid === original || pid === normalized || pid === srcValue) return true;
          if (localMatches(pid, srcValue)) return true;
          if (localMatches(p.phoneNumber, srcValue)) return true;
          if (localMatches(p.wid, srcValue)) return true;
          const localPid = normalizePhoneLocal(pid.split('@')[0]);
          const localSource = normalizePhoneLocal(srcValue.split('@')[0]);
          if (localPid && localSource && localPid === localSource) return true;
          return false;
        });

        if (found) {
          const candidate = found.id || found.jid || found.participant || null;
          acceptCandidate(candidate, 'group.metadata');
          res.displayName = found.notify || found.name || found.pushName || found.displayName || found.vname || found.verifiedName || found.username || null;
          if (sock.user && candidate && normalizeJid(sock.user.id || sock.user.jid) === normalizeJid(candidate)) {
            res.displayName = 'You';
          }
        }
      }
    } catch (e) {}
  }

  const selfId = normalizeJid(sock.user?.id || sock.user?.jid || '');
  const selfLocal = selfId ? selfId.split('@')[0] : '';
  if (selfId && (normalizeJid(original) === selfId || localMatches(original, selfId) || localMatches(jid, selfLocal) || (selfLocal && String(original).split('@')[0] === selfLocal))) {
    res.pnJid = selfId;
    res.mentionJid = selfId;
    res.displayName = 'You';
  }

  if (!res.pnJid && normalized) res.pnJid = normalized;
  if (!res.mentionJid) res.mentionJid = res.pnJid || normalized || original || '';

  return res;
}

async function resolveMentionJid(sock, jid, context = {}) {
  const r = await resolveParticipant(sock, jid, context);
  return r.mentionJid || r.pnJid || r.originalJid || '';
}

function normalizeMentionName(name) {
  if (!name) return null;
  let raw = _safeStr(name).replace(/^[@~]+/, '').replace(/\s+/g, ' ').trim();
  return raw || null;
}

async function getContactName(sock, jid, context = {}) {
  const resolved = await resolveParticipant(sock, jid, context);
  // Only return the displayName if available from group metadata or participant info
  if (resolved.displayName) return resolved.displayName;
  return null;
}

function getContactNameSync(sock, jid, context = {}) {
  // best-effort synchronous lookup from in-memory maps only
  // synchronous lookup removed: avoid relying on in-memory contact maps for display names
  return null;

}

function formatMentionText(jid, sock = null, fallbackName = null, context = {}) {
  const display = normalizeMentionName(fallbackName) || (sock ? (getContactNameSync(sock, jid, context) || '') : '') || '';
  if (display) return `@${display}`;
  const n = normalizeJid(jid) || jid || '';
  const short = (n && n.split && n.split('@')[0]) || '';
  return short ? `@${short}` : '';
}

function buildMentionJids(jids, sock = null, context = {}) {
  if (!Array.isArray(jids)) return [];
  const out = [];
  const seen = new Set();
  const contacts = sock?.store?.contacts || sock?.contacts || {};

  for (const jid of jids) {
    try {
      const raw = jid || '';
      let m = normalizeJid(raw) || raw;

      // If socket available, prefer the canonical contact id stored in the contact maps
      if (sock) {
        // direct contact lookup by normalized jid
        const contact = _findInMap(contacts, m) || _findInMap(contacts, raw);
        if (contact) {
          let cand = normalizeJid(contact.id || contact.jid || contact.key?.remoteJid) || normalizeJid(contact.contact) || null;
          // if contact canonical id is a lid, try to prefer a pn jid if phone/wid present
          if (cand && String(cand).endsWith('@lid')) {
            if (contact.phoneNumber) cand = `${String(contact.phoneNumber).replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            else if (contact.wid) cand = normalizeJid(contact.wid) || cand;
          }
          if (cand) m = cand;
        } else {
          // try to match by local part (phone) to find a stored contact key
          const local = (m && m.split) ? m.split('@')[0] : null;
          if (local) {
            for (const k of Object.keys(contacts || {})) {
              if (!k) continue;
              const kn = normalizeJid(k) || k;
              const knLocal = (kn && kn.split) ? kn.split('@')[0] : null;
              if (knLocal && knLocal === local) {
                m = kn;
                break;
              }
            }
            // if still not found and local looks numeric, try pn jid form
            if ((!m || !m.includes('@')) && /^\d+$/.test(local)) {
              m = `${local}@s.whatsapp.net`;
            }
          }
        }
        // if the jid corresponds to the current logged-in user, prefer sock.user id so client shows "You" tag
        try {
          const selfId = normalizeJid(sock.user?.id || sock.user?.jid || '');
          if (selfId) {
            const selfLocal = (selfId.split && selfId.split('@')[0]) || null;
            const local = (m && m.split) ? m.split('@')[0] : null;
            if (selfLocal && local && selfLocal === local) {
              m = selfId;
            }
          }
        } catch (e) {}
      }

      if (m && !seen.has(m)) {
        seen.add(m);
        out.push(m);
      }
    } catch (e) {
      // ignore malformed
    }
  }
  return out;
}

async function buildMentionPayload({ text = '', jids = [], sock = null, context = {} } = {}) {
  const mentions = buildMentionJids(jids, sock, context);
  return {
    text: String(text || '').trim(),
    mentions: mentions.length ? mentions : undefined
  };
}

async function buildMentionAllPayload({ text = '', sock = null, groupId = null } = {}) {
  const t = String(text || '').trim();
  // Baileys version in this project does not expose mentionAll in types, so fallback to explicit mentions list
  let participants = [];
  try {
    const gid = groupId || (sock && sock.currentChat) || null;
    if (gid && typeof sock.groupMetadata === 'function') {
      const gm = await sock.groupMetadata(gid).catch(() => null);
      if (gm && Array.isArray(gm.participants)) {
        participants = gm.participants.map(p => p.id || p.jid || p.participant).filter(Boolean);
      }
    }
  } catch (e) {}

  const mentions = buildMentionJids(participants, sock, { groupId });
  return {
    text: `@all ${t}`.trim(),
    mentions: mentions.length ? mentions : undefined,
    // do not set mentionAll because installed Baileys types do not include it; using explicit mentions as compatibility fallback
  };
}

async function buildTttMentions(jids = [], sock = null, chat = null) {
  if (!Array.isArray(jids)) return [];
  const out = [];
  const seen = new Set();

  for (const jid of jids) {
    try {
      if (!jid) continue;
      const likely = await resolveMentionJid(sock, jid, { groupId: chat }).catch(() => null);
      const candidate = normalizeJid(likely) || normalizeJid(jid) || '';
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        out.push(candidate);
      }
    } catch (e) {}
  }

  try {
    if (sock && sock.user) {
      const self = normalizeJid(sock.user.id || sock.user.jid || '');
      if (self && !seen.has(self)) {
        seen.add(self);
        out.push(self);
      }
    }
  } catch (e) {}

  return out.filter(Boolean);
}

module.exports = {
  normalizeJid,
  getPhoneNumber,
  normalizePhoneLocal,
  resolveParticipant,
  resolveMentionJid,
  getContactName,
  formatMentionText,
  buildMentionJids,
  buildMentionPayload,
  buildMentionAllPayload,
  buildTttMentions
};
