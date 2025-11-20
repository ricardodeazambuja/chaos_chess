import type { Board, Move, LastMove } from '../chess-logic';

export interface AIPlayer {
  isAILoading: boolean;
  aiError: string | null;
  loadAI: () => Promise<void>;
  calculateBestMove: (
    board: Board,
    playerColor: 'white' | 'black',
    skillLevel: number,
    lastMove: LastMove | null,
    castlingAvailability: {
      whiteKingSide: boolean;
      whiteQueenSide: boolean;
      blackKingSide: boolean;
      blackQueenSide: boolean;
    },
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
  ) => Promise<Move | null>;
  cancelCalculation: () => void;
}
