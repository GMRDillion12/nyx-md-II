const fs = require('fs');
const path = require('path');
const { getGroupSettings, updateGroupSettings, loadUserGroupData } = require('./database');

const logsDir = path.join(__dirname, '..', 'logs');
const logPath = path.join(logsDir, 'autoapprove.json');

const defaultLogData = {
  events: []
};

function ensureLogFile() {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, JSON.stringify(defaultLogData, null, 2), 'utf8');
}

function loadLogData() {
  ensureLogFile();
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch (error) {
    saveLogData(defaultLogData);
    return { ...defaultLogData };
  }
}

function saveLogData(data) {
  ensureLogFile();
  fs.writeFileSync(logPath, JSON.stringify(data, null, 2), 'utf8');
}

function appendLog(entry) {
  const data = loadLogData();
  data.events.push({ timestamp: new Date().toISOString(), ...entry });
  if (data.events.length > 250) data.events.splice(0, data.events.length - 250);
  saveLogData(data);
}

function normalizeUserJid(jid) {
  if (!jid) return '';
  const raw = String(jid).split(':')[0].trim();
  return raw.includes('@') ? raw : `${raw}@s.whatsapp.net`;
}

function isAutoApproveEnabled(chat) {
  const settings = getGroupSettings(chat);
  return !!settings?.autoApprove;
}

function setAutoApproveStatus(chat, enabled) {
  const result = updateGroupSettings(chat, { autoApprove: enabled });
  appendLog({ type: 'setting', chat, enabled });
  return result;
}

async function getPendingRequests(sock, chat) {
  let pending = [];
  if (typeof sock.groupRequestParticipantsList === 'function') {
    try {
      const requests = await sock.groupRequestParticipantsList(chat);
      if (Array.isArray(requests) && requests.length) {
        pending = requests.map(req => req?.jid || req?.id || req?.attrs?.jid || req).filter(Boolean);
      }
    } catch (err) {
      appendLog({ type: 'error', chat, step: 'groupRequestParticipantsList', message: err?.message || String(err) });
    }
  }

  if (pending.length === 0) {
    try {
      const metadata = await sock.groupMetadata(chat);
      pending = metadata.pendingParticipants || metadata.pendingRequests || metadata.joinRequests || metadata.requests || [];
      if ((!pending || pending.length === 0) && Array.isArray(metadata.participants)) {
        pending = metadata.participants
          .filter(p => p && (p.isPending || p.pending || p.isInvite || p.requested))
          .map(p => p.id || p.jid || p);
      }
    } catch (err) {
      appendLog({ type: 'error', chat, step: 'groupMetadata', message: err?.message || String(err) });
    }
  }

  return Array.from(new Set(pending
    .map(p => (typeof p === 'string' ? p : (p.id || p.jid || p)))
    .filter(Boolean)
    .map(normalizeUserJid)
    .filter(Boolean)));
}

async function approveParticipants(sock, chat, participants) {
  let accepted = 0;
  let failed = 0;

  const ids = Array.from(new Set(participants
    .map(p => (typeof p === 'string' ? p : (p.id || p.jid || p)))
    .filter(Boolean)
    .map(normalizeUserJid)
    .filter(Boolean)));

  if (ids.length === 0) {
    return { accepted, failed };
  }

  if (typeof sock.groupRequestParticipantsUpdate === 'function') {
    try {
      const results = await sock.groupRequestParticipantsUpdate(chat, ids, 'approve');
      if (Array.isArray(results) && results.length) {
        results.forEach(r => {
          const status = String(r?.status || '');
          if (status.startsWith('2')) accepted += 1;
          else failed += 1;
        });
      } else {
        accepted = ids.length;
      }
    } catch (err) {
      appendLog({ type: 'error', chat, step: 'groupRequestParticipantsUpdate', message: err?.message || String(err) });
      failed = ids.length;
    }
  }

  if (accepted === 0 && failed === ids.length) {
    const candidates = [
      'groupApproveJoinRequest',
      'groupAcceptJoinRequest',
      'groupApprove',
      'groupAcceptInvite',
      'groupAdd',
      'groupAddParticipants',
      'groupApproveParticipant'
    ];

    for (const participant of ids) {
      let resolved = false;
      for (const fn of candidates) {
        if (typeof sock[fn] !== 'function') continue;
        try {
          await sock[fn](chat, participant);
          resolved = true;
          break;
        } catch (e1) {
          try {
            await sock[fn](participant, chat);
            resolved = true;
            break;
          } catch (e2) {
            try {
              await sock[fn]({ groupJid: chat, participant });
              resolved = true;
              break;
            } catch (e3) {
              continue;
            }
          }
        }
      }
      if (resolved) accepted += 1;
      else failed += 1;
    }
  }

  appendLog({ type: 'approve', chat, participants: ids, accepted, failed });
  return { accepted, failed };
}

async function processExistingRequests(sock, chat) {
  const pending = await getPendingRequests(sock, chat);
  if (pending.length === 0) return { accepted: 0, failed: 0, pending: 0 };
  const result = await approveParticipants(sock, chat, pending);
  return { ...result, pending: pending.length };
}

async function processJoinRequestEvent(sock, update) {
  if (!update || !update.id || !update.participant) return { accepted: 0, failed: 1 };
  const chat = update.id;
  if (!isAutoApproveEnabled(chat)) return { accepted: 0, failed: 0 };

  const participant = normalizeUserJid(update.participant || update.participantPn);
  if (!participant) return { accepted: 0, failed: 1 };

  const result = await approveParticipants(sock, chat, [participant]);
  appendLog({
    type: 'join-request',
    chat,
    participant,
    action: update.action,
    method: update.method,
    accepted: result.accepted,
    failed: result.failed
  });

  return result;
}

async function initAutoApprove(sock) {
  ensureLogFile();

  if (!sock || typeof sock.ev?.on !== 'function') return;
  if (sock._autoApproveInitialized) return;
  sock._autoApproveInitialized = true;

  sock.ev.on('group.join-request', async (update) => {
    try {
      await processJoinRequestEvent(sock, update);
    } catch (err) {
      console.error('[autoapprove] group.join-request handler error:', err?.message || err);
      appendLog({ type: 'error', chat: update?.id, message: err?.message || String(err) });
    }
  });

  try {
    const data = loadUserGroupData();
    const groups = Object.keys(data.groupSettings || {}).filter(g => getGroupSettings(g)?.autoApprove);
    for (const chat of groups) {
      await processExistingRequests(sock, chat);
    }
  } catch (err) {
    console.error('[autoapprove] startup scan error:', err?.message || err);
  }
}

module.exports = {
  initAutoApprove,
  isAutoApproveEnabled,
  setAutoApproveStatus,
  processExistingRequests
};
