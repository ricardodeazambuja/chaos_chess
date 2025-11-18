import { useState, useRef, useCallback } from 'react';
import type { Board, Move, LastMove } from '../chess-logic';
import { boardToFen, toAlgebraic } from '../chess-logic';

// Define the interface for the Stockfish worker
interface StockfishWorker extends Worker {
  onmessage: ((this: Worker, ev: MessageEvent) => any) | null;
  postMessage(message: string): void;
}

interface UseAIPlayer {
  isAILoading: boolean;
  aiError: string | null;
  loadAI: () => Promise<void>;
  calculateBestMove: (board: Board, playerColor: 'white' | 'black', skillLevel: number, lastMove: LastMove | null, castlingAvailability: any, halfmoveClock: number, fullmoveNumber: number) => Promise<Move | null>;
  cancelCalculation: () => void;
}

export const useAIPlayer = (): UseAIPlayer => {
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const workerRef = useRef<StockfishWorker | null>(null);
  const resolveMoveRef = useRef<((move: Move | null) => void) | null>(null);

  const loadAI = useCallback(async () => {
    if (workerRef.current) return;

    setIsAILoading(true);
    setAIError(null);

    try {
      const StockfishWorker = (await import('stockfish/src/stockfish-17.1-single-a496a04.js?worker')).default;
      const worker = new StockfishWorker();
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const message = event.data;
        console.log('Stockfish message:', message);

        if (message === 'uciok') {
          worker.postMessage('isready');
        } else if (message === 'readyok') {
          setIsAILoading(false);
        } else if (message.startsWith('bestmove')) {
          const moveString = message.split(' ')[1];
          if (resolveMoveRef.current) {
            const from = moveString.substring(0, 2);
            const to = moveString.substring(2, 4);
            const promotion = moveString.length > 4 ? moveString.substring(4, 5) : undefined;

            resolveMoveRef.current({ from, to, promotion });
            resolveMoveRef.current = null;
          }
        }
      };

      worker.onerror = (error) => {
        console.error('Stockfish Worker Error:', error);
        setAIError(`Failed to load AI engine: ${JSON.stringify(error)}`);
        setIsAILoading(false);
      };

      worker.postMessage('uci'); // Initialize UCI protocol

    } catch (e: any) {
      console.error('Error initializing Stockfish worker:', e);
      setAIError(`Failed to initialize AI engine: ${e.message}`);
      setIsAILoading(false);
    }
  }, []);

  const calculateBestMove = useCallback(
    async (board: Board, playerColor: 'white' | 'black', skillLevel: number, lastMove: LastMove | null, castlingAvailability: any, halfmoveClock: number, fullmoveNumber: number): Promise<Move | null> => {
      if (!workerRef.current) {
        await loadAI();
      }
      
      return new Promise((resolve) => {
        if (!workerRef.current || isAILoading || aiError) {
          resolve(null);
          return;
        }

        resolveMoveRef.current = resolve;

        // Set skill level (0-20)
        workerRef.current.postMessage(`setoption name Skill Level value ${skillLevel}`);
        
        // Set current board position
        const fen = boardToFen(board, playerColor, castlingAvailability, lastMove ? toAlgebraic(lastMove.toRow, lastMove.toCol) : null, halfmoveClock, fullmoveNumber);
        workerRef.current.postMessage(`position fen ${fen}`);
        
        // Start thinking for a move
        workerRef.current.postMessage('go movetime 1000'); // Think for 1 second
      });
    },
    [isAILoading, aiError, loadAI]
  );

  const cancelCalculation = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage('stop');
      if (resolveMoveRef.current) {
        resolveMoveRef.current(null);
        resolveMoveRef.current = null;
      }
    }
  }, []);

  return {
    isAILoading,
    aiError,
    loadAI,
    calculateBestMove,
    cancelCalculation,
  };
};
