/**
 * Minimax AI Implementation for Chaos Chess
 *
 * This module implements a chess AI using the Minimax algorithm with:
 * - Alpha-beta pruning for performance optimization
 * - Support for all chess rules (castling, en passant, promotion)
 * - Game mode awareness (rotating colors, points game, timed game)
 *
 * Key Concepts:
 * - Minimax: Explores the game tree to find the best move
 * - Alpha-beta pruning: Skips branches that won't affect the final decision
 * - Evaluation: Assigns numerical scores to board positions
 * - Search depth: How many moves ahead the AI looks
 */

import type {
  Board,
  Move,
  LastMove,
  Piece,
} from '../chess-logic';
import {
  PIECE_VALUES,
  generateAllValidMoves,
  fromAlgebraic,
} from '../chess-logic';

/**
 * Evaluates the board from the perspective of the AI player.
 *
 * This is the "brain" of the AI - it assigns a numerical score to any board position.
 * Higher scores = better for AI, lower scores = worse for AI.
 *
 * Evaluation Strategy:
 * 1. Material Balance: Count piece values (pawn=1, knight/bishop=3, rook=5, queen=9)
 * 2. Points Game Awareness: Heavily favor positions that win by points
 * 3. Time Management: Implicitly handled by search depth adjustment
 *
 * Example Scores:
 * - AI up a queen: ~+9
 * - Equal material: ~0
 * - AI down a rook: ~-5
 * - AI wins by points: +999999
 * - Opponent wins: -999999
 *
 * @param board The current board state.
 * @param aiColor The color of the AI player at this position.
 * @param isPointsGame Whether this is a points-based game.
 * @param playerScores Current scores of all players.
 * @param targetScore Target score to win (if points game).
 * @param currentPlayerIndex Index of the AI player.
 * @returns A score representing the board state. Positive is good for the AI, negative is bad.
 */
const evaluateBoard = (
  board: Board,
  aiColor: 'white' | 'black',
  isPointsGame?: boolean,
  playerScores?: number[],
  targetScore?: number,
  currentPlayerIndex?: number
): number => {
  let materialScore = 0;

  // ===== STEP 1: Calculate Material Balance =====
  // Material is the standard chess evaluation metric
  // We count all pieces and sum their values from the AI's perspective
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece) {
        const value = PIECE_VALUES[piece.type] || 0;
        if (piece.color === aiColor) {
          materialScore += value; // AI's pieces are positive
        } else {
          materialScore -= value; // Opponent's pieces are negative
        }
      }
    }
  }

  // ===== STEP 2: Points Game Adjustments =====
  // In points games, winning by reaching target score is more important than material
  if (isPointsGame && playerScores && targetScore !== undefined && currentPlayerIndex !== undefined) {
    const aiScore = playerScores[currentPlayerIndex];

    // If AI has reached target score, this is an instant win
    if (aiScore >= targetScore) {
      return 999999; // Massive bonus ensures AI prioritizes this move
    }

    // If AI is close to winning (within a high-value capture), play aggressively
    const pointsNeeded = targetScore - aiScore;
    if (pointsNeeded <= 9) { // Can win with a queen capture (queen = 9 points)
      materialScore += 50; // Encourage aggressive captures
    }

    // Check if any opponent is close to or has reached winning score
    for (let i = 0; i < playerScores.length; i++) {
      if (i !== currentPlayerIndex && playerScores[i] >= targetScore) {
        return -999999; // Opponent already won - losing position
      }
      if (i !== currentPlayerIndex && playerScores[i] >= targetScore - 9) {
        materialScore -= 30; // Opponent close to winning - play defensively
      }
    }
  }

  return materialScore;
};

/**
 * The core Minimax algorithm with Alpha-Beta Pruning.
 *
 * Minimax explores the game tree by simulating all possible moves and counter-moves.
 * It assumes both players play optimally:
 * - Maximizing player (AI): Tries to maximize the score
 * - Minimizing player (Opponent): Tries to minimize the score
 *
 * Alpha-Beta Pruning optimizes by skipping branches that can't affect the final decision:
 * - Alpha: Best score maximizer can guarantee
 * - Beta: Best score minimizer can guarantee
 * - If beta <= alpha, remaining branches can be skipped (pruned)
 *
 * Example Game Tree (depth=2):
 *
 *         Root (AI to move)
 *        /      |      \
 *     Move1  Move2  Move3  <- AI considers all moves
 *      /|\     /|\     /|\
 *    ... ... ... ... ... ... <- Opponent responses
 *     |   |   |   |   |   |
 *   Score Score Score Score <- Evaluate positions
 *
 * Rotating Mode Complexity:
 * In rotating mode, players switch colors after each move. The AI must track
 * which color it will be playing at each depth of the tree:
 *
 * Depth 0 (now): AI plays white
 * Depth 1: Opponent plays black
 * Depth 2: AI plays BLACK now! (color flipped)
 * Depth 3: Opponent plays white
 * Depth 4: AI plays white again (flipped back)
 *
 * @param board The current board state.
 * @param depth The remaining search depth (0 = evaluate position).
 * @param alpha The best score found so far for the maximizing player (AI).
 * @param beta The best score found so far for the minimizing player (Opponent).
 * @param isMaximizingPlayer True if the current player is the AI (maximizer), false otherwise.
 * @param aiColor The original color of the AI player (before any rotations).
 * @param lastMove The last move made in the game (for en passant detection).
 * @param isPointsGame Whether this is a points-based game.
 * @param playerScores Current scores of all players.
 * @param targetScore Target score to win (if points game).
 * @param currentPlayerIndex Index of the AI player.
 * @param gameMode The game mode (rotating, random, normie).
 * @param initialDepth The initial search depth (to track color flips in rotating mode).
 * @returns The best score found for the current branch of the game tree.
 */
const minimax = (
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean,
  aiColor: 'white' | 'black',
  lastMove: LastMove | null,
  isPointsGame?: boolean,
  playerScores?: number[],
  targetScore?: number,
  currentPlayerIndex?: number,
  gameMode?: 'rotating' | 'random' | 'normie',
  initialDepth?: number
): number => {
  // ===== ROTATING MODE: Track Color Flipping =====
  // In rotating mode, players switch colors after each of their moves
  // We need to track which color the AI is evaluating from at this depth
  let effectiveAiColor = aiColor;
  if (gameMode === 'rotating' && initialDepth !== undefined) {
    // Calculate how many plies (half-moves) have passed from the root
    const pliesFromRoot = initialDepth - depth;

    // Each full move = 2 plies (one for each player)
    // Example: depth 3 -> 1 ply from root -> 0 full moves -> same color
    //          depth 2 -> 2 plies from root -> 1 full move -> FLIPPED color
    const fullMovesFromRoot = Math.floor(pliesFromRoot / 2);

    // AI flips color after each of its own moves (every 2 plies)
    if (fullMovesFromRoot % 2 === 1) {
      effectiveAiColor = aiColor === 'white' ? 'black' : 'white';
    }
  }

  // ===== BASE CASE: Reached maximum depth, evaluate position =====
  if (depth === 0) {
    return evaluateBoard(board, effectiveAiColor, isPointsGame, playerScores, targetScore, currentPlayerIndex);
  }

  // ===== RECURSIVE CASE: Explore deeper =====
  // Determine whose turn it is at this level of the tree
  const playerColor = isMaximizingPlayer ? effectiveAiColor : (effectiveAiColor === 'white' ? 'black' : 'white');

  // Generate all legal moves for the current player
  const validMoves = generateAllValidMoves(board, playerColor, lastMove);

  // ===== TERMINAL CASE: No legal moves (checkmate or stalemate) =====
  if (validMoves.length === 0) {
    // TODO: Distinguish between checkmate (bad) and stalemate (neutral)
    // For now, treat as neutral to avoid complicating evaluation
    return 0;
  }

  // ===== MAXIMIZING PLAYER (AI's turn) =====
  // AI tries to maximize the evaluation score
  if (isMaximizingPlayer) {
    let maxEval = -Infinity;

    // Try each possible move
    for (const move of validMoves) {
      // Simulate the move on a copy of the board
      const { board: newBoard, lastMove: newLastMove } = simulateMove(board, move);

      // Recursively evaluate the resulting position (now opponent's turn to minimize)
      const evaluation = minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        false, // Switch to minimizing player
        aiColor,
        newLastMove,
        isPointsGame,
        playerScores,
        targetScore,
        currentPlayerIndex,
        gameMode,
        initialDepth
      );

      // Track the best (maximum) score found
      maxEval = Math.max(maxEval, evaluation);

      // Update alpha (best score maximizer can guarantee)
      alpha = Math.max(alpha, evaluation);

      // ===== ALPHA-BETA PRUNING =====
      // If beta <= alpha, the minimizer already has a better option elsewhere
      // No need to explore remaining moves in this branch
      if (beta <= alpha) {
        break; // Beta cutoff - prune remaining moves
      }
    }
    return maxEval;

  // ===== MINIMIZING PLAYER (Opponent's turn) =====
  // Opponent tries to minimize the evaluation score
  } else {
    let minEval = Infinity;

    // Try each possible move
    for (const move of validMoves) {
      // Simulate the move on a copy of the board
      const { board: newBoard, lastMove: newLastMove } = simulateMove(board, move);

      // Recursively evaluate the resulting position (now AI's turn to maximize)
      const evaluation = minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        true, // Switch to maximizing player
        aiColor,
        newLastMove,
        isPointsGame,
        playerScores,
        targetScore,
        currentPlayerIndex,
        gameMode,
        initialDepth
      );

      // Track the best (minimum) score found
      minEval = Math.min(minEval, evaluation);

      // Update beta (best score minimizer can guarantee)
      beta = Math.min(beta, evaluation);

      // ===== ALPHA-BETA PRUNING =====
      // If beta <= alpha, the maximizer already has a better option elsewhere
      // No need to explore remaining moves in this branch
      if (beta <= alpha) {
        break; // Alpha cutoff - prune remaining moves
      }
    }
    return minEval;
  }
};

/**
 * Simulates a move on the board and returns the new board state.
 *
 * This function creates a new board (doesn't mutate the original) and applies
 * a move, handling all special chess rules:
 * - Normal moves
 * - Castling (moves both king and rook)
 * - En passant (captures pawn not on destination square)
 * - Promotion (upgrades pawn to queen/rook/bishop/knight)
 *
 * This is used by minimax to explore hypothetical future positions without
 * affecting the actual game board.
 *
 * @param board The board to perform the move on.
 * @param move The move to make (from/to/promotion).
 * @returns The new board and the new last move state.
 */
const simulateMove = (board: Board, move: Move): { board: Board; lastMove: LastMove | null } => {
  const newBoard = board.map(row => [...row]);
  const { row: fromRow, col: fromCol } = fromAlgebraic(move.from);
  const { row: toRow, col: toCol } = fromAlgebraic(move.to);

  const piece = newBoard[fromRow][fromCol];

  if (!piece) {
    // This should not happen in a valid move sequence
    return { board, lastMove: null };
  }

  // Create a new piece object to avoid mutation issues
  const movedPiece: Piece = { ...piece, hasMoved: true };

  // Handle promotion
  if (move.promotion) {
    movedPiece.type = move.promotion === 'n' ? 'knight' :
                      move.promotion === 'b' ? 'bishop' :
                      move.promotion === 'r' ? 'rook' : 'queen';
  }

  // Handle castling - move the rook
  if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
    const isKingSide = toCol > fromCol;
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? 5 : 3;
    const rook = newBoard[fromRow][rookFromCol];

    if (rook) {
      newBoard[fromRow][rookToCol] = { ...rook, hasMoved: true };
      newBoard[fromRow][rookFromCol] = null;
    }
  }

  // Handle en passant capture - remove the captured pawn
  if (piece.type === 'pawn' && toCol !== fromCol && !newBoard[toRow][toCol]) {
    // This is an en passant capture
    newBoard[fromRow][toCol] = null;
  }

  // Move the piece
  newBoard[toRow][toCol] = movedPiece;
  newBoard[fromRow][fromCol] = null;

  const newLastMove: LastMove = { fromRow, fromCol, toRow, toCol, piece: movedPiece };

  return { board: newBoard, lastMove: newLastMove };
};


/**
 * The main entry point for the Minimax AI - finds the best move to play.
 *
 * This function:
 * 1. Generates all legal moves for the AI
 * 2. For each move, simulates it and evaluates the resulting position using minimax
 * 3. Applies weighted random selection to add variety and prevent repetition
 *
 * Randomness Strategy:
 * - Evaluates ALL legal moves and scores them
 * - Considers "good moves" within 1.0 point of the best score
 * - Best move gets 2x probability weight
 * - Other good moves get 1x probability weight
 * - This prevents the AI from always playing the same move in the same position
 *
 * Example: If best move scores 5.0:
 * - Best move (5.0): 40% chance (weight 2.0)
 * - Good move (4.5): 20% chance (weight 1.0)
 * - Good move (4.2): 20% chance (weight 1.0)
 * - Good move (4.0): 20% chance (weight 1.0)
 * - Bad moves (<4.0): 0% chance (filtered out)
 *
 * Search Depth Strategy:
 * - Depth 1: Only looks at immediate moves (very fast, very weak)
 * - Depth 2: Looks at AI move + opponent response (fast, basic tactics)
 * - Depth 3: AI -> Opponent -> AI (good balance, sees simple tactics)
 * - Depth 4: AI -> Opponent -> AI -> Opponent (slower, stronger)
 * - Depth 5+: Very slow, professional level play
 *
 * Time Management:
 * - < 30s remaining: Use depth 1-2 (fast moves)
 * - Normal time: Use depth based on skill level (2-3)
 * - > 120s: Use depth+1 (deeper thinking)
 *
 * @param board The current board state.
 * @param aiColor The color the AI is playing THIS turn.
 * @param lastMove The last move made in the game (for en passant).
 * @param searchDepth The depth for the Minimax search (how many moves to look ahead).
 * @param isPointsGame Whether this is a points-based game.
 * @param playerScores Current scores of all players.
 * @param targetScore Target score to win (if points game).
 * @param currentPlayerIndex Index of the AI player.
 * @param gameMode The game mode (rotating, random, normie).
 * @returns The best move found by the AI (with randomness), or null if no legal moves exist.
 */
export const findBestMove = (
  board: Board,
  aiColor: 'white' | 'black',
  lastMove: LastMove | null,
  searchDepth = 3, // A reasonable default depth
  isPointsGame?: boolean,
  playerScores?: number[],
  targetScore?: number,
  currentPlayerIndex?: number,
  gameMode?: 'rotating' | 'random' | 'normie'
): Move | null => {
  const validMoves = generateAllValidMoves(board, aiColor, lastMove);

  if (validMoves.length === 0) {
    return null; // No legal moves
  }

  if (validMoves.length === 1) {
    return validMoves[0]; // Only one move, no need to evaluate
  }

  // ===== STEP 1: Evaluate all moves and store scores =====
  interface MoveScore {
    move: Move;
    score: number;
  }

  const movesWithScores: MoveScore[] = [];

  for (const move of validMoves) {
    const { board: newBoard, lastMove: newLastMove } = simulateMove(board, move);
    const boardValue = minimax(
      newBoard,
      searchDepth - 1,
      -Infinity,
      Infinity,
      false,
      aiColor,
      newLastMove,
      isPointsGame,
      playerScores,
      targetScore,
      currentPlayerIndex,
      gameMode,
      searchDepth // Pass initial depth for rotating mode tracking
    );

    movesWithScores.push({ move, score: boardValue });
  }

  // ===== STEP 2: Sort moves by score (best first) =====
  movesWithScores.sort((a, b) => b.score - a.score);

  const bestScore = movesWithScores[0].score;

  // ===== STEP 3: Filter to "good moves" within threshold of best =====
  // Consider moves within 1.0 point of the best as "reasonable alternatives"
  const threshold = 1.0;
  const goodMoves = movesWithScores.filter(m => m.score >= bestScore - threshold);

  // ===== STEP 4: Apply weighted random selection =====
  // Best move gets 2x weight, others get 1x weight
  const weights: number[] = goodMoves.map((moveScore, index) => {
    if (index === 0) {
      return 2.0; // Best move: 2x probability
    } else {
      return 1.0; // Other good moves: 1x probability
    }
  });

  // Calculate total weight
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // ===== STEP 5: Randomly select a move based on weights =====
  let random = Math.random() * totalWeight;

  for (let i = 0; i < goodMoves.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return goodMoves[i].move;
    }
  }

  // Fallback: return best move (should never reach here)
  return goodMoves[0].move;
};
