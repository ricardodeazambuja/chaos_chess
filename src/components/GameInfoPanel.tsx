import React from 'react';
import { RotateCcw } from 'lucide-react';

const GameInfoPanel = ({
  players,
  gameMode,
  currentPlayerIndex,
  getPlayerColor,
  playerMoveCount,
  capturedPieces,
  getPieceSymbol,
  getPieceStyle,
  setGameState,
  setWinner,
  setMoveHistory,
  setSelectedSquare,
  setValidMoves,
  peerConnectionRef,
  dataChannel,
  setPlayMode,
  setNetworkRole,
  setDataChannel,
  setIsConnected,
  setConnectionOffer,
  setConnectionAnswer,
  moveHistory,
}) => {
  const handleNewGame = () => {
    setGameState('setup');
    setWinner(null);
    setMoveHistory([]);
    setSelectedSquare(null);
    setValidMoves([]);
    // Reset network state
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (dataChannel) {
      dataChannel.close();
    }
    setPlayMode('local');
    setNetworkRole(null);
    peerConnectionRef.current = null;
    setDataChannel(null);
    setIsConnected(false);
    setConnectionOffer('');
    setConnectionAnswer('');
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 min-w-[280px]">
      <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <RotateCcw size={20} />
        Players {gameMode === 'normie' ? '♖' : gameMode === 'random' ? '🎲' : '🔄'}
      </h3>
      <div className="space-y-2 mb-6">
        {players.map((player, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg ${
              index === currentPlayerIndex 
                ? 'bg-amber-100 border-2 border-amber-500' 
                : 'bg-slate-100'
            }`}
          >
            <div className="font-semibold">{player.name}</div>
            <div className="text-sm text-slate-600">
              {gameMode === 'normie'
                ? `Playing as ${getPlayerColor(index, 0)}`
                : gameMode === 'random' 
                  ? (index === currentPlayerIndex ? `Playing: ${getPlayerColor(index, playerMoveCount[index] || 0)}` : '? Random ?')
                  : `Next plays: ${getPlayerColor(index, playerMoveCount[index] || 0)}`
              }
              {index === currentPlayerIndex && gameMode !== 'random' && ' (playing now)'}
            </div>
          </div>
        ))}
      </div>

      {/* Captured Pieces Display */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Captured Pieces</h3>
        <div className="space-y-2">
          <div className="bg-slate-50 p-2 rounded">
            <div className="text-xs font-semibold text-slate-600 mb-1">White captured:</div>
            <div className="flex flex-wrap gap-1">
              {capturedPieces.white.length > 0 ? (
                capturedPieces.white.map((pieceType, index) => (
                  <span key={index} className="text-2xl" style={getPieceStyle('black')}>
                    {getPieceSymbol({ type: pieceType, color: 'black' })}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">None</span>
              )}
            </div>
          </div>
          <div className="bg-slate-50 p-2 rounded">
            <div className="text-xs font-semibold text-slate-600 mb-1">Black captured:</div>
            <div className="flex flex-wrap gap-1">
              {capturedPieces.black.length > 0 ? (
                capturedPieces.black.map((pieceType, index) => (
                  <span key={index} className="text-2xl" style={getPieceStyle('white')}>
                    {getPieceSymbol({ type: pieceType, color: 'white' })}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">None</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleNewGame}
        className="w-full mb-6 px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 flex items-center justify-center gap-2"
      >
        <RotateCcw size={18} />
        New Game
      </button>

      <h3 className="text-lg font-bold text-slate-800 mb-2">Recent Moves</h3>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {moveHistory.slice(-10).reverse().map((move, index) => (
          <div key={index} className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
            <span className="font-semibold">{move.player}</span> ({move.color}): {move.piece} {move.from} → {move.to}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameInfoPanel;