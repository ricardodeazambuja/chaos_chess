import React from 'react';
import { Crown, Users, RotateCcw, Clock, DollarSign } from 'lucide-react';

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
  connectionOffer,
  isConnected,
  connectionMessage,
  connectionAnswer,
  startGame,
  addPlayer,
  removePlayer,
  updatePlayerName,
  setIsConnected,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="flex items-center justify-center mb-6">
          <Crown className="text-amber-500 mr-2" size={32} />
          <h1 className="text-3xl font-bold text-slate-800">Chaos Chess</h1>
        </div>
        
        <p className="text-slate-600 mb-6 text-center">
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
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h3 className="font-bold text-slate-800 mb-3">Choose Your Role</h3>
            <div className="space-y-2">
              <button
                onClick={createHostConnection}
                className="w-full px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600"
              >
                🎮 Host Game
              </button>
              <div className="text-center text-sm text-slate-600">or</div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Paste host's connection code here"
                  value={hostOfferInput}
                  onChange={(e) => setHostOfferInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => createGuestConnection(hostOfferInput)}
                  disabled={!hostOfferInput}
                  className="w-full px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  🔌 Join Game
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Host Connection Display */}
        {playMode === 'network' && networkRole === 'host' && !isConnected && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-300">
            <h3 className="font-bold text-slate-800 mb-2">🔗 Share this link with your friend</h3>
            <p className="text-sm text-slate-600 mb-2">They can click it to join directly:</p>
            <div className="bg-white p-3 rounded-lg border-2 border-slate-300 mb-2 break-all text-xs font-mono max-h-24 overflow-y-auto">
              {connectionOffer}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(connectionOffer);
                alert('Link copied! Share it with your friend.');
              }}
              className="w-full px-3 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 text-sm"
            >
              📋 Copy Link
            </button>
            <p className="text-xs text-slate-500 mt-2 text-center">Waiting for friend to connect...</p>
          </div>
        )}
        
        {/* Host Connected Display */}
        {playMode === 'network' && networkRole === 'host' && isConnected && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-300">
            <h3 className="font-bold text-slate-800 mb-2">✅ Connected!</h3>
            <p className="text-sm text-slate-600 mb-2">Your friend has joined the game.</p>
            {connectionMessage && <p className="text-sm text-slate-700 mt-2">{connectionMessage}</p>}
          </div>
        )}
        
        {/* Guest Connection Display */}
        {playMode === 'network' && networkRole === 'guest' && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <h3 className="font-bold text-slate-800 mb-2">🔗 Send this link back to the host</h3>
            <p className="text-sm text-slate-600 mb-2">The host can click it to complete the connection:</p>
            <div className="bg-white p-3 rounded-lg border-2 border-slate-300 mb-2 break-all text-xs font-mono max-h-24 overflow-y-auto">
              {connectionAnswer}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(connectionAnswer);
                alert('Link copied! Send it back to the host.');
              }}
              className="w-full px-3 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 text-sm"
            >
              📋 Copy Link
            </button>
            <p className="text-sm text-slate-600 mt-3 text-center">
              {isConnected ? '✅ Connected! Waiting for host to start...' : '⏳ Waiting for connection...'}
            </p>
          </div>
        )}
        
        {/* Show game setup only if local OR network connected */}
        {(playMode === 'local' || (playMode === 'network' && isConnected)) && (
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