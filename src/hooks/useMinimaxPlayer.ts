import { useState, useCallback } from 'react';
import type { Board, Move, LastMove } from '../chess-logic';
import { findBestMove } from '../ai/minimax';
import type { AIPlayer } from './useAI';

export const useMinimaxPlayer = (): AIPlayer => {
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [aiError, setAIError] = useState<string | null>(null);

  // Minimax is self-contained; no actual loading is needed.
  const loadAI = useCallback(async () => {
    setAIError(null);
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
      gameMode?: 'rotating' | 'random' | 'normie'
    ): Promise<Move | null> => {
      setIsAILoading(true);

      return new Promise((resolve) => {
        setTimeout(() => {
          try {
            // Map skill level (0-20) to a search depth (e.g., 1-4)
            let searchDepth = Math.max(1, Math.floor(skillLevel / 5));

            // Adjust depth based on remaining time (if timed game)
            if (remainingTime !== undefined) {
              if (remainingTime < 30) {
                searchDepth = Math.min(searchDepth, 2); // Fast moves when low on time
              } else if (remainingTime > 120) {
                searchDepth = Math.min(searchDepth + 1, 5); // Deeper search with plenty of time
              }
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
              gameMode
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