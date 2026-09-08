const RANKS = [
  { name: 'Bronze', emoji: '🥉', min: 0, max: 1499 },
  { name: 'Silver', emoji: '🥈', min: 1500, max: 1999 },
  { name: 'Gold', emoji: '🥇', min: 2000, max: 2499 },
  { name: 'Platinum', emoji: '💎', min: 2500, max: 2999 },
  { name: 'Elite', emoji: '🔥', min: 3000, max: 3499 },
  { name: 'Diamond', emoji: '💠', min: 3500, max: 3999 },
  { name: 'Heroic', emoji: '🛡️', min: 4000, max: 4499 },
  { name: 'Master', emoji: '🎖️', min: 4500, max: 4999 },
  { name: 'Grandmaster', emoji: '🏅', min: 5000, max: 5499 },
  { name: 'Legend', emoji: '👑', min: 5500, max: 5999 },
  { name: 'Champion', emoji: '🏆', min: 6000, max: 6499 },
  { name: 'Celestial', emoji: '✨', min: 6500, max: Infinity }
];

function getRankFromRating(rating) {
  const r = RANKS.find(rk => rating >= rk.min && rating <= rk.max) || RANKS[0];
  return r;
}

module.exports = { RANKS, getRankFromRating };
