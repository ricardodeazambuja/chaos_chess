import React from 'react';
import { Crown } from 'lucide-react';
import SetupScreen from './components/SetupScreen';
import PromotionModal from './components/PromotionModal';
import ChessBoard from './components/ChessBoard';
import GameInfoPanel from './components/GameInfoPanel';
import ChatBox from './components/ChatBox';
import ConnectionError from './components/ConnectionError';
import DisconnectionModal from './components/DisconnectionModal';
import { useGameManager } from './hooks/useGameManager';
import { getPieceSymbol, getPieceStyle } from './chess-logic';

const formatTime = (seconds: number): string => {
  if (seconds === undefined || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const ChaosChess = () => {
  const {
    game,
    network,
    playMode,
    chatMessages,
    connectionError,
    isMidGameDisconnect,
    setPlayMode,
    setConnectionError,
    sendChatMessage,
    handleUpdatePlayerName,
    handleSquareClick,
    isMyTurn,
    resetGame,
    clearDisconnectState,
    gameActions,
  } = useGameManager();

  if (game.gameState === 'setup') {
    return (
      <>
        <SetupScreen
          players={game.players}
          setPlayers={gameActions.setPlayers}
          gameMode={game.gameMode}
          setGameMode={gameActions.setGameMode}
          isTimedGame={game.isTimedGame}
          setIsTimedGame={gameActions.setIsTimedGame}
          timeSetting={game.timeSetting}
          setTimeSetting={gameActions.setTimeSetting}
          isPointsGame={game.isPointsGame}
          setIsPointsGame={gameActions.setIsPointsGame}
          targetScore={game.targetScore}
          setTargetScore={gameActions.setTargetScore}
          playMode={playMode}
          setPlayMode={setPlayMode}
          isLoading={network.isLoading}
          countdown={network.countdown}
          networkRole={network.networkRole}
          setNetworkRole={network.setNetworkRole}
          createHostConnection={network.createHostConnection}
          createGuestConnection={network.createGuestConnection}
          hostOfferInput={network.hostOfferInput}
          setHostOfferInput={network.setHostOfferInput}
          guestAnswerInput={network.guestAnswerInput}
          setGuestAnswerInput={network.setGuestAnswerInput}
          connectionOffer={network.connectionOffer}
          isConnected={network.isConnected}
          setIsConnected={network.setIsConnected}
          connectionMessage={network.connectionMessage}
          connectionAnswer={network.connectionAnswer}
          acceptGuestAnswer={network.acceptGuestAnswer}
          startGame={gameActions.startGame}
          addPlayer={gameActions.addPlayer}
          removePlayer={gameActions.removePlayer}
          updatePlayerName={handleUpdatePlayerName}
        />
        {connectionError && (
          <ConnectionError
            message={connectionError}
            onDismiss={() => {
              setConnectionError(null);
              network.clearInputsAndError();
            }}
            onRetry={() => {
              setConnectionError(null);
              resetGame();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 relative">
      {game.gameState === 'promoting' && (
        <PromotionModal
          handlePromotionChoice={gameActions.promotePawn}
          promotionSquare={game.promotionSquare}
          getPieceStyle={getPieceStyle}
          getPieceSymbol={getPieceSymbol}
        />
      )}
      {connectionError && (
        <ConnectionError
          message={connectionError}
          onDismiss={() => {
            setConnectionError(null);
            network.clearInputsAndError();
          }}
          onRetry={() => {
            setConnectionError(null);
            resetGame();
          }}
        />
      )}

      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Crown className="text-amber-400" size={36} />
            Chaos Chess
          </h1>
          {playMode === 'network' && (
            <div className={`text-sm font-semibold ${
              network.isConnected ? 'text-green-400' :
              isMidGameDisconnect ? 'text-red-400 animate-pulse' : 'text-amber-300'
            }`}>
              {network.isConnected ? '🟢' : isMidGameDisconnect ? '🔴' : '🟡'}
              {' '}Network Game - {network.networkRole === 'host' ? 'Host' : 'Guest'}
              {' '}{network.isConnected ? '(Connected)' :
                   isMidGameDisconnect ? '(DISCONNECTED)' : '(Connecting...)'}
            </div>
          )}
          
          {game.winner ? (
            <div className="text-2xl font-bold text-amber-400 mb-4">
              {game.winner.name === 'Draw'
                ? `🤝 Draw by ${game.winner.reason}! 🤝`
                : `🏆 ${game.winner.name} wins by ${game.winner.reason}! 🏆`
              }
            </div>
          ) : (
            <div className="text-xl text-white">
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-amber-400">{game.players[game.currentPlayerIndex].name}</span>
                <span>playing</span>
                <span className={gameActions.getPlayerColor(game.currentPlayerIndex, game.playerMoveCount[game.currentPlayerIndex] || 0) === 'white' ? 'text-white font-bold' : 'text-slate-400 font-bold'}>
                  {gameActions.getPlayerColor(game.currentPlayerIndex, game.playerMoveCount[game.currentPlayerIndex] || 0)}
                </span>
              </div>
              {game.inCheck && (
                <div className="mt-2 text-red-500 font-bold text-xl animate-pulse bg-red-950 px-4 py-2 rounded-lg border-2 border-red-500">
                  ⚠️ CHECK! ⚠️
                </div>
              )}
              {playMode === 'network' && (
                <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-semibold ${
                  isMyTurn()
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-slate-300'
                }`}>
                  {isMyTurn() ? '✓ Your Turn - Make a Move!' : '⏳ Waiting for Opponent...'}
                </div>
              )}
            </div>
          )}
        </div>

        {game.isTimedGame && (
          <div className="flex justify-center gap-4 mb-4">
            {game.players.map((player, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-center w-32 ${
                  index === game.currentPlayerIndex ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-sm truncate">{player.name}</div>
                <div className="font-mono text-2xl font-bold">{formatTime(game.playerTimes[index])}</div>
              </div>
            ))}
          </div>
        )}

        {game.isPointsGame && (
          <div className="flex justify-center gap-4 mb-4">
            {game.players.map((player, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-center w-32 ${
                  index === game.currentPlayerIndex ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-sm truncate">{player.name}</div>
                <div className="font-mono text-2xl font-bold">{game.playerScores[index]} pts</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-center lg:items-start justify-center w-full">
          {/* Chess Board with Disconnection Overlay */}
          <div className="relative w-full max-w-2xl">
            <ChessBoard
              board={game.board}
              selectedSquare={game.selectedSquare}
              validMoves={game.validMoves}
              singleMove={game.singleMove}
              handleSquareClick={handleSquareClick}
              getPieceStyle={getPieceStyle}
              getPieceSymbol={getPieceSymbol}
            />

            {/* Overlay shown when disconnected mid-game */}
            {isMidGameDisconnect && (
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center pointer-events-none z-10 rounded-xl">
                <div className="bg-yellow-500 text-slate-900 px-6 py-3 rounded-lg font-bold text-base sm:text-lg shadow-lg">
                  ⚠️ Connection Lost - Waiting for opponent...
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:gap-6 w-full lg:w-auto">
            <GameInfoPanel
              players={game.players}
              gameMode={game.gameMode}
              currentPlayerIndex={game.currentPlayerIndex}
              getPlayerColor={(idx, count) => gameActions.getPlayerColor(idx, count)}
              playerMoveCount={game.playerMoveCount}
              capturedPieces={game.capturedPieces}
              getPieceSymbol={getPieceSymbol}
              getPieceStyle={getPieceStyle}
              setGameState={gameActions.setGameState}
              setPlayMode={setPlayMode}
              resetConnection={network.resetConnection}
              moveHistory={game.moveHistory}
            />

            {playMode === 'network' && (
              <div className="w-full lg:w-80 h-64 sm:h-96">
                <ChatBox
                  messages={chatMessages}
                  onSendMessage={sendChatMessage}
                  playerName={game.players[network.networkRole === 'host' ? 0 : 1]?.name || 'Player'}
                  disabled={!network.isConnected}
                />
              </div>
            )}
          </div>
        </div>

        {/* Disconnection Modal - shown when opponent disconnects mid-game */}
        <DisconnectionModal
          isOpen={isMidGameDisconnect}
          onReturnToSetup={() => {
            resetGame();
            clearDisconnectState();
          }}
        />
      </div>
    </div>
  );
};

export default ChaosChess;