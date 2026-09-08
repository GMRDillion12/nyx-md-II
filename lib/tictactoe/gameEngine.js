const BOARD_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const SYMBOLS = { X: "❌", O: "⭕" };
const WIN_PATTERNS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function createBoard() {
  return [...BOARD_EMOJIS];
}

function formatBoard(board) {
  return `${board[0]} | ${board[1]} | ${board[2]}\n${board[3]} | ${board[4]} | ${board[5]}\n${board[6]} | ${board[7]} | ${board[8]}`;
}

function isWinner(board, symbolEmoji) {
  return WIN_PATTERNS.some(([a, b, c]) => board[a] === symbolEmoji && board[b] === symbolEmoji && board[c] === symbolEmoji);
}

function isDraw(board) {
  return board.every(cell => cell === SYMBOLS.X || cell === SYMBOLS.O);
}

function validateMove(board, position) {
  if (typeof position !== 'number') return { valid: false, reason: 'invalid_position' };
  if (position < 1 || position > 9) return { valid: false, reason: 'out_of_range' };
  const idx = position - 1;
  if (board[idx] === SYMBOLS.X || board[idx] === SYMBOLS.O) return { valid: false, reason: 'occupied' };
  return { valid: true };
}

function getSymbolEmoji(symbol) {
  return symbol === 'X' ? SYMBOLS.X : symbol === 'O' ? SYMBOLS.O : '';
}

module.exports = {
  BOARD_EMOJIS,
  SYMBOLS,
  WIN_PATTERNS,
  createBoard,
  formatBoard,
  isWinner,
  isDraw,
  validateMove,
  getSymbolEmoji
};
