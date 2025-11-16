import { useState, useCallback, useRef } from 'react';
import { useGameEngine } from './useGameEngine';
import type { GameStartData, MoveMadeData } from './useGameEngine';
import { useNetworkAdapter } from './useNetworkAdapter';

interface ChatMessage {
  playerName: string;
  message: string;
  timestamp: number;
  isOwn?: boolean;
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
  const gameActionsRef = useRef<any>(null);

  const handlePeerMessage = useCallback((message: NetworkMessage) => {
    const actions = gameActionsRef.current;
    if (!actions) return;

    switch (message.type) {
      case 'CONNECTION_ERROR':
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

  gameActionsRef.current = gameActions;

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
    if (playMode === 'local') return true;
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
    if (isMyTurn()) {
      gameActions.makeMove(row, col);
    }
  };

  const resetGame = () => {
    gameActions.setGameState('setup');
    setPlayMode('local');
    network.resetConnection();
  }

  return {
    // State
    game,
    network,
    playMode,
    chatMessages,
    connectionError,

    // Actions
    setPlayMode,
    setConnectionError,
    sendChatMessage,
    handleUpdatePlayerName,
    handleSquareClick,
    isMyTurn,
    resetGame,

    // Pass-through game actions
    gameActions,
  };
};
