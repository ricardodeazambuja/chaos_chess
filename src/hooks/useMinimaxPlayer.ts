import { useState, useCallback, useEffect } from 'react';
import type { Board, Move, LastMove } from '../chess-logic';
import { generateAllValidMoves } from '../chess-logic';
import { findBestMove } from '../ai/minimax';
import { getBookMove, movesToAlgebraic } from '../ai/opening-book';
import { transpositionTable } from '../ai/transposition-table';
import { getWorkerPool, terminateWorkerPool } from '../ai/worker-pool';
import type { AIPlayer } from './useAI';

export const useMinimaxPlayer = (): AIPlayer => {
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [useParallel, setUseParallel] = useState<boolean>(true); // ENABLED with full minimax

  // Cleanup worker pool on unmount
  useEffect(() => {
    return () => {
      terminateWorkerPool();
    };
  }, []);

  // Minimax is self-contained; no actual loading is needed.
  // Clear transposition table for new game
  const loadAI = useCallback(async () => {
    setAIError(null);
    transpositionTable.clear();
    return Promise.resolve();
  }, []);

  // Minimax calculation is synchronous within an async wrapper, so we can't truly cancel it mid-calculation
  // without a more complex worker setup. This is a placeholder.
  const cancelCalculation = useCallback(() => {
    // No-op
  }, []);

  const calculateBestMove = useCallback(
    async (
      board: Board,
      playerColor: 'white' | 'black',
      skillLevel: number,
      lastMove: LastMove | null,
      castlingAvailability: any,
      halfmoveClock: number,
      fullmoveNumber: number,
      // Points game data
      isPointsGame?: boolean,
      playerScores?: number[],
      targetScore?: number,
      currentPlayerIndex?: number,
      // Time data
      remainingTime?: number,
      // Game mode
      gameMode?: 'rotating' | 'random' | 'normie',
      // AI behavior
      enableRandomness?: boolean,
      // Move history
      moveHistory?: { from: string; to: string }[]
    ): Promise<Move | null> => {
      setIsAILoading(true);

      return new Promise((resolve) => {
        setTimeout(() => {
          try {
            // Map skill level (0-20) to a search depth (e.g., 1-4)
            // Cap at 4 to prevent performance issues
            let searchDepth = Math.max(1, Math.min(Math.floor(skillLevel / 5), 4));

            // ===== ADVANCED TIME MANAGEMENT =====
            if (remainingTime !== undefined && remainingTime > 0) {
              // Estimate moves remaining in game
              // Early game: ~40 moves, mid game: ~20 moves, endgame: ~10 moves
              // Use move history length as proxy for game phase
              const movesPlayed = moveHistory?.length || 0;
              let estimatedMovesRemaining: number;

              if (movesPlayed < 10) {
                estimatedMovesRemaining = 40; // Opening
              } else if (movesPlayed < 30) {
                estimatedMovesRemaining = 25; // Middlegame
              } else {
                estimatedMovesRemaining = Math.max(10, 50 - movesPlayed); // Endgame
              }

              // Calculate time allocation for this move
              // Use more time in critical positions, less in simple positions
              const baseTimePerMove = remainingTime / estimatedMovesRemaining;

              // Adjust depth based on time budget
              if (remainingTime < 15) {
                // Critical low time: fast moves only
                searchDepth = 1;
                console.log(`[Time Management] Critical time (${remainingTime}s) - depth 1`);
              } else if (remainingTime < 30) {
                // Low time: shallow search
                searchDepth = Math.min(searchDepth, 2);
                console.log(`[Time Management] Low time (${remainingTime}s) - depth 2`);
              } else if (remainingTime < 60) {
                // Moderate time: balanced
                searchDepth = Math.min(searchDepth, 3);
                console.log(`[Time Management] Moderate time (${remainingTime}s) - depth 3`);
              } else if (remainingTime > 180 && baseTimePerMove > 5) {
                // Plenty of time: deep search (but cap at 4)
                searchDepth = Math.min(searchDepth + 1, 4);
                console.log(`[Time Management] Plenty of time (${remainingTime}s) - depth ${searchDepth}`);
              } else {
                // Normal time: use skill-based depth
                console.log(`[Time Management] Normal time (${remainingTime}s) - depth ${searchDepth}`);
              }
            } else {
              console.log(`[Time Management] Untimed game - depth ${searchDepth}`);
            }

            // Check opening book first
            console.log(`[AI] Move history length: ${moveHistory?.length || 0}`);
            if (moveHistory && moveHistory.length <= 6) {
              console.log(`[AI] Checking opening book...`);
              const algebraicHistory = movesToAlgebraic(moveHistory);
              const bookMove = getBookMove(algebraicHistory, enableRandomness);

              if (bookMove) {
                console.log(`[AI] Book move found: ${bookMove.from}→${bookMove.to}`);
                const validMoves = generateAllValidMoves(board, playerColor, lastMove);
                const isLegal = validMoves.some(
                  m => m.from === bookMove.from && m.to === bookMove.to
                );

                if (isLegal) {
                  console.log(`[Opening Book] ✅ Using ${bookMove.name || bookMove.from + bookMove.to}`);
                  setIsAILoading(false);
                  resolve(bookMove);
                  return;
                } else {
                  console.log(`[AI] Book move illegal, falling through to search`);
                }
              } else {
                console.log(`[AI] No book move found, falling through to search`);
              }
            } else {
              console.log(`[AI] Beyond opening book (${moveHistory?.length} moves), using search`);
            }

            // Use parallel workers for deeper searches (depth >= 3)
            if (useParallel && searchDepth >= 3) {
              console.log(`[AI] 🔀 PARALLEL search at depth ${searchDepth}`);

              const validMoves = generateAllValidMoves(board, playerColor, lastMove);

              if (validMoves.length === 0) {
                setIsAILoading(false);
                resolve(null);
                return;
              }

              if (validMoves.length === 1) {
                setIsAILoading(false);
                resolve(validMoves[0]);
                return;
              }

              // Parallel evaluation
              console.log(`[AI] Calling evaluateMovesParallel with ${validMoves.length} moves...`);
              const parallelPromise = getWorkerPool().evaluateMovesParallel(
                validMoves,
                board,
                playerColor,
                lastMove,
                searchDepth,
                gameMode,
                isPointsGame,
                playerScores,
                targetScore,
                currentPlayerIndex
              );
              console.log(`[AI] Promise created, waiting for results...`);

              parallelPromise.then((movesWithScores) => {
                console.log(`[AI] Received ${movesWithScores.length} evaluated moves from workers`);

                // Sort by score (best first)
                movesWithScores.sort((a, b) => b.score - a.score);

                const bestScore = movesWithScores[0].score;
                console.log(`[AI] Best move: ${movesWithScores[0].move.from}→${movesWithScores[0].move.to} (score: ${bestScore.toFixed(2)})`);

                // Apply randomness if enabled
                if (enableRandomness) {
                  const threshold = 1.0;
                  const goodMoves = movesWithScores.filter(m => m.score >= bestScore - threshold);
                  console.log(`[AI] ${goodMoves.length} good moves within ${threshold} of best`);

                  const weights = goodMoves.map((_, index) => index === 0 ? 2.0 : 1.0);
                  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

                  let random = Math.random() * totalWeight;
                  for (let i = 0; i < goodMoves.length; i++) {
                    random -= weights[i];
                    if (random <= 0) {
                      console.log(`[AI] ✅ Selected move ${i + 1}/${goodMoves.length}: ${goodMoves[i].move.from}→${goodMoves[i].move.to}`);
                      setIsAILoading(false);
                      resolve(goodMoves[i].move);
                      return;
                    }
                  }
                }

                // Return best move
                console.log(`[AI] ✅ Returning best move: ${movesWithScores[0].move.from}→${movesWithScores[0].move.to}`);
                setIsAILoading(false);
                resolve(movesWithScores[0].move);
              }).catch((error) => {
                console.error('[AI] ❌ Parallel worker error:', error);
                console.error('[Parallel] Worker error, falling back to sequential:', error);
                // Fallback to sequential
                const bestMove = findBestMove(
                  board,
                  playerColor,
                  lastMove,
                  searchDepth,
                  isPointsGame,
                  playerScores,
                  targetScore,
                  currentPlayerIndex,
                  gameMode,
                  enableRandomness,
                  moveHistory
                );
                setIsAILoading(false);
                resolve(bestMove);
              });
            } else {
              // Sequential evaluation (original code)
              console.log(`[AI] 📊 SEQUENTIAL search at depth ${searchDepth}`);
              const sequentialStartTime = performance.now();
              const bestMove = findBestMove(
                board,
                playerColor,
                lastMove,
                searchDepth,
                isPointsGame,
                playerScores,
                targetScore,
                currentPlayerIndex,
                gameMode,
                enableRandomness,
                moveHistory
              );
              const sequentialTime = performance.now() - sequentialStartTime;
              console.log(`[AI] ✅ Sequential completed in ${sequentialTime.toFixed(0)}ms`);
              setIsAILoading(false);
              resolve(bestMove);
            }
          } catch (e: unknown) {
            console.error('Error in Minimax calculation:', e);
            setAIError((e as Error).message);
            setIsAILoading(false);
            resolve(null);
          }
        }, 50);
      });
    },
    []
  );

  return {
    isAILoading,
    aiError,
    loadAI,
    calculateBestMove,
    cancelCalculation,
  };
};