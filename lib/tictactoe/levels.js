function getXPRequiredForNextLevel(level) {
  // nextLevelXP(level) = 100 + ((level - 1) * 50) + (((level - 1) ** 2) * 5)
  if (level < 1) level = 1;
  return 100 + ((level - 1) * 50) + (((level - 1) ** 2) * 5);
}

function getLevelFromXP(totalXP) {
  let level = 1;
  let xp = totalXP || 0;
  while (true) {
    const need = getXPRequiredForNextLevel(level);
    if (xp < need) break;
    xp -= need;
    level += 1;
    // safety
    if (level > 10000) break;
  }
  return level;
}

function getLevelProgress(totalXP) {
  const level = getLevelFromXP(totalXP);
  const spent = (() => {
    let s = 0;
    for (let l = 1; l < level; l++) s += getXPRequiredForNextLevel(l);
    return s;
  })();
  const currentLevelXP = totalXP - spent;
  const next = getXPRequiredForNextLevel(level);
  return { level, currentLevelXP, nextLevelXP: next, progress: currentLevelXP / next };
}

module.exports = { getXPRequiredForNextLevel, getLevelFromXP, getLevelProgress };
