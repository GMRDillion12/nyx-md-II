const { normalizeQuery } = require('./utils');

const ENTITY_PATTERNS = [
  /^(?:who is|who was|who are|who were|tell me about|tell me about|what is|what are|where is|when was|when did|which is|show me|search for|find information about|find out about)\s+(.+)$/i,
  /^(?:define|explain|describe|information about)\s+(.+)$/i
];

function cleanEntity(raw) {
  if (!raw) return null;
  const trimmed = normalizeQuery(raw)
    .replace(/\?+$/, '')
    .replace(/^about\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/\b(?:wallpaper|wallpapers|background|photo|photos|image|images|pic|pics|picture|pictures|hd|4k)\b\s*$/i, '')
    .trim();
  return trimmed || null;
}

// Returns { entity, confidence }
function detectEntity(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return { entity: null, confidence: 0 };

  for (const pattern of ENTITY_PATTERNS) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return { entity: cleanEntity(match[1]), confidence: 0.95 };
    }
  }

  const lower = normalized.toLowerCase();
  const questionPrefix = /^(who|what|where|when|why|how|is|are|does|do|did|can|could|should|would|will|tell|show|search|find)\b/i;
  const containsQuestionWord = questionPrefix.test(lower);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (!containsQuestionWord && words.length <= 6) {
    return { entity: cleanEntity(normalized), confidence: 0.7 };
  }

  if (/\b(who is|who was|who are|where is|when was|what is|what are|tell me about|search for|find)\b/i.test(lower)) {
    const entityCandidate = normalized
      .replace(/^(who is|who was|who are|where is|when was|what is|what are|tell me about|search for|find)\s+/i, '')
      .trim();
    return { entity: cleanEntity(entityCandidate), confidence: 0.9 };
  }

  return { entity: null, confidence: 0 };
}

function isEntityQuery(query, minConfidence = 0.75) {
  const detected = detectEntity(query);
  return Boolean(detected.entity) && Number(detected.confidence || 0) >= Number(minConfidence);
}

module.exports = {
  detectEntity,
  isEntityQuery
};
