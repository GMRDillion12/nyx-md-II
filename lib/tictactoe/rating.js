const { randomInt } = require('./utils');

/**
 * Calculate rating change for win/loss outcomes.
 * - win => positive gain (100..150)
 * - loss => negative loss (-30..-80)
 * Keep these ranges as before so existing behavior remains familiar.
 */
function calculateRatingChange(playerRating, opponentRating, result, kFactor = 32) {
  const ratingA = Number(playerRating) || 1000;
  const ratingB = Number(opponentRating) || 1000;
  const expectedScore = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

  if (result === 1) {
    return Math.round(kFactor * (1 - expectedScore));
  }
  if (result === 0) {
    return Math.round(kFactor * (0 - expectedScore));
  }
  return 0;
}

/**
 * Calculate a symmetric rating delta for a draw.
 * This returns a positive value which should be added to both players' ratings.
 */
function calculateDrawDelta(playerRatingA, playerRatingB) {
  const a = Number(playerRatingA) || 1000;
  const b = Number(playerRatingB) || 1000;
  const gap = Math.abs(a - b);
  return Math.max(5, Math.min(20, 10 + Math.round(gap / 200)));
}

module.exports = { calculateRatingChange, calculateDrawDelta };
