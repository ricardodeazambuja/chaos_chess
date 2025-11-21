/**
 * Opening Book - provides varied opening moves for the AI.
 *
 * Instead of always playing the same opening, the AI can choose from a repertoire
 * of proven opening moves. This adds variety and makes the AI less predictable.
 *
 * The book contains popular opening moves for both White and Black, weighted
 * by their frequency in master-level games.
 */

import type { Move } from '../chess-logic';

export interface OpeningMove {
  from: string;
  to: string;
  name?: string;  // Optional opening name for logging
}

interface BookEntry {
  position: string;       // Position identifier
  moves: OpeningMove[];   // Possible moves
  weights?: number[];     // Optional weights for each move (higher = more likely)
}

/**
 * Opening book database.
 *
 * Key: Position identifier (e.g., "start", "e2e4", etc.)
 * Value: Array of possible continuation moves with weights
 */
const OPENING_BOOK: Record<string, BookEntry> = {
  // ========== WHITE'S FIRST MOVE (Position 1) ==========
  'start': {
    position: 'start',
    moves: [
      { from: 'e2', to: 'e4', name: "King's Pawn" },       // Most popular
      { from: 'd2', to: 'd4', name: "Queen's Pawn" },      // Second most popular
      { from: 'c2', to: 'c4', name: 'English Opening' },   // Flexible system
      { from: 'g1', to: 'f3', name: 'Reti Opening' },      // Hypermodern
      { from: 'f2', to: 'f4', name: "From's Gambit" },     // Aggressive
    ],
    weights: [40, 30, 15, 10, 5]  // Weighted by popularity
  },

  // ========== BLACK'S RESPONSE TO 1.e4 ==========
  'e2e4': {
    position: 'after_1_e4',
    moves: [
      { from: 'e7', to: 'e5', name: 'Open Game' },         // Classical
      { from: 'c7', to: 'c5', name: 'Sicilian Defense' },  // Most fighting
      { from: 'e7', to: 'e6', name: 'French Defense' },    // Solid
      { from: 'c7', to: 'c6', name: 'Caro-Kann Defense' }, // Solid
      { from: 'g7', to: 'g6', name: 'Modern Defense' },    // Hypermodern
    ],
    weights: [25, 35, 20, 15, 5]
  },

  // ========== BLACK'S RESPONSE TO 1.d4 ==========
  'd2d4': {
    position: 'after_1_d4',
    moves: [
      { from: 'd7', to: 'd5', name: "Queen's Gambit" },    // Symmetrical
      { from: 'g8', to: 'f6', name: 'Indian Defenses' },   // Popular
      { from: 'e7', to: 'e6', name: 'French-style Setup' },
      { from: 'f7', to: 'f5', name: 'Dutch Defense' },     // Aggressive
    ],
    weights: [40, 35, 15, 10]
  },

  // ========== BLACK'S RESPONSE TO 1.c4 (English) ==========
  'c2c4': {
    position: 'after_1_c4',
    moves: [
      { from: 'e7', to: 'e5', name: 'Reversed Sicilian' },
      { from: 'g8', to: 'f6', name: 'English Defense' },
      { from: 'c7', to: 'c5', name: 'Symmetrical' },
    ],
    weights: [40, 35, 25]
  },

  // ========== BLACK'S RESPONSE TO 1.Nf3 (Reti) ==========
  'g1f3': {
    position: 'after_1_Nf3',
    moves: [
      { from: 'd7', to: 'd5', name: 'Solid Center' },
      { from: 'g8', to: 'f6', name: 'Mirroring' },
      { from: 'c7', to: 'c5', name: 'English-style' },
    ],
    weights: [45, 35, 20]
  },

  // ========== WHITE'S 2nd MOVE AFTER 1.e4 e5 ==========
  'e2e4e7e5': {
    position: 'after_1_e4_e5',
    moves: [
      { from: 'g1', to: 'f3', name: 'Italian/Spanish Game' }, // Most common
      { from: 'f1', to: 'c4', name: 'Italian Opening' },      // Direct
      { from: 'f2', to: 'f4', name: 'King\'s Gambit' },       // Aggressive
    ],
    weights: [50, 30, 20]
  },

  // ========== WHITE'S 2nd MOVE AFTER 1.e4 c5 (Sicilian) ==========
  'e2e4c7c5': {
    position: 'after_1_e4_c5',
    moves: [
      { from: 'g1', to: 'f3', name: 'Open Sicilian' },     // Main line
      { from: 'c2', to: 'c3', name: 'Alapin' },            // Solid
      { from: 'b1', to: 'c3', name: 'Closed Sicilian' },   // Positional
    ],
    weights: [60, 25, 15]
  },

  // ========== WHITE'S 2nd MOVE AFTER 1.d4 d5 ==========
  'd2d4d7d5': {
    position: 'after_1_d4_d5',
    moves: [
      { from: 'c2', to: 'c4', name: "Queen's Gambit" },    // Most popular
      { from: 'g1', to: 'f3', name: 'London System prep' },
      { from: 'c1', to: 'f4', name: 'London System' },
    ],
    weights: [55, 30, 15]
  },

  // ========== WHITE'S 2nd MOVE AFTER 1.d4 Nf6 ==========
  'd2d4g8f6': {
    position: 'after_1_d4_Nf6',
    moves: [
      { from: 'c2', to: 'c4', name: 'Indian Games' },      // Main line
      { from: 'g1', to: 'f3', name: 'Flexible' },
      { from: 'c1', to: 'f4', name: 'London System' },
    ],
    weights: [50, 30, 20]
  },
};

/**
 * Get a move from the opening book.
 *
 * @param moveHistory Array of moves made so far in algebraic notation (e.g., ['e2e4', 'e7e5'])
 * @param enableRandomness Whether to use weighted random selection (true) or always best move (false)
 * @returns A move from the book, or null if position not in book
 */
export const getBookMove = (
  moveHistory: string[],
  enableRandomness: boolean = true
): OpeningMove | null => {
  // Only use opening book for first few moves (opening phase)
  if (moveHistory.length > 6) {
    return null;  // Out of book - too deep into game
  }

  // Determine book key based on move history
  let bookKey: string;

  if (moveHistory.length === 0) {
    // Starting position - White's first move
    bookKey = 'start';
  } else if (moveHistory.length === 1) {
    // Black's response to White's first move
    bookKey = moveHistory[0];
  } else if (moveHistory.length === 2) {
    // White's second move
    bookKey = moveHistory[0] + moveHistory[1];
  } else if (moveHistory.length === 3) {
    // Black's second move
    bookKey = moveHistory[0] + moveHistory[1] + moveHistory[2];
  } else {
    // Beyond book depth for this simple implementation
    return null;
  }

  const entry = OPENING_BOOK[bookKey];
  if (!entry) {
    return null;  // Position not in book
  }

  // If randomness disabled, always return the first (strongest) move
  if (!enableRandomness) {
    return entry.moves[0];
  }

  // Weighted random selection
  const weights = entry.weights || entry.moves.map(() => 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < entry.moves.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return entry.moves[i];
    }
  }

  // Fallback (should never reach here)
  return entry.moves[0];
};

/**
 * Convert move history from Move objects to algebraic strings.
 *
 * @param moves Array of Move objects
 * @returns Array of algebraic move strings (e.g., ['e2e4', 'e7e5'])
 */
export const movesToAlgebraic = (moves: { from: string; to: string }[]): string[] => {
  return moves.map(m => `${m.from}${m.to}`);
};
