const { randomInt } = require('./utils');

const XP_CONFIG = {
  winnerMin: 50,
  winnerMax: 70,
  loserMin: 20,
  loserMax: 40,
  drawMin: 25,
  drawMax: 25
};

function xpForWin() {
  return randomInt(XP_CONFIG.winnerMin, XP_CONFIG.winnerMax);
}

function xpForLoss() {
  return randomInt(XP_CONFIG.loserMin, XP_CONFIG.loserMax);
}

function xpForDraw() {
  return randomInt(XP_CONFIG.drawMin, XP_CONFIG.drawMax);
}

module.exports = { XP_CONFIG, xpForWin, xpForLoss, xpForDraw };
