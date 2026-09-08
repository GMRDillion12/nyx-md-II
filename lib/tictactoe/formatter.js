function formatPlayerLine(player, stats, mentionText) {
  const level = stats.level || 1;
  const xp = stats.xp || 0;
  const rating = stats.rating || 1000;
  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const draws = stats.draws || 0;
  return `${mentionText}\nLevel ${level} • ${xp} XP\nRating ${rating}\n${wins}W • ${losses}L • ${draws}D`;
}

module.exports = { formatPlayerLine };
