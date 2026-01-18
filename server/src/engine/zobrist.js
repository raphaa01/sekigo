/**
 * Zobrist Hashing for Go Board States
 * 
 * Zobrist hashing allows efficient incremental hash updates when stones are placed/removed.
 * Used for Ko detection (positional superko).
 */

class ZobristHasher {
  constructor(boardSize) {
    this.boardSize = boardSize;
    this.table = this.generateTable();
  }

  /**
   * Generate random hash table
   * Each position has two entries: one for black, one for white
   * @returns {Array<Array<Array<bigint>>>} [y][x][color] -> hash value
   */
  generateTable() {
    const table = [];
    for (let y = 0; y < this.boardSize; y++) {
      table[y] = [];
      for (let x = 0; x < this.boardSize; x++) {
        table[y][x] = {
          black: this.randomBigInt(),
          white: this.randomBigInt()
        };
      }
    }
    return table;
  }

  /**
   * Generate random 64-bit integer
   * @returns {bigint}
   */
  randomBigInt() {
    // Generate random 64-bit integer
    const high = Math.floor(Math.random() * 0xFFFFFFFF);
    const low = Math.floor(Math.random() * 0xFFFFFFFF);
    return (BigInt(high) << 32n) | BigInt(low);
  }

  /**
   * Calculate hash for entire board
   * @param {Array<Array<string|null>>} board - Board state
   * @returns {bigint} Board hash
   */
  hashBoard(board) {
    let hash = 0n;
    for (let y = 0; y < this.boardSize; y++) {
      for (let x = 0; x < this.boardSize; x++) {
        const stone = board[y][x];
        if (stone === 'black') {
          hash ^= this.table[y][x].black;
        } else if (stone === 'white') {
          hash ^= this.table[y][x].white;
        }
      }
    }
    return hash;
  }

  /**
   * Update hash incrementally (XOR out old, XOR in new)
   * @param {bigint} currentHash - Current board hash
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string|null} oldColor - Previous color (null for empty)
   * @param {string|null} newColor - New color (null for empty)
   * @returns {bigint} Updated hash
   */
  updateHash(currentHash, x, y, oldColor, newColor) {
    let hash = currentHash;

    // Remove old stone
    if (oldColor === 'black') {
      hash ^= this.table[y][x].black;
    } else if (oldColor === 'white') {
      hash ^= this.table[y][x].white;
    }

    // Add new stone
    if (newColor === 'black') {
      hash ^= this.table[y][x].black;
    } else if (newColor === 'white') {
      hash ^= this.table[y][x].white;
    }

    return hash;
  }

  /**
   * Convert hash to string for storage
   * @param {bigint} hash - Hash value
   * @returns {string} String representation
   */
  hashToString(hash) {
    return hash.toString(16);
  }

  /**
   * Parse hash from string
   * @param {string} hashStr - String representation
   * @returns {bigint} Hash value
   */
  hashFromString(hashStr) {
    return BigInt('0x' + hashStr);
  }
}

export default ZobristHasher;
