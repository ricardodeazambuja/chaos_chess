import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameEngine } from './useGameEngine';
import type { GameStartData, MoveMadeData } from './useGameEngine';
import { useNetworkAdapter } from './useNetworkAdapter';
import { useMinimaxPlayer } from './useMinimaxPlayer'; // Import the Minimax AI player hook
import type { Piece } from '../chess-logic';
import { fromAlgebraic } from '../chess-logic';

interface ChatMessage {
  playerName: string;
  message: string;
  timestamp: number;
  isOwn?: boolean;
}

interface GameActions {
  setGameState: (state: 'setup' | 'playing' | 'promoting' | 'finished') => void;
  setPlayers: (players: { name: string }[]) => void;
  setGameMode: (mode: 'rotating' | 'random' | 'normie') => void;
  setIsTimedGame: (isTimed: boolean) => void;
  setTimeSetting: (time: number) => void;
  setIsPointsGame: (isPoints: boolean) => void;
  setTargetScore: (score: number) => void;
  addPlayer: () => void;
  removePlayer: (index: number) => void;
  updatePlayerName: (index: number, name: string) => void;
  startGame: () => void;
  makeMove: (row: number, col: number, toRow?: number, toCol?: number) => void;
  promotePawn: (pieceType: Piece['type']) => void;
  getPlayerColor: (index: number, moveCount: number) => 'white' | 'black';
  receiveNetworkGameStart: (data: GameStartData) => void;
  receiveNetworkMove: (data: MoveMadeData) => void;
}

interface ConnectionErrorMessage {
  type: 'CONNECTION_ERROR';
  error: string;
}

interface PlayerNameUpdateMessage {
  type: 'PLAYER_NAME_UPDATE';
  playerName: string;
}

interface ChatNetworkMessage {
  type: 'CHAT_MESSAGE';
  playerName: string;
  message: string;
  timestamp: number;
}

interface GameStartNetworkMessage extends GameStartData {
  type: 'GAME_START';
}

interface MoveMadeNetworkMessage extends MoveMadeData {
  type: 'MOVE_MADE';
}

interface GameOverNetworkMessage extends MoveMadeData {
  type: 'GAME_OVER';
}

type NetworkMessage =
  | ConnectionErrorMessage
  | PlayerNameUpdateMessage
  | ChatNetworkMessage
  | GameStartNetworkMessage
  | MoveMadeNetworkMessage
  | GameOverNetworkMessage;

export const useGameManager = () => {
  const [playMode, setPlayMode] = useState<'local' | 'network'>('local');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMidGameDisconnect, setIsMidGameDisconnect] = useState<boolean>(false);
  const gameActionsRef = useRef<GameActions | null>(null);

  // Guard to prevent multiple concurrent AI turns (fixes AI vs AI glitch)
  const isAIThinkingRef = useRef(false);

  const { isAILoading, aiError, calculateBestMove, cancelCalculation, loadAI } = useMinimaxPlayer();

  const handlePeerMessage = useCallback((message: NetworkMessage) => {
    const actions = gameActionsRef.current;
    if (!actions) return;

    switch (message.type) {
      case 'CONNECTION_ERROR':
        // Check if this is a mid-game disconnection
        if (message.wasMidGame) {
          setIsMidGameDisconnect(true);
        }
        setConnectionError(message.error);
        break;
      case 'PLAYER_NAME_UPDATE':
        actions.updatePlayerName(1, message.playerName);
        break;
      case 'CHAT_MESSAGE':
        setChatMessages(prev => [...prev, { ...message, isOwn: false }]);
        break;
      case 'GAME_START':
        actions.receiveNetworkGameStart(message);
        break;
      case 'GAME_OVER':
        actions.receiveNetworkMove(message);
        break;
      case 'MOVE_MADE':
        actions.receiveNetworkMove(message);
        break;
    }
  }, []);

  const network = useNetworkAdapter({ onMessage: handlePeerMessage });

  const {
    state: game,
    actions: gameActions,
  } = useGameEngine({
    onGameStart: (startData: GameStartData) => {
      if (playMode === 'network' && network.networkRole === 'host') {
        network.broadcastMove({ type: 'GAME_START', ...startData });
      }
    },
    onMoveMade: (moveData: MoveMadeData) => {
      if (playMode === 'network') {
        network.broadcastMove({ type: 'MOVE_MADE', ...moveData });
      }
    },
    onGameOver: (gameOverData: { winner: { name: string, reason: string } | null }) => {
      if (playMode === 'network') {
        network.broadcastMove({ type: 'GAME_OVER', ...gameOverData });
      }
    },
  });

  // Update ref in effect to avoid accessing ref during render
  useEffect(() => {
    gameActionsRef.current = gameActions;
  }, [gameActions]);

  // Monitor for mid-game disconnection
  useEffect(() => {
    // Detect when connection drops during active gameplay
    if (playMode === 'network' && game.gameState === 'playing') {
      if (!network.isConnected && !isMidGameDisconnect) {
        setIsMidGameDisconnect(true);
        setConnectionError('Your opponent has disconnected or lost connection.');
      }
    }

    // Clear disconnect flag when game returns to setup
    if (game.gameState === 'setup') {
      setIsMidGameDisconnect(false);
      setConnectionError(null);
    }

    // Handle reconnection during "waiting" period
    if (isMidGameDisconnect && network.isConnected && game.gameState === 'playing') {
      setIsMidGameDisconnect(false);
      setConnectionError(null);
      // Notify via chat that opponent reconnected
      setChatMessages(prev => [...prev, {
        playerName: 'System',
        message: '✅ Opponent reconnected!',
        timestamp: Date.now(),
        isOwn: false
      }]);
    }
  }, [playMode, game.gameState, network.isConnected, isMidGameDisconnect]);

  // AI Logic - automatically play moves for AI players with visual feedback
  useEffect(() => {
    const playAITurn = async () => {
      const currentPlayer = game.players[game.currentPlayerIndex];

      // Guard: Prevent multiple concurrent AI turns (fixes AI vs AI race condition)
      if (currentPlayer?.isAI && game.gameState === 'playing' && !isAIThinkingRef.current) {
        isAIThinkingRef.current = true; // Lock to prevent re-entry

        try {
          // Get the correct color for the AI based on the game mode (normie, rotating, random)
          const aiPlayerColor = gameActions.getPlayerColor(
            game.currentPlayerIndex,
            game.playerMoveCount[game.currentPlayerIndex] || 0
          );
          const skillLevel = 10; // Can be customized per player in the future

          const move = await calculateBestMove(
            game.board,
            aiPlayerColor,
            skillLevel,
            game.lastMove,
            game.castlingAvailability,
            game.halfmoveClock,
            game.fullmoveNumber,
            // Points game data
            game.isPointsGame,
            game.playerScores,
            game.targetScore,
            game.currentPlayerIndex,
            // Time data (remaining time for current AI player)
            game.isTimedGame ? game.playerTimes[game.currentPlayerIndex] : undefined,
            // Game mode
            game.gameMode
          );

          if (move) {
            const fromCoords = fromAlgebraic(move.from);
            const toCoords = fromAlgebraic(move.to);

            // Phase 1: Show which piece the AI is selecting (1.5s)
            gameActions.makeMove(fromCoords.row, fromCoords.col);
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Phase 2: Show where the AI is moving to (1.5s)
            // The piece is already selected, so valid moves are shown
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Phase 3: Execute the move
            const from = game.board[fromCoords.row][fromCoords.col];
            if (from && from.type === 'pawn' && (toCoords.row === 0 || toCoords.row === 7)) {
              gameActions.promotePawn('queen');
            }
            gameActions.makeMove(fromCoords.row, fromCoords.col, toCoords.row, toCoords.col);
          }
        } finally {
          // Always unlock, even if an error occurs
          isAIThinkingRef.current = false;
        }
      }
    };

    playAITurn();
  }, [game.gameState, game.currentPlayerIndex, game.players, calculateBestMove, game.board, game.lastMove, game.castlingAvailability, game.halfmoveClock, game.fullmoveNumber, game.playerMoveCount, gameActions]);

  const startGame = async () => {
    // AI is always ready (no loading needed for Minimax)
    gameActions.startGame();
  };

  const sendChatMessage = (message: string) => {
    if (playMode === 'network') {
      const myPlayerIndex = network.networkRole === 'host' ? 0 : 1;
      const chatMsg: ChatMessage = {
        playerName: game.players[myPlayerIndex]?.name || `Player ${myPlayerIndex + 1}`,
        message,
        timestamp: Date.now(),
        isOwn: true,
      };
      setChatMessages(prev => [...prev, chatMsg]);
      network.broadcastMove({
        type: 'CHAT_MESSAGE',
        playerName: chatMsg.playerName,
        message: chatMsg.message,
        timestamp: chatMsg.timestamp,
      });
    }
  };

  const isMyTurn = (): boolean => {
    if (playMode === 'local') {
      return true;
    }
    // In network mode, check if it's my player index
    const myPlayerIndex = network.networkRole === 'host' ? 0 : 1;
    return game.currentPlayerIndex === myPlayerIndex;
  };

  const handleUpdatePlayerName = (index: number, name: string) => {
    gameActions.updatePlayerName(index, name);
    if (playMode === 'network' && network.networkRole === 'guest' && index === 1) {
      network.broadcastMove({ type: 'PLAYER_NAME_UPDATE', playerName: name });
    }
  };

  const handleSquareClick = (row: number, col: number) => {
    // Block moves if disconnected mid-game
    if (isMidGameDisconnect) return;

    if (isMyTurn()) {
      gameActions.makeMove(row, col);
    }
  };

  const resetGame = () => {
    gameActions.setGameState('setup');
    setPlayMode('local');
    setIsMidGameDisconnect(false);
    setConnectionError(null);
    network.resetConnection();
    // Note: cancelCalculation is a no-op for Minimax, but keeping for interface compatibility
    cancelCalculation();
  }

  const clearDisconnectState = () => {
    setIsMidGameDisconnect(false);
    setConnectionError(null);
  };

  return {
    // State
    game,
    network,
    playMode,
    chatMessages,
    connectionError,
    isMidGameDisconnect,

    // Actions
    setPlayMode,
    setConnectionError,
    sendChatMessage,
    handleUpdatePlayerName,
    handleSquareClick,
    isMyTurn,
    resetGame,
    clearDisconnectState,
    startGame,

    // Pass-through game actions
    gameActions,
  };
};
