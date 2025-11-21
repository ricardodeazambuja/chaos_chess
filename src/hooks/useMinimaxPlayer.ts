import { useState, useCallback } from 'react';
import type { Board, Move, LastMove } from '../chess-logic';
import { findBestMove } from '../ai/minimax';
import { transpositionTable } from '../ai/transposition-table';
import type { AIPlayer } from './useAI';

export const useMinimaxPlayer = (): AIPlayer => {
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [aiError, setAIError] = useState<string | null>(null);

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