import React from 'react';
import { Crown, Users, RotateCcw, Clock, DollarSign } from 'lucide-react';
import ConnectionImage from './ConnectionImage';
import ImageUploader from './ImageUploader';

const SetupScreen = ({
  players,
  setPlayers,
  gameMode,
  setGameMode,
  isTimedGame,
  setIsTimedGame,
  timeSetting,
  setTimeSetting,
  isPointsGame,
  setIsPointsGame,
  targetScore,
  setTargetScore,
  playMode,
  setPlayMode,
  networkRole,
  setNetworkRole,
  createHostConnection,
  createGuestConnection,
  hostOfferInput,
  setHostOfferInput,
  guestAnswerInput, // Add this line
  setGuestAnswerInput, // Add this line
  connectionOffer,
  isConnected,
  connectionMessage,
  connectionAnswer,
  acceptGuestAnswer, // Add this line
  startGame,
  addPlayer,
  removePlayer,
  updatePlayerName,
  setIsConnected,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-center mb-4 sm:mb-6">
          <Crown className="text-amber-500 mr-2" size={28} />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 truncate">Chaos Chess</h1>
        </div>

        <p className="text-slate-600 mb-4 sm:mb-6 text-center text-sm sm:text-base">
          Choose your madness! First to checkmate wins!
        </p>
        
        {/* Play Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">Play Mode</label>
          <div className="space-y-2">
            <button
              onClick={() => {
                setPlayMode('local');
                setNetworkRole(null);
                setIsConnected(false);
              }}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                playMode === 'local' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-300 bg-white hover:border-blue-300'
              }`}
            >
              <div className="font-bold text-slate-800">🏠 Local Game</div>
              <div className="text-sm text-slate-600">Play on this device</div>
            </button>
            <button
              onClick={() => setPlayMode('network')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                playMode === 'network' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-300 bg-white hover:border-blue-300'
              }`}
            >
              <div className="font-bold text-slate-800">🌐 Network Game</div>
              <div className="text-sm text-slate-600">Play with friends online (WebRTC P2P)</div>
            </button>
          </div>
        </div>
        
        {/* Network Setup */}
        {playMode === 'network' && !networkRole && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 space-y-4">
            <h3 className="font-bold text-slate-800">Choose Your Role</h3>

            <button
              onClick={createHostConnection}
              className="w-full px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600"
            >
              🎮 Host Game
            </button>

            <div className="text-center text-sm text-slate-600 font-bold">OR</div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">Join as Guest</h4>

              {/* Image Upload Option */}
              <ImageUploader
                onHashExtracted={(hash) => setHostOfferInput(hash)}
                label="📸 Option 1: Upload Host's Image"
              />

              {/* Text Option */}
              <div className="pt-4 border-t border-blue-200">
                <h4 className="font-bold text-slate-800 text-sm mb-2">📝 Option 2: Paste Text Code</h4>
                <input
                  type="text"
                  placeholder="Paste host's connection code here"
                  value={hostOfferInput}
                  onChange={(e) => setHostOfferInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                />
              </div>

              <button
                onClick={() => createGuestConnection(hostOfferInput)}
                disabled={!hostOfferInput}
                className="w-full px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                🔌 Join Game
              </button>
            </div>
          </div>
        )}
        
        {/* Host Connection Display */}
        {playMode === 'network' && networkRole === 'host' && !isConnected && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-300 space-y-4">
            <h3 className="font-bold text-slate-800">🎮 Share Connection with Guest</h3>

            {/* Image Option */}
            <ConnectionImage
              hash={connectionOffer}
              role="offer"
              label="📸 Option 1: Share as Image (Recommended)"
            />

            {/* Text Option */}
            <div className="pt-4 border-t border-green-200">
              <h4 className="font-bold text-slate-800 text-sm mb-2">📝 Option 2: Share as Text</h4>
              <div className="bg-white p-3 rounded-lg border-2 border-slate-300 mb-2 break-all text-xs font-mono max-h-24 overflow-y-auto">
                {connectionOffer}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(connectionOffer);
                  alert('Code copied! Share it with your friend.');
                }}
                className="w-full px-3 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 text-sm"
              >
                📋 Copy Text Code
              </button>
            </div>

            <p className="text-xs text-slate-500 text-center pt-2">⏳ Waiting for guest to connect...</p>

            {/* Host accepts guest's answer */}
            <div className="pt-4 border-t border-green-200 space-y-4">
              <h3 className="font-bold text-slate-800">🔌 Receive Guest's Answer</h3>

              {/* Image Upload Option */}
              <ImageUploader
                onHashExtracted={(hash) => setGuestAnswerInput(hash)}
                label="📸 Option 1: Upload Guest's Image"
              />

              {/* Text Option */}
              <div className="pt-4 border-t border-green-200">
                <h4 className="font-bold text-slate-800 text-sm mb-2">📝 Option 2: Paste Text Code</h4>
                <input
                  type="text"
                  placeholder="Paste guest's answer code here"
                  value={guestAnswerInput}
                  onChange={(e) => setGuestAnswerInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm mb-2"
                />
              </div>

              <button
                onClick={() => acceptGuestAnswer(guestAnswerInput)}
                disabled={!guestAnswerInput}
                className="w-full px-4 py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                🤝 Accept Answer
              </button>
            </div>
          </div>
        )}
        
        {/* Host Connected Display */}
        {playMode === 'network' && networkRole === 'host' && isConnected && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-300">
            <h3 className="font-bold text-slate-800 mb-2">✅ Connected!</h3>
            <p className="text-sm text-slate-600">Your friend has joined the game. Configure the game settings below and click "Start Game".</p>
          </div>
        )}
        
        {/* Guest Connection Display - Not Connected */}
        {playMode === 'network' && networkRole === 'guest' && !isConnected && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-300 space-y-4">
            <h3 className="font-bold text-slate-800">🔗 Send Answer to Host</h3>

            {/* Image Option */}
            <ConnectionImage
              hash={connectionAnswer}
              role="answer"
              label="📸 Option 1: Share as Image (Recommended)"
            />

            {/* Text Option */}
            <div className="pt-4 border-t border-blue-200">
              <h4 className="font-bold text-slate-800 text-sm mb-2">📝 Option 2: Share as Text</h4>
              <div className="bg-white p-3 rounded-lg border-2 border-slate-300 mb-2 break-all text-xs font-mono max-h-24 overflow-y-auto">
                {connectionAnswer}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(connectionAnswer);
                  alert('Code copied! Send it back to the host.');
                }}
                className="w-full px-3 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 text-sm"
              >
                📋 Copy Text Code
              </button>
            </div>

            <p className="text-sm text-slate-600 text-center pt-2">⏳ Waiting for host to accept...</p>
          </div>
        )}

        {/* Guest Connection Display - Connected */}
        {playMode === 'network' && networkRole === 'guest' && isConnected && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <h3 className="font-bold text-slate-800 mb-2">✅ Connected!</h3>
            <p className="text-sm text-slate-600 mb-3">You're connected to the host.</p>

            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
              <input
                type="text"
                value={players[1]?.name || 'Player 2'}
                onChange={(e) => updatePlayerName(1, e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
                placeholder="Enter your name"
              />
            </div>

            <p className="text-sm text-slate-600 text-center">⏳ Waiting for host to start the game...</p>
          </div>
        )}
        
        {/* Show game setup only if local OR (network host connected) */}
        {(playMode === 'local' || (playMode === 'network' && networkRole === 'host' && isConnected)) && (
          <>
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Game Mode</label>
              <div className="space-y-2">
                <button
                  onClick={() => setGameMode('rotating')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    gameMode === 'rotating' 
                      ? 'border-amber-500 bg-amber-50' 
                      : 'border-slate-300 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className="font-bold text-slate-800">🔄 Rotating Colors</div>
                  <div className="text-sm text-slate-600">Players switch colors after each of their moves</div>
                </button>
                <button
                  onClick={() => setGameMode('random')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    gameMode === 'random' 
                      ? 'border-amber-500 bg-amber-50' 
                      : 'border-slate-300 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className="font-bold text-slate-800">🎲 Random Chaos</div>
                  <div className="text-sm text-slate-600">Each turn, get a random color to play!</div>
                </button>
                <button
                  onClick={() => {
                    setGameMode('normie');
                    if (players.length > 2) {
                      setPlayers(players.slice(0, 2));
                    }
                  }}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    gameMode === 'normie' 
                      ? 'border-amber-500 bg-amber-50' 
                      : 'border-slate-300 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className="font-bold text-slate-800">♖ Normie Mode</div>
                  <div className="text-sm text-slate-600">Just a regular game of chess.</div>
                </button>
              </div>
                          </div>
            
                          {/* Points Game Controls */}
                          <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Points Game</label>
                            <div className="p-4 rounded-lg border-2 border-slate-300 bg-white">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center">
                                                    <DollarSign className="mr-2 text-slate-600" size={20} />
                                                    <span className="font-bold text-slate-800">Points Game Enabled</span>
                                                  </div>
                                                  <button
                                                    onClick={() => setIsPointsGame(!isPointsGame)}
                                                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                                                      isPointsGame ? 'bg-green-500' : 'bg-slate-400'
                                                    }`}
                                                  >
                                                    <span
                                                      className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                                        isPointsGame ? 'translate-x-6' : 'translate-x-1'
                                                      }`}
                                                    />
                                                  </button>
                                                </div>
                                                {isPointsGame && (
                                                  <div className="mt-4">
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">Target Score to Win</label>
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      value={targetScore}
                                                      onChange={(e) => setTargetScore(Number(e.target.value))}
                                                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                                                    />
                                                  </div>
                                                )}
                                              </div>                            </div>
            
                          {playMode === 'local' && gameMode !== 'normie' && (                <div className="space-y-3 mb-6">
                {players.map((player, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => updatePlayerName(index, e.target.value)}
                      className="flex-1 px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                      placeholder={`Player ${index + 1}`}
                    />
                    {players.length > 2 && (
                      <button
                        onClick={() => removePlayer(index)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {playMode === 'local' && gameMode !== 'normie' && players.length < 6 && (
              <button
                onClick={addPlayer}
                className="w-full mb-4 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 flex items-center justify-center gap-2"
              >
                <Users size={20} />
                Add Player
              </button>
            )}
            
            {/* Time Controls */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Time Controls</label>
              <div className="p-4 rounded-lg border-2 border-slate-300 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="mr-2 text-slate-600" size={20} />
                    <span className="font-bold text-slate-800">Timed Game</span>
                  </div>
                  <button
                    onClick={() => setIsTimedGame(!isTimedGame)}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                      isTimedGame ? 'bg-green-500' : 'bg-slate-400'
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                        isTimedGame ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {isTimedGame && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Time per player (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      value={timeSetting}
                      onChange={(e) => setTimeSetting(Number(e.target.value))}
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full px-6 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors"
            >
              Start Game
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SetupScreen;