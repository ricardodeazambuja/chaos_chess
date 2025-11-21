/**
 * Transposition Table - caches previously evaluated positions.
 *
 * In chess, the same position can be reached through different move orders.
 * Instead of re-evaluating identical positions, we store results in a hash table.
 *
 * Example transposition:
 * - Path A: e4, e5, Nf3, Nc6
 * - Path B: Nf3, Nc6, e4, e5
 * - Result: Same position, but reached differently
 *
 * Benefits:
 * - Reduces search time by 30-50% in typical positions
 * - Enables deeper search at the same speed
 * - Particularly effective in opening and endgame
 *
 * Limitations:
 * - Simple hashing (not Zobrist hashing for now)
 * - Fixed table size (no sophisticated replacement policy yet)
 */

export type ScoreFlag = 'EXACT' | 'ALPHA' | 'BETA';

export interface TranspositionEntry {
  zobristHash: string;  // Hash of the position
  depth: number;        // Search depth at which this was evaluated
  score: number;        // Evaluation score
  flag: ScoreFlag;      // Type of score (exact, upper bound, lower bound)
  bestMove?: string;    // Best move found (format: "e2e4")
}

export class TranspositionTable {
  private table: Map<string, TranspositionEntry>;
  private maxSize: number;
  private hits: number = 0;
  private probes: number = 0;

  constructor(maxSizeMB: number = 16) {
    this.table = new Map();
    // Rough estimate: 100 bytes per entry, so 16MB ≈ 160k entries
    this.maxSize = (maxSizeMB * 1024 * 1024) / 100;
  }

  /**
   * Generate a simple hash of the board position.
   *
   * Note: This is a simplified version using JSON serialization.
   * A production implementation would use Zobrist hashing for better performance.
   *
   * Zobrist hashing uses pre-computed random numbers for each piece on each square,
   * allowing O(1) hash updates when pieces move.
   *
   * @param board The current board state
   * @param currentColor The player to move
   * @returns Hash string representing the position
   */
  private hashPosition(
    board: (any | null)[][],
    currentColor: 'white' | 'black'
  ): string {
    let hash = currentColor === 'white' ? 'W:' : 'B:';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          // Format: "type-color-position"
          // Example: "pw01" = white pawn at row 0, col 1
          hash += `${piece.type[0]}${piece.color[0]}${row}${col},`;
        }
      }
    }

    return hash;
  }

  /**
   * Store a position evaluation in the table.
   *
   * @param board Current board state
   * @param currentColor Player to move
   * @param depth Search depth
   * @param score Evaluation score
   * @param flag Score type (EXACT, ALPHA, or BETA)
   * @param bestMove Best move found (optional, for move ordering)
   */
  store(
    board: (any | null)[][],
    currentColor: 'white' | 'black',
    depth: number,
    score: number,
    flag: ScoreFlag,
    bestMove?: string
  ): void {
    const hash = this.hashPosition(board, currentColor);

    // Evict old entries if table is full
    // Simple FIFO replacement policy (first in, first out)
    // TODO: Consider more sophisticated replacement (e.g., always replace lower depth)
    if (this.table.size >= this.maxSize) {
      const firstKey = this.table.keys().next().value;
      if (firstKey) {
        this.table.delete(firstKey);
      }
    }

    // Store the entry
    this.table.set(hash, {
      zobristHash: hash,
      depth,
      score,
      flag,
      bestMove
    });
  }

  /**
   * Retrieve a stored position evaluation.
   *
   * Returns the score if:
   * - Position exists in table
   * - Stored depth >= current search depth (deeper search is more accurate)
   * - Score is usable for current alpha-beta window
   *
   * @param board Current board state
   * @param currentColor Player to move
   * @param depth Current search depth
   * @param alpha Current alpha value
   * @param beta Current beta value
   * @returns Score if usable, null otherwise
   */
  probe(
    board: (any | null)[][],
    currentColor: 'white' | 'black',
    depth: number,
    alpha: number,
    beta: number
  ): number | null {
    this.probes++;

    const hash = this.hashPosition(board, currentColor);
    const entry = this.table.get(hash);

    if (!entry) {
      return null;  // Position not in table
    }

    // Only use if stored depth is >= current search depth
    // A position searched at depth 5 is more accurate than depth 3
    if (entry.depth < depth) {
      return null;
    }

    this.hits++;

    // Return score based on flag type
    switch (entry.flag) {
      case 'EXACT':
        // Exact score - always usable
        return entry.score;

      case 'ALPHA':
        // Fail-low (upper bound): score <= alpha
        // Only usable if it's <= current alpha
        if (entry.score <= alpha) {
          return alpha;
        }
        break;

      case 'BETA':
        // Fail-high (lower bound): score >= beta
        // Only usable if it's >= current beta
        if (entry.score >= beta) {
          return beta;
        }
        break;
    }

    return null;
  }

  /**
   * Clear the table (e.g., when starting a new game).
   */
  clear(): void {
    this.table.clear();
    this.hits = 0;
    this.probes = 0;
  }

  /**
   * Get table statistics.
   *
   * @returns Object with size, max size, and hit rate
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    const hitRate = this.probes > 0 ? (this.hits / this.probes) * 100 : 0;
    return {
      size: this.table.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 10) / 10 // Round to 1 decimal
    };
  }
}

// Global transposition table instance (16MB)
export const transpositionTable = new TranspositionTable(16);
