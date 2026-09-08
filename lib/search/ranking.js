const { normalizeQuery, tokenize, similarity, isValidHttpUrl, isPlaceholderImage } = require('./utils');

function getResolution(item) {
  const width = Number(item?.width || 0);
  const height = Number(item?.height || 0);
  return width * height;
}

function scoreItem(query, item, type = 'image') {
  const normalizedQuery = normalizeQuery(query).toLowerCase();
  const haystack = [item?.title, item?.description, item?.url, item?.imageUrl].filter(Boolean).join(' ').toLowerCase();
  const queryTokens = tokenize(normalizedQuery).filter(token => token.length > 2);
  const exactPhrase = normalizedQuery && haystack.includes(normalizedQuery) ? 220 : 0;
  const tokenOverlap = queryTokens.filter(token => haystack.includes(token)).length * 24;
  const phraseSimilarity = similarity(normalizedQuery, haystack) * 90;
  const titleSimilarity = similarity(normalizedQuery, String(item?.title || '')) * 70;

  let score = exactPhrase + tokenOverlap + phraseSimilarity + titleSimilarity;

  if (type === 'image') {
    score += Math.min(getResolution(item) / 200000, 40);
  }

  if (type === 'video') {
    score += Number(item?.duration ? 8 : 0);
  }

  if (type === 'question') {
    score += Number(item?.answer ? 30 : 0);
  }

  if (!isValidHttpUrl(item?.url)) {
    score -= 1000;
  }
  const candidateUrl = item?.url || item?.imageUrl;
  if (!isValidHttpUrl(candidateUrl)) {
    score -= 1000;
  }

  if (isPlaceholderImage(candidateUrl)) {
    score -= 600;
  }

  return score;
}

function rankResults(query, items, type = 'image') {
  const deduped = [];
  const seen = new Set();

  for (const item of items || []) {
    const candidateUrl = item?.url || item?.imageUrl;
    if (!candidateUrl) continue;
    const key = String(candidateUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      ...item,
      score: scoreItem(query, item, type)
    });
  }

  return deduped.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return getResolution(right) - getResolution(left);
  });
}

module.exports = {
  rankResults,
  scoreItem
};
