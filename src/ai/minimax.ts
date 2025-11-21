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
  generateCaptureMoves,
  fromAlgebraic,
  isInCheck,
} from '../chess-logic';
import {
  getPieceSquareValue,
  isEndGame,
} from './piece-square-tables';
import { transpositionTable } from './transposition-table';
import { getBookMove, movesToAlgebraic } from './opening-book';

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
export const evaluateBoard = (
  board: Board,
  aiColor: 'white' | 'black',
  isPointsGame?: boolean,
  playerScores?: number[],
  targetScore?: number,
  currentPlayerIndex?: number,
  gameMode?: 'rotating' | 'random' | 'normie'
): number => {
  let materialScore = 0;
  let positionalScore = 0;

  // Determine if we're in endgame (affects king position value)
  const inEndGame = isEndGame(board);

  // ===== STEP 1: Calculate Material Balance + Positional Value =====
  // Material is the standard chess evaluation metric (piece values)
  // Positional values reward good piece placement (center control, piece activity, etc.)
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece) {
        const materialValue = PIECE_VALUES[piece.type] || 0;
        const positionalValue = getPieceSquareValue(
          piece.type,
          row,
          col,
          piece.color,
          inEndGame
        );

        if (piece.color === aiColor) {
          materialScore += materialValue;
          positionalScore += positionalValue;
        } else {
          materialScore -= materialValue;
          positionalScore -= positionalValue;
        }
      }
    }
  }

  // Combine material and positional scores
  let totalScore = materialScore + positionalScore;

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
      totalScore += 50; // Encourage aggressive captures
    }

    // Check if any opponent is close to or has reached winning score
    for (let i = 0; i < playerScores.length; i++) {
      if (i !== currentPlayerIndex && playerScores[i] >= targetScore) {
        return -999999; // Opponent already won - losing position
      }
      if (i !== currentPlayerIndex && playerScores[i] >= targetScore - 9) {
        totalScore -= 30; // Opponent close to winning - play defensively
      }
    }
  }

  // ===== STEP 3: Game Mode Specific Adjustments =====
  // Different game modes require different strategic approaches

  if (gameMode === 'rotating') {
    /**
     * ROTATING MODE STRATEGY:
     * In rotating mode, players switch colors after each move.
     * This fundamentally changes strategy because:
     * - Damaging opponent's position hurts you next turn
     * - Improving your position helps opponent next turn
     * - Need to keep BOTH sides in reasonable shape
     */

    // Count piece mobility for both sides (simplified)
    let totalPieces = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col]) {
          totalPieces++;
        }
      }
    }

    // Encourage keeping more pieces on board (less aggressive trades)
    // Unless winning on points, avoid simplifying the position
    if (!isPointsGame || (playerScores && currentPlayerIndex !== undefined &&
        playerScores[currentPlayerIndex] < (targetScore || 20) * 0.7)) {
      totalScore += (totalPieces - 16) * 0.15;
    }

    // Reduce aggression - don't play too sharply
    // In rotating mode, maintaining balance is more important
    totalScore *= 0.85;

    // Penalize positions with large material imbalance
    // (you'll inherit the worse side next turn)
    const materialImbalance = Math.abs(materialScore);
    if (materialImbalance > 5) {
      totalScore -= (materialImbalance - 5) * 0.3;
    }
  }

  if (gameMode === 'random') {
    /**
     * RANDOM MODE STRATEGY:
     * In random mode, color assignment is unpredictable each turn.
     * Strategy should:
     * - Maximize flexibility (you don't know which color you'll get)
     * - Value center control highly (benefits both colors)
     * - Avoid over-committing to one plan
     */

    // Count center control (d4, d5, e4, e5)
    let centerControl = 0;
    const centerSquares = [[3, 3], [3, 4], [4, 3], [4, 4]];

    for (const [row, col] of centerSquares) {
      const piece = board[row][col];
      if (piece) {
        const bonus = 0.4;
        if (piece.color === aiColor) {
          centerControl += bonus;
        } else {
          centerControl -= bonus;
        }
      }
    }

    totalScore += centerControl;

    // Reduce commitment to extreme positions
    totalScore *= 0.9;
  }

  // Enhanced points mode strategy (beyond basic adjustments above)
  if (isPointsGame && playerScores && targetScore !== undefined && currentPlayerIndex !== undefined) {
    const aiScore = playerScores[currentPlayerIndex];
    const maxOpponentScore = Math.max(...playerScores.filter((_, i) => i !== currentPlayerIndex));
    const pointsDifference = aiScore - maxOpponentScore;

    // LEADING STRATEGY: Play solid when ahead
    if (pointsDifference > 5) {
      // Prioritize king safety when leading
      let kingSafety = 0;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (piece && piece.type === 'king' && piece.color === aiColor) {
            // Bonus for king on back rank or near corners when leading
            if (piece.color === 'white' && row >= 6) {
              kingSafety += 0.5;
            } else if (piece.color === 'black' && row <= 1) {
              kingSafety += 0.5;
            }
          }
        }
      }
      totalScore += kingSafety;

      // Reduce aggression when ahead (play solid)
      totalScore *= 0.95;
    }

    // TRAILING STRATEGY: Play aggressive when behind
    if (pointsDifference < -5) {
      // Encourage tactical complications and piece activity
      totalScore *= 1.05;

      // Value having more pieces active (more capture opportunities)
      let activePieces = 0;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (piece && piece.color === aiColor && piece.type !== 'pawn') {
            // Not on back rank = more active
            const isActive = piece.color === 'white' ? row < 6 : row > 1;
            if (isActive) {
              activePieces += 0.2;
            }
          }
        }
      }
      totalScore += activePieces;
    }
  }

  return totalScore;
};

/**
 * Killer Moves Table - stores moves that caused beta cutoffs at each depth.
 *
 * Killer moves are quiet moves (non-captures) that caused a beta cutoff.
 * They're likely to be good in similar positions at the same depth.
 * This heuristic improves move ordering for better alpha-beta pruning.
 */
const killerMoves: Map<number, Move[]> = new Map();
const MAX_KILLER_MOVES = 2;

/**
 * Clear killer moves table (call before each new search).
 * Prevents memory leaks from accumulated killer moves.
 */
export const clearKillerMoves = (): void => {
  killerMoves.clear();
};

/**
 * Order moves to improve alpha-beta pruning efficiency.
 *
 * Move ordering is crucial for alpha-beta pruning performance.
 * Good ordering can reduce the search tree by 50% or more.
 *
 * Priority (highest to lowest):
 * 1. MVV-LVA captures (Most Valuable Victim - Least Valuable Attacker)
 *    e.g., pawn takes queen > queen takes pawn
 * 2. Killer moves (quiet moves that caused cutoffs before)
 * 3. Promotions
 * 4. Center control moves
 * 5. Other quiet moves
 *
 * @param moves Array of moves to order
 * @param board Current board state
 * @param depth Current search depth (for killer move lookup)
 * @returns Ordered array of moves (best first)
 */
export const orderMoves = (
  moves: Move[],
  board: Board,
  depth: number
): Move[] => {
  interface ScoredMove {
    move: Move;
    score: number;
  }

  const scoredMoves: ScoredMove[] = moves.map(move => {
    let score = 0;
    const { row: fromRow, col: fromCol } = fromAlgebraic(move.from);
    const { row: toRow, col: toCol } = fromAlgebraic(move.to);
    const movingPiece = board[fromRow][fromCol];
    const capturedPiece = board[toRow][toCol];

    // 1. Prioritize captures using MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
    if (capturedPiece) {
      const victimValue = PIECE_VALUES[capturedPiece.type] || 0;
      const attackerValue = movingPiece ? (PIECE_VALUES[movingPiece.type] || 0) : 0;
      score += (victimValue * 10) - attackerValue;
      // Example: pawn (1) takes queen (9) = 90 - 1 = 89 (very good!)
      //          queen (9) takes pawn (1) = 10 - 9 = 1 (okay)
    }

    // 2. Check killer moves (quiet moves that caused cutoffs at this depth)
    if (!capturedPiece) {
      const killers = killerMoves.get(depth) || [];
      if (killers.some(k => k.from === move.from && k.to === move.to)) {
        score += 5; // Bonus for killer moves
      }
    }

    // 3. Promotions are usually strong
    if (move.promotion) {
      score += 8;
    }

    // 4. Slight bonus for moves toward center
    const centerDistance = Math.abs(toRow - 3.5) + Math.abs(toCol - 3.5);
    score += (7 - centerDistance) * 0.1;

    return { move, score };
  });

  // Sort by score (highest first)
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves.map(sm => sm.move);
};

/**
 * Store a killer move (a quiet move that caused a beta cutoff).
 *
 * @param move The move that caused the cutoff
 * @param depth The depth at which it occurred
 */
const storeKillerMove = (move: Move, depth: number): void => {
  const killers = killerMoves.get(depth) || [];

  // Don't store duplicate
  if (killers.some(k => k.from === move.from && k.to === move.to)) {
    return;
  }

  // Add to front, keep only MAX_KILLER_MOVES
  killers.unshift(move);
  if (killers.length > MAX_KILLER_MOVES) {
    killers.pop();
  }

  killerMoves.set(depth, killers);
};

/**
 * Quiescence Search - extends search at "noisy" positions to eliminate horizon effect.
 *
 * The horizon effect occurs when the AI stops searching at a position
 * that is in the middle of a tactical sequence (e.g., a piece trade).
 * This makes the AI think it's winning material when it's actually losing.
 *
 * Example without quiescence:
 * - AI sees it can capture opponent's queen (score +9)
 * - AI stops searching because depth limit reached
 * - Misses that opponent can recapture with a pawn next move
 * - Result: AI thinks it's winning but is actually losing
 *
 * Quiescence search continues evaluating ONLY capture moves until
 * a "quiet" position is reached (no more profitable captures).
 *
 * @param board Current board state
 * @param alpha Best score found so far for maximizing player
 * @param beta Best score found so far for minimizing player
 * @param isMaximizingPlayer True if current player is maximizing
 * @param aiColor Original AI color
 * @param lastMove Last move made
 * @param isPointsGame Whether this is a points-based game
 * @param playerScores Current scores
 * @param targetScore Target score to win
 * @param currentPlayerIndex AI player index
 * @param gameMode Game mode
 * @param initialDepth Initial search depth (for rotating mode)
 * @param currentDepth Current depth (for rotating mode)
 * @returns Evaluation score of the position
 */
export const quiescence = (
  board: Board,
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
  initialDepth?: number,
  currentDepth?: number,
  qDepth: number = 0  // Track quiescence search depth
): number => {
  // DEPTH LIMIT: Prevent quiescence search from going too deep
  const MAX_QUIESCENCE_DEPTH = 10;
  if (qDepth >= MAX_QUIESCENCE_DEPTH) {
    // At max depth, just evaluate and return
    return evaluateBoard(
      board,
      aiColor,
      isPointsGame,
      playerScores,
      targetScore,
      currentPlayerIndex,
      gameMode
    );
  }

  // Determine effective AI color (for rotating mode)
  let effectiveAiColor = aiColor;
  if (gameMode === 'rotating' && initialDepth !== undefined && currentDepth !== undefined) {
    const pliesFromRoot = initialDepth - currentDepth;
    const fullMovesFromRoot = Math.floor(pliesFromRoot / 2);
    if (fullMovesFromRoot % 2 === 1) {
      effectiveAiColor = aiColor === 'white' ? 'black' : 'white';
    }
  }

  // Stand-pat score: evaluate current position WITHOUT making any move
  // This acts as a lower bound - we can always choose to NOT capture
  const standPat = evaluateBoard(
    board,
    effectiveAiColor,
    isPointsGame,
    playerScores,
    targetScore,
    currentPlayerIndex,
    gameMode
  );

  // Beta cutoff: position is already too good for opponent to allow
  if (standPat >= beta) {
    return beta;
  }

  // Update alpha with stand-pat score (we can always achieve at least this)
  if (standPat > alpha) {
    alpha = standPat;
  }

  // Generate only capture moves (no quiet moves)
  const playerColor = isMaximizingPlayer
    ? effectiveAiColor
    : (effectiveAiColor === 'white' ? 'black' : 'white');
  const captureMoves = generateCaptureMoves(board, playerColor, lastMove);

  // If no captures available, return stand-pat (quiet position reached)
  if (captureMoves.length === 0) {
    return standPat;
  }

  // Search capture moves to resolve tactical sequences
  if (isMaximizingPlayer) {
    let maxEval = standPat;

    for (const move of captureMoves) {
      const { board: newBoard, lastMove: newLastMove } = simulateMove(board, move);

      const evaluation = quiescence(
        newBoard,
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
        initialDepth,
        currentDepth !== undefined ? currentDepth - 1 : undefined,
        qDepth + 1  // Increment quiescence depth
      );

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);

      // Beta cutoff
      if (beta <= alpha) {
        break;
      }
    }

    return maxEval;
  } else {
    let minEval = standPat;

    for (const move of captureMoves) {
      const { board: newBoard, lastMove: newLastMove } = simulateMove(board, move);

      const evaluation = quiescence(
        newBoard,
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
        initialDepth,
        currentDepth !== undefined ? currentDepth - 1 : undefined,
        qDepth + 1  // Increment quiescence depth
      );

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);

      // Alpha cutoff
      if (beta <= alpha) {
        break;
      }
    }

    return minEval;
  }
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
export const minimax = (
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

  // ===== TRANSPOSITION TABLE: Check if we've seen this position before =====
  const ttScore = transpositionTable.probe(
    board,
    effectiveAiColor,
    depth,
    alpha,
    beta
  );

  if (ttScore !== null) {
    return ttScore;  // Table hit! Return cached score
  }

  // Store original alpha/beta for determining score flag later
  const originalAlpha = alpha;

  // ===== BASE CASE: Reached maximum depth, enter quiescence search =====
  if (depth === 0) {
    // Instead of evaluating immediately, enter quiescence search to resolve captures
    return quiescence(
      board,
      alpha,
      beta,
      isMaximizingPlayer,
      aiColor,
      lastMove,
      isPointsGame,
      playerScores,
      targetScore,
      currentPlayerIndex,
      gameMode,
      initialDepth,
      depth // Current depth for rotating mode
    );
  }

  // ===== RECURSIVE CASE: Explore deeper =====
  // Determine whose turn it is at this level of the tree
  const playerColor = isMaximizingPlayer ? effectiveAiColor : (effectiveAiColor === 'white' ? 'black' : 'white');

  // Generate all legal moves for the current player
  const validMoves = generateAllValidMoves(board, playerColor, lastMove);

  // ===== TERMINAL CASE: No legal moves (checkmate or stalemate) =====
  if (validMoves.length === 0) {
    // Distinguish between checkmate and stalemate
    const isInCheckNow = isInCheck(playerColor, board, lastMove);

    if (isInCheckNow) {
      // Checkmate: massive penalty for the player who is checkmated
      // If maximizing player (AI) has no moves and is in check = AI is checkmated = bad (-999999)
      // If minimizing player (opponent) has no moves and is in check = opponent is checkmated = good (+999999)
      return isMaximizingPlayer ? -999999 : 999999;
    } else {
      // Stalemate: neutral outcome (draw)
      return 0;
    }
  }

  // ===== MAXIMIZING PLAYER (AI's turn) =====
  // AI tries to maximize the evaluation score
  if (isMaximizingPlayer) {
    let maxEval = -Infinity;

    // Order moves for better alpha-beta pruning efficiency
    const orderedMoves = orderMoves(validMoves, board, depth);

    // Try each possible move (in order of likely strength)
    for (const move of orderedMoves) {
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
        storeKillerMove(move, depth); // Store this move as a killer
        break; // Beta cutoff - prune remaining moves
      }
    }

    // Store in transposition table before returning
    const flag = maxEval <= originalAlpha ? 'ALPHA' : maxEval >= beta ? 'BETA' : 'EXACT';
    transpositionTable.store(board, effectiveAiColor, depth, maxEval, flag);

    return maxEval;

  // ===== MINIMIZING PLAYER (Opponent's turn) =====
  // Opponent tries to minimize the evaluation score
  } else {
    let minEval = Infinity;

    // Order moves for better alpha-beta pruning efficiency
    const orderedMoves = orderMoves(validMoves, board, depth);

    // Try each possible move (in order of likely strength)
    for (const move of orderedMoves) {
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
        storeKillerMove(move, depth); // Store this move as a killer
        break; // Alpha cutoff - prune remaining moves
      }
    }

    // Store in transposition table before returning
    const flag = minEval >= beta ? 'BETA' : minEval <= originalAlpha ? 'ALPHA' : 'EXACT';
    transpositionTable.store(board, effectiveAiColor, depth, minEval, flag);

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
export const simulateMove = (board: Board, move: Move): { board: Board; lastMove: LastMove | null } => {
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
  gameMode?: 'rotating' | 'random' | 'normie',
  enableRandomness: boolean = true, // Control AI move randomization
  moveHistory?: { from: string; to: string }[] // Move history for opening book
): Move | null => {
  // Clear killer moves from previous search to prevent memory leaks
  clearKillerMoves();

  // ===== OPENING BOOK: Check if we're in book =====
  if (moveHistory && moveHistory.length <= 6) {
    const algebraicHistory = movesToAlgebraic(moveHistory);
    const bookMove = getBookMove(algebraicHistory, enableRandomness);

    if (bookMove) {
      // Verify book move is legal in current position
      const validMoves = generateAllValidMoves(board, aiColor, lastMove);
      const isLegal = validMoves.some(
        m => m.from === bookMove.from && m.to === bookMove.to
      );

      if (isLegal) {
        console.log(`[Opening Book] ${bookMove.name || bookMove.from + bookMove.to}`);
        return bookMove;
      }
    }
  }

  // ===== MINIMAX SEARCH: Generate and evaluate moves =====
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

  // ===== STEP 4: Check if randomness is enabled =====
  if (!enableRandomness) {
    // Deterministic mode: always return the best move
    return goodMoves[0].move;
  }

  // ===== STEP 5: Apply weighted random selection =====
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

  // ===== STEP 6: Randomly select a move based on weights =====
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
