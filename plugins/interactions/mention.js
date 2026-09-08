const { formatMentionText, buildMentionJids, normalizeJid } = require('../../lib/mentions');

function mentionText(jid, sock = null, fallbackName = null) {
  return formatMentionText(jid, sock, fallbackName);
}

function mentionJid(jid) {
  return normalizeJid(jid);
}

function buildMentionList(jids) {
  return buildMentionJids(jids);
}

module.exports = {
  mentionText,
  mentionJid,
  buildMentionList,
  formatMentionText,
};