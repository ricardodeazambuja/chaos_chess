import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Crown, Users, RotateCcw, Clock, DollarSign } from 'lucide-react';
import SetupScreen from './components/SetupScreen';
import PromotionModal from './components/PromotionModal';
import ChessBoard from './components/ChessBoard';
import GameInfoPanel from './components/GameInfoPanel';
import { useWebRTC } from './hooks/useWebRTC';
import type { Piece, LastMove } from './chess-logic';
import {
  BOARD_SIZE,
  BOARD_MAX_INDEX,
  BLACK_PAWN_ROW,
  WHITE_PAWN_ROW,
  BLACK_BACK_ROW,
  WHITE_BACK_ROW,
  PIECE_VALUES,
  initializeBoard,
  getPieceSymbol,
  getPieceStyle,
  isValidMove,
  isPathClear,
  findKing,
  isSquareUnderAttack,
  isInCheck,
  wouldBeInCheck,
  isCheckmate,
  isStalemate,
  isInsufficientMaterial
} from './chess-logic';

interface Player {
  name: string;
}

interface Move {
  player: string;
  color: 'white' | 'black';
  from: string;
  to: string;
  piece: string;
}

interface PromotionSquare {
  row: number;
  col: number;
  color: 'white' | 'black';
}

interface CapturedPieces {
  white: Piece['type'][];
  black: Piece['type'][];
}

const formatTime = (seconds: number): string => {
  if (seconds === undefined || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const ChaosChess = () => {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'promoting' | 'finished'>('setup');
  const [players, setPlayers] = useState<Player[]>([{ name: 'Player 1' }, { name: 'Player 2' }]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [currentColor, setCurrentColor] = useState<'white' | 'black'>('white');
  const [board, setBoard] = useState<(Piece | null)[][]>([]);
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [validMoves, setValidMoves] = useState<{ row: number; col: number }[]>([]);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [winner, setWinner] = useState<{ name: string, reason: string } | null>(null);
  const [playerMoveCount, setPlayerMoveCount] = useState<number[]>([0, 0]);
  const [gameMode, setGameMode] = useState<'rotating' | 'random' | 'normie'>('rotating');
  const [randomPlayerColor, setRandomPlayerColor] = useState<'white' | 'black'>('white');

  // State for timed games
  const [isTimedGame, setIsTimedGame] = useState<boolean>(false);
  const [timeSetting, setTimeSetting] = useState<number>(5); // In minutes
  const [playerTimes, setPlayerTimes] = useState<number[]>([]); // In seconds

  // State for points game
  const [isPointsGame, setIsPointsGame] = useState<boolean>(false);
  const [playerScores, setPlayerScores] = useState<number[]>([]);

  // State for target score
  const [targetScore, setTargetScore] = useState<number>(20);

  // State for Pawn Promotion
  const [promotionSquare, setPromotionSquare] = useState<PromotionSquare | null>(null);

  // State for En Passant
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  // State for Captured Pieces
  const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>({ white: [], black: [] });

  // State for single move highlight
  const [singleMove, setSingleMove] = useState<{ from: {row: number, col: number}, to: {row: number, col: number} } | null>(null);

  // Network play state
  const [playMode, setPlayMode] = useState<'local' | 'network'>('local');

  // Message handler for WebRTC peer messages
  const handlePeerMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'GAME_START':
        setBoard(message.board);
        setPlayers(message.players);
        setGameMode(message.gameMode);
        setCurrentPlayerIndex(message.currentPlayerIndex);
        setCurrentColor(message.currentColor);
        setPlayerMoveCount(message.playerMoveCount);
        setRandomPlayerColor(message.randomPlayerColor);

        // Handle timed game settings
        setIsTimedGame(message.isTimedGame);
        if (message.isTimedGame) {
          setTimeSetting(message.timeSetting);
          const initialTime = message.timeSetting * 60;
          setPlayerTimes(message.players.map(() => initialTime));
        } else {
          setPlayerTimes([]);
        }

        // Handle points game settings
        setIsPointsGame(message.isPointsGame);
        if (message.isPointsGame) {
          setPlayerScores(message.players.map(() => 0));
          setTargetScore(message.targetScore);
        } else {
          setPlayerScores([]);
        }

        setGameState('playing');
        break;

      case 'GAME_OVER':
        if (message.winner) {
          setWinner(message.winner);
        }
        setGameState('finished');
        break;

      case 'MOVE_MADE':
        setBoard(message.board);
        setCurrentPlayerIndex(message.currentPlayerIndex);
        setCurrentColor(message.currentColor);
        setPlayerMoveCount(message.playerMoveCount);
        setMoveHistory(message.moveHistory);
        setLastMove(message.lastMove);
        if (message.randomPlayerColor) {
          setRandomPlayerColor(message.randomPlayerColor);
        }
        if (message.playerTimes) {
          setPlayerTimes(message.playerTimes);
        }
        if (message.playerScores) {
          setPlayerScores(message.playerScores);
        }
        if (message.winner) {
          setWinner(message.winner);
          setGameState('finished');
        } else {
          setGameState('playing');
        }
        break;
    }
  }, []);

  // Initialize WebRTC hook
  const {
    dataChannel,
    connectionOffer,
    connectionAnswer,
    hostOfferInput,
    setHostOfferInput,
    guestAnswerInput,
    setGuestAnswerInput,
    isConnected,
    setIsConnected,
    connectionMessage,
    networkRole,
    setNetworkRole,
    peerConnectionRef,
    createHostConnection,
    acceptGuestAnswer,
    createGuestConnection,
    broadcastMove: webRTCBroadcast,
    resetConnection
  } = useWebRTC({ onMessage: handlePeerMessage });

  const startGame = () => {
    const startingPlayerIndex = Math.floor(Math.random() * players.length);
    const startingColor = 'white';
    const initialRandomColor = gameMode === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : startingColor;

    setBoard(initializeBoard());
    setGameState('playing');
    setCurrentPlayerIndex(startingPlayerIndex);
    setCurrentColor(startingColor);
    setMoveHistory([]);
    setWinner(null);
    setPromotionSquare(null);
    setLastMove(null);
    setCapturedPieces({ white: [], black: [] });

    // Initialize move count for each player to 0
    setPlayerMoveCount(players.map(() => 0));

    // Set initial color for the first player
    setRandomPlayerColor(initialRandomColor);

    // Initialize timers if it's a timed game
    if (isTimedGame) {
      const initialTime = timeSetting * 60;
      setPlayerTimes(players.map(() => initialTime));
    } else {
      setPlayerTimes([]);
    }

    // Initialize scores if it's a points game
    if (isPointsGame) {
      setPlayerScores(players.map(() => 0));
    } else {
      setPlayerScores([]);
    }
    
    // If host, broadcast game start to peers
    if (playMode === 'network' && networkRole === 'host') {
      webRTCBroadcast({
        type: 'GAME_START',
        board: initializeBoard(),
        players,
        gameMode,
        currentPlayerIndex: startingPlayerIndex,
        currentColor: startingColor,
        playerMoveCount: players.map(() => 0),
        randomPlayerColor: initialRandomColor,
        isTimedGame,
        timeSetting,
        isPointsGame,
        targetScore
      });
    }
  };

  // Auto-switch to network mode when URL hash is processed
  useEffect(() => {
    if (networkRole !== null && playMode === 'local') {
      setPlayMode('network');
    }
  }, [networkRole, playMode]);

  // Effect to find and highlight a single possible move
  useEffect(() => {
    if (gameState !== 'playing' || winner) {
      setSingleMove(null);
      return;
    }

    const allMoves: { from: { row: number; col: number }; to: { row: number; col: number } }[] = [];
    const currentPlayerColor = getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0);

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.color === currentPlayerColor) {
          const moves = getValidMovesForPiece(r, c);
          if (moves.length > 0) {
            for (const move of moves) {
              allMoves.push({ from: { row: r, col: c }, to: move });
            }
          }
        }
      }
    }

    if (allMoves.length === 1) {
      setSingleMove(allMoves[0]);
    } else {
      setSingleMove(null);
    }
  }, [currentPlayerIndex, board, gameState, winner]);

  // Effect for game timer countdown
  useEffect(() => {
    if (gameState !== 'playing' || !isTimedGame || winner) {
      return;
    }

    const timer = setInterval(() => {
      setPlayerTimes(prevTimes => {
        const newTimes = [...prevTimes];
        if (newTimes[currentPlayerIndex] > 0) {
          newTimes[currentPlayerIndex]--;
        }
        return newTimes;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isTimedGame, winner, currentPlayerIndex]);

  // Effect to check for timeout
  useEffect(() => {
    if (!isTimedGame || gameState !== 'playing') return;

    const timedOutPlayerIndex = playerTimes.findIndex(time => time === 0);
    if (timedOutPlayerIndex !== -1) {
      let winnerInfo;
      if (players.length === 2) {
        const winnerIndex = 1 - timedOutPlayerIndex;
        winnerInfo = { name: players[winnerIndex].name, reason: 'Time' };
      } else {
        winnerInfo = { name: 'Draw', reason: `Timeout (${players[timedOutPlayerIndex].name})` };
      }
      setWinner(winnerInfo);
      setGameState('finished');
      if (playMode === 'network') {
        webRTCBroadcast({ type: 'GAME_OVER', winner: winnerInfo });
      }
    }
  }, [playerTimes, isTimedGame, players, gameState, playMode, webRTCBroadcast]);

  // Effect to check for target score win
  useEffect(() => {
    if (!isPointsGame || gameState !== 'playing') return;

    const winnerIndex = playerScores.findIndex(score => score >= targetScore);
    if (winnerIndex !== -1) {
      const winnerInfo = { name: players[winnerIndex].name, reason: 'Target Score' };
      setWinner(winnerInfo);
      setGameState('finished');
      if (playMode === 'network') {
        webRTCBroadcast({ type: 'GAME_OVER', winner: winnerInfo });
      }
    }
  }, [playerScores, isPointsGame, targetScore, players, gameState, playMode, webRTCBroadcast]);

  // Broadcast move to network peer using WebRTC hook
  const broadcastMove = (newBoard: any, newPlayerIndex: number, newColor: 'white' | 'black', newMoveCount: number[], newHistory: Move[], newRandomColor: 'white' | 'black', winnerInfo: any, newGameState = 'playing', newLastMove: LastMove | null = null) => {
    if (playMode === 'network') {
      webRTCBroadcast({
        type: 'MOVE_MADE',
        board: newBoard,
        currentPlayerIndex: newPlayerIndex,
        currentColor: newColor,
        playerMoveCount: newMoveCount,
        moveHistory: newHistory,
        randomPlayerColor: newRandomColor,
        winner: winnerInfo,
        gameState: newGameState,
        lastMove: newLastMove,
        playerTimes,
        playerScores
      });
    }
  };
  
  const getPlayerColor = (playerIndex: number, moveCount: number): 'white' | 'black' => {
    if (gameMode === 'normie') {
      return playerIndex % 2 === 0 ? 'white' : 'black';
    }
    if (gameMode === 'random') {
      // In random mode, use the randomly assigned color for current player
      if (playerIndex === currentPlayerIndex) {
        return randomPlayerColor;
      }
      // For other players in the list, show what they might get (50/50)
      return playerIndex % 2 === 0 ? 'white' : 'black';
    }
    
    // Rotating mode: Odd-indexed players (0, 2, 4...) start with white
    // Even-indexed players (1, 3, 5...) start with black
    // Each player alternates their color with each move
    const startsWithWhite = playerIndex % 2 === 0;
    const movesAreEven = moveCount % 2 === 0;
    
    if (startsWithWhite) {
      return movesAreEven ? 'white' : 'black';
    } else {
      return movesAreEven ? 'black' : 'white';
    }
  };

  // Check if it's the current network user's turn
  const isMyTurn = (): boolean => {
    if (playMode === 'local') {
      return true; // In local mode, anyone can move
    }

    // In network mode, map network role to player index
    // Host = Player 0, Guest = Player 1
    const myPlayerIndex = networkRole === 'host' ? 0 : 1;
    return currentPlayerIndex === myPlayerIndex;
  };

  const getValidMovesForPiece = (row: number, col: number) => {
    const piece = board[row][col];
    const currentPlayerColor = getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0);
    if (!piece || piece.color !== currentPlayerColor) return [];

    const moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isValidMove(row, col, r, c, piece, board, lastMove) && !wouldBeInCheck(row, col, r, c, board, lastMove)) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  };

  // This function now contains the logic to advance the turn
  // It's called from handleSquareClick OR handlePromotionChoice
  const advanceTurn = (boardAfterMove, historyAfterMove, moveCountAfterMove, lastMoveAfterMove) => {
    // CRITICAL FIX: Use the actual piece color from the move, not currentColor state
    // This ensures we always check the opponent's color for checkmate, regardless of turn order
    if (!lastMoveAfterMove || !lastMoveAfterMove.piece) {
      console.error('advanceTurn called without valid lastMove!');
      return;
    }

    const pieceColorThatJustMoved = lastMoveAfterMove.piece.color;
    const nextChessColor = pieceColorThatJustMoved === 'white' ? 'black' : 'white';
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    let nextRandomColor = randomPlayerColor;
    if (gameMode === 'random') {
      nextRandomColor = Math.random() < 0.5 ? 'white' : 'black';
    }

    // Check for game end conditions IMMEDIATELY (not in setTimeout)
    const isCheckmateSituation = isCheckmate(nextChessColor, boardAfterMove, lastMoveAfterMove);
    const isStalemateSituation = isStalemate(nextChessColor, boardAfterMove, lastMoveAfterMove);
    const isInsufficientMaterialSituation = isInsufficientMaterial(boardAfterMove);

    let winnerInfo: { name: string, reason: string } | null = null;

    if (isCheckmateSituation) {
      winnerInfo = { name: players[currentPlayerIndex].name, reason: 'Checkmate' };
    } else if (isStalemateSituation || isInsufficientMaterialSituation) {
      if (isPointsGame) {
        const maxScore = Math.max(...playerScores);
        const winningPlayerIndices = playerScores.map((score, index) => score === maxScore ? index : -1).filter(index => index !== -1);

        if (winningPlayerIndices.length === 1) {
          winnerInfo = { name: players[winningPlayerIndices[0]].name, reason: 'Points' };
        } else {
          winnerInfo = { name: 'Draw', reason: 'Points' };
        }
      } else {
        winnerInfo = { name: 'Draw', reason: 'Stalemate/Insufficient Material' };
      }
    }

    if (winnerInfo) {
      setWinner(winnerInfo);
      setGameState('finished');
    } else {
      setCurrentColor(nextChessColor);
      setCurrentPlayerIndex(nextPlayerIndex);

      if (gameMode === 'random') {
        setRandomPlayerColor(nextRandomColor);
      }
    }

    // Broadcast move to network peers
    broadcastMove(boardAfterMove, nextPlayerIndex, nextChessColor, moveCountAfterMove, historyAfterMove, nextRandomColor, winnerInfo, winnerInfo ? 'finished' : 'playing', lastMoveAfterMove);
  };

  const handleSquareClick = (row: number, col: number) => {
    if (gameState !== 'playing' || winner) return;

    // In network mode, prevent moves when it's not your turn
    if (!isMyTurn()) {
      return; // Silently ignore clicks when it's not your turn
    }

    const piece = board[row][col];
    const currentPlayerColor = getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0);
    
    if (selectedSquare) {
      const isValidMoveSquare = validMoves.some(m => m.row === row && m.col === col);
      
      if (isValidMoveSquare) {
        const newBoard = board.map(r => [...r]);
        const movingPiece = { ...newBoard[selectedSquare.row][selectedSquare.col] }; // deep copy

        const capturedPiece = newBoard[row][col];
        let enPassantCapture = null;

        // Handle hasMoved flags
        if (movingPiece.type === 'king' || movingPiece.type === 'rook' || movingPiece.type === 'pawn') {
          movingPiece.hasMoved = true;
        }

        newBoard[row][col] = movingPiece;
        newBoard[selectedSquare.row][selectedSquare.col] = null;

        // Handle En Passant capture
        if (movingPiece.type === 'pawn' && !capturedPiece && Math.abs(col - selectedSquare.col) === 1) {
          // This is en passant - remove the captured pawn
          enPassantCapture = newBoard[selectedSquare.row][col];
          newBoard[selectedSquare.row][col] = null;
        }
        
        // Handle Castling Rook Move
        if (movingPiece.type === 'king' && Math.abs(col - selectedSquare.col) === 2) {
          const rookCol = col > selectedSquare.col ? BOARD_MAX_INDEX : 0;
          const newRookCol = col > selectedSquare.col ? 5 : 3;
          const rook = { ...newBoard[row][rookCol] };
          rook.hasMoved = true;
          newBoard[row][newRookCol] = rook;
          newBoard[row][rookCol] = null;
        }
        
        setBoard(newBoard);

        // Track captured pieces
        const actualCaptured = capturedPiece || enPassantCapture;
        if (actualCaptured) {
          const newCapturedPieces = { ...capturedPieces };
          // Add to the list of pieces captured BY the moving piece's color
          newCapturedPieces[movingPiece.color] = [...newCapturedPieces[movingPiece.color], actualCaptured.type];
          setCapturedPieces(newCapturedPieces);

          // Update scores if it's a points game
          if (isPointsGame) {
            const capturingPlayerIndex = currentPlayerIndex;
            const capturedPieceValue = PIECE_VALUES[actualCaptured.type];
            setPlayerScores(prevScores => {
              const newScores = [...prevScores];
              newScores[capturingPlayerIndex] = (newScores[capturingPlayerIndex] || 0) + capturedPieceValue;
              return newScores;
            });
          }
        }

        // Track last move for en passant
        const newLastMove = {
          fromRow: selectedSquare.row,
          fromCol: selectedSquare.col,
          toRow: row,
          toCol: col,
          piece: movingPiece
        };
        setLastMove(newLastMove);

        const newHistory = [...moveHistory, {
          player: players[currentPlayerIndex].name,
          color: currentPlayerColor,
          from: `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}`,
          to: `${String.fromCharCode(97 + col)}${8 - row}`,
          piece: movingPiece.type
        }];
        setMoveHistory(newHistory);

        setSelectedSquare(null);
        setValidMoves([]);
        
        const newPlayerMoveCount = [...playerMoveCount];
        newPlayerMoveCount[currentPlayerIndex] = (newPlayerMoveCount[currentPlayerIndex] || 0) + 1;
        setPlayerMoveCount(newPlayerMoveCount);

        // --- WIN/PROMOTION/ADVANCE LOGIC ---

        // 1. Check for King Capture Win
        if (capturedPiece && capturedPiece.type === 'king') {
          const winnerName = players[currentPlayerIndex].name;
          setWinner({ name: winnerName, reason: 'King Capture' });
          setGameState('finished');
          broadcastMove(newBoard, (currentPlayerIndex + 1) % players.length, currentColor, newPlayerMoveCount, newHistory, randomPlayerColor, winnerName, 'finished', newLastMove);

        // 2. Check for Pawn Promotion
        } else if (movingPiece.type === 'pawn' && (row === BLACK_BACK_ROW || row === WHITE_BACK_ROW)) {
          setGameState('promoting');
          setPromotionSquare({ row, col, color: movingPiece.color });
          // Don't advance turn yet, wait for promotion choice
          // Network sync will happen after promotion choice in advanceTurn

        // 3. Else, advance to next turn
        } else {
          advanceTurn(newBoard, newHistory, newPlayerMoveCount, newLastMove);
        }
        
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
        
        if (piece && piece.color === currentPlayerColor) {
          setSelectedSquare({ row, col });
          setValidMoves(getValidMovesForPiece(row, col));
        }
      }
    } else if (piece && piece.color === currentPlayerColor) {
      setSelectedSquare({ row, col });
      setValidMoves(getValidMovesForPiece(row, col));
    }
  };
  
  const handlePromotionChoice = (chosenPiece) => {
    if (gameState !== 'promoting' || !promotionSquare) return;

    const newBoard = board.map((r, rowIndex) => {
      if (rowIndex !== promotionSquare.row) return r;
      return r.map((p, colIndex) => {
        if (colIndex !== promotionSquare.col) return p;
        return { ...p, type: chosenPiece };
      });
    });
    
    setBoard(newBoard);
    setGameState('playing');
    setPromotionSquare(null);

    // Now that promotion is done, advance the turn
    // We use the moveHistory and playerMoveCount from state, which were set before we paused
    // lastMove is already set from before promotion, so we use the current state value
    advanceTurn(newBoard, moveHistory, playerMoveCount, lastMove);
  };

  const addPlayer = () => {
    if (players.length < 6) {
      setPlayers([...players, { name: `Player ${players.length + 1}` }]);
    }
  };

  const removePlayer = (index) => {
    if (players.length > 2) {
      setPlayers(players.filter((_, i) => i !== index));
    }
  };

  const updatePlayerName = (index, name) => {
    const newPlayers = [...players];
    newPlayers[index].name = name;
    setPlayers(newPlayers);
  };

  if (gameState === 'setup') {
    return (
      <SetupScreen
        players={players}
        setPlayers={setPlayers}
        gameMode={gameMode}
        setGameMode={setGameMode}
        isTimedGame={isTimedGame}
        setIsTimedGame={setIsTimedGame}
        timeSetting={timeSetting}
        setTimeSetting={setTimeSetting}
        isPointsGame={isPointsGame}
        setIsPointsGame={setIsPointsGame}
        targetScore={targetScore}
        setTargetScore={setTargetScore}
        playMode={playMode}
        setPlayMode={setPlayMode}
        networkRole={networkRole}
        setNetworkRole={setNetworkRole}
        createHostConnection={createHostConnection}
        createGuestConnection={createGuestConnection}
        hostOfferInput={hostOfferInput}
        setHostOfferInput={setHostOfferInput}
        connectionOffer={connectionOffer}
        isConnected={isConnected}
        setIsConnected={setIsConnected}
        connectionMessage={connectionMessage}
        connectionAnswer={connectionAnswer}
        startGame={startGame}
        addPlayer={addPlayer}
        removePlayer={removePlayer}
        updatePlayerName={updatePlayerName}
      />
    );
  }

  // --- Main Game View ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 relative">
    
      {/* --- PAWN PROMOTION MODAL --- */}
      {gameState === 'promoting' && (
        <PromotionModal
          handlePromotionChoice={handlePromotionChoice}
          promotionSquare={promotionSquare}
          getPieceStyle={getPieceStyle}
          getPieceSymbol={getPieceSymbol}
        />
      )}
      {/* --- END OF MODAL --- */}

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Crown className="text-amber-400" size={36} />
            Chaos Chess
          </h1>
          {playMode === 'network' && (
            <div className="text-sm text-amber-300">
              🌐 Network Game - {networkRole === 'host' ? 'Host' : 'Guest'} {isConnected ? '(Connected)' : '(Connecting...)'}
            </div>
          )}
          
          {winner ? (
            <div className="text-2xl font-bold text-amber-400 mb-4">
              {winner.name === 'Draw'
                ? `🤝 Draw by ${winner.reason}! 🤝`
                : `🏆 ${winner.name} wins by ${winner.reason}! 🏆`
              }
            </div>
          ) : (
            <div className="text-xl text-white">
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-amber-400">{players[currentPlayerIndex].name}</span>
                <span>playing</span>
                <span className={getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? 'text-white font-bold' : 'text-slate-400 font-bold'}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 text-4xl">
                <span style={getPieceStyle(getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0))}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♔' : '♚'}
                </span>
                <span style={getPieceStyle(getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0))}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♕' : '♛'}
                </span>
                <span style={getPieceStyle(getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0))}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♖' : '♜'}
                </span>
                <span style={getPieceStyle(getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0))}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♘' : '♞'}
                </span>
              </div>
              {isInCheck(getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0), board, lastMove) && (
                <div className="mt-2 text-red-400 font-bold">⚠️ CHECK! ⚠️</div>
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

        {isTimedGame && (
          <div className="flex justify-center gap-4 mb-4">
            {players.map((player, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-center w-32 ${
                  index === currentPlayerIndex ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-sm truncate">{player.name}</div>
                <div className="font-mono text-2xl font-bold">{formatTime(playerTimes[index])}</div>
              </div>
            ))}
          </div>
        )}

        {isPointsGame && (
          <div className="flex justify-center gap-4 mb-4">
            {players.map((player, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-center w-32 ${
                  index === currentPlayerIndex ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-sm truncate">{player.name}</div>
                <div className="font-mono text-2xl font-bold">{playerScores[index]} pts</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          <ChessBoard
            board={board}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            singleMove={singleMove}
            handleSquareClick={handleSquareClick}
            getPieceStyle={getPieceStyle}
            getPieceSymbol={getPieceSymbol}
          />

          <GameInfoPanel
            players={players}
            gameMode={gameMode}
            currentPlayerIndex={currentPlayerIndex}
            getPlayerColor={getPlayerColor}
            playerMoveCount={playerMoveCount}
            capturedPieces={capturedPieces}
            getPieceSymbol={getPieceSymbol}
            getPieceStyle={getPieceStyle}
            setGameState={setGameState}
            setWinner={setWinner}
            setMoveHistory={setMoveHistory}
            setSelectedSquare={setSelectedSquare}
            setValidMoves={setValidMoves}
            setPlayMode={setPlayMode}
            resetConnection={resetConnection}
            moveHistory={moveHistory}
          />
        </div>
      </div>
    </div>
  );
};

export default ChaosChess;