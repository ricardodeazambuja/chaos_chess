/**
 * Piece-Square Tables for positional evaluation.
 *
 * Values represent bonuses/penalties (in centipawns) for pieces on specific squares.
 * Tables are from White's perspective (automatically flipped for Black).
 * Based on standard chess evaluation heuristics.
 *
 * These tables help the AI understand that:
 * - Center control is valuable
 * - Knights are weak on the edge
 * - Pawns should advance
 * - Kings should castle and stay safe in middlegame
 * - Kings should centralize in endgame
 */

export const PAWN_TABLE = [
  [  0,  0,  0,  0,  0,  0,  0,  0],  // 8th rank (shouldn't be here - would be promoted)
  [ 50, 50, 50, 50, 50, 50, 50, 50],  // 7th rank (about to promote!)
  [ 10, 10, 20, 30, 30, 20, 10, 10],  // 6th rank (advanced pawn)
  [  5,  5, 10, 25, 25, 10,  5,  5],  // 5th rank
  [  0,  0,  0, 20, 20,  0,  0,  0],  // 4th rank (center pawns valuable)
  [  5, -5,-10,  0,  0,-10, -5,  5],  // 3rd rank
  [  5, 10, 10,-20,-20, 10, 10,  5],  // 2nd rank (don't move edge pawns early)
  [  0,  0,  0,  0,  0,  0,  0,  0]   // 1st rank (starting position)
];

export const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],  // Knights on rim are dim!
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],  // Center knights are powerful
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]   // Really bad on back rank corners
];

export const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],  // Avoid back rank
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],  // Long diagonals are good
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],  // Center is great
  [-10, 10, 10, 10, 10, 10, 10,-10],  // Developed bishops
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]   // Don't trap bishops
];

export const ROOK_TABLE = [
  [  0,  0,  0,  0,  0,  0,  0,  0],
  [  5, 10, 10, 10, 10, 10, 10,  5],  // 7th rank is powerful
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [  0,  0,  0,  5,  5,  0,  0,  0]   // Rooks like open files and 7th rank
];

export const QUEEN_TABLE = [
  [-20,-10,-10, -5, -5,-10,-10,-20],  // Don't bring queen out too early
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

export const KING_MIDDLE_GAME_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],  // Stay away from center in middlegame
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],  // Castling squares are good
  [ 20, 30, 10,  0,  0, 10, 30, 20]   // King likes corners when castled
];

export const KING_END_GAME_TABLE = [
  [-50,-40,-30,-20,-20,-30,-40,-50],  // Endgame: king should centralize
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],  // Center is now good!
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50]
];

/**
 * Get piece-square table value for a piece at a given position.
 *
 * @param pieceType The type of piece
 * @param row Row index (0-7)
 * @param col Column index (0-7)
 * @param color Piece color (white or black)
 * @param isEndGame Whether the game is in endgame phase
 * @returns Positional bonus value (in centipawns, divide by 100 for pawn units)
 */
export const getPieceSquareValue = (
  pieceType: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn',
  row: number,
  col: number,
  color: 'white' | 'black',
  isEndGame: boolean = false
): number => {
  // Choose the appropriate table
  let table: number[][];
  switch (pieceType) {
    case 'pawn': table = PAWN_TABLE; break;
    case 'knight': table = KNIGHT_TABLE; break;
    case 'bishop': table = BISHOP_TABLE; break;
    case 'rook': table = ROOK_TABLE; break;
    case 'queen': table = QUEEN_TABLE; break;
    case 'king': table = isEndGame ? KING_END_GAME_TABLE : KING_MIDDLE_GAME_TABLE; break;
    default: return 0;
  }

  // Flip the table for black pieces (they play from the opposite side)
  const effectiveRow = color === 'white' ? row : 7 - row;

  return table[effectiveRow][col] / 100; // Convert centipawns to pawn units
};

/**
 * Determine if the game is in endgame phase.
 *
 * Simple heuristic: endgame begins when each side has <= 13 points of material
 * (excluding kings). This typically means queens are traded or minimal pieces remain.
 *
 * @param board The current board state
 * @returns true if endgame, false if middlegame
 */
export const isEndGame = (board: (any | null)[][]): boolean => {
  let whiteMaterial = 0;
  let blackMaterial = 0;

  const pieceValues: Record<string, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0  // Don't count king in material
  };

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const value = pieceValues[piece.type] || 0;
        if (piece.color === 'white') {
          whiteMaterial += value;
        } else {
          blackMaterial += value;
        }
      }
    }
  }

  // Endgame if either side has <= 13 points (roughly queen + rook or less)
  return whiteMaterial <= 13 || blackMaterial <= 13;
};
