import React, { useState } from 'react';
import { Crown, Users, RotateCcw } from 'lucide-react';

const ChessGame = () => {
  const [gameState, setGameState] = useState('setup'); // 'setup', 'playing', 'promoting', 'finished'
  const [players, setPlayers] = useState([{ name: 'Player 1' }, { name: 'Player 2' }]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentColor, setCurrentColor] = useState('white');
  const [board, setBoard] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [winner, setWinner] = useState(null);
  const [playerMoveCount, setPlayerMoveCount] = useState([0, 0]);
  const [gameMode, setGameMode] = useState('rotating');
  const [randomPlayerColor, setRandomPlayerColor] = useState('white');
  
  // State for Pawn Promotion
  const [promotionSquare, setPromotionSquare] = useState(null); // { row, col, color }
  
  // Network play state
  const [playMode, setPlayMode] = useState('local'); // 'local' | 'network'
  const [networkRole, setNetworkRole] = useState(null); // 'host' | 'guest'
  const [peerConnection, setPeerConnection] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [connectionOffer, setConnectionOffer] = useState('');
  const [connectionAnswer, setConnectionAnswer] = useState('');
  const [hostOfferInput, setHostOfferInput] = useState('');
  const [guestAnswerInput, setGuestAnswerInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const initializeBoard = () => {
    const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Pawns
    for (let i = 0; i < 8; i++) {
      newBoard[1][i] = { type: 'pawn', color: 'black', hasMoved: false };
      newBoard[6][i] = { type: 'pawn', color: 'white', hasMoved: false };
    }
    
    // Rooks
    newBoard[0][0] = { type: 'rook', color: 'black', hasMoved: false };
    newBoard[0][7] = { type: 'rook', color: 'black', hasMoved: false };
    newBoard[7][0] = { type: 'rook', color: 'white', hasMoved: false };
    newBoard[7][7] = { type: 'rook', color: 'white', hasMoved: false };
    
    // Knights
    newBoard[0][1] = newBoard[0][6] = { type: 'knight', color: 'black' };
    newBoard[7][1] = newBoard[7][6] = { type: 'knight', color: 'white' };
    
    // Bishops
    newBoard[0][2] = newBoard[0][5] = { type: 'bishop', color: 'black' };
    newBoard[7][2] = newBoard[7][5] = { type: 'bishop', color: 'white' };
    
    // Queens
    newBoard[0][3] = { type: 'queen', color: 'black' };
    newBoard[7][3] = { type: 'queen', color: 'white' };
    
    // Kings
    newBoard[0][4] = { type: 'king', color: 'black', hasMoved: false };
    newBoard[7][4] = { type: 'king', color: 'white', hasMoved: false };
    
    return newBoard;
  };

  const startGame = () => {
    setBoard(initializeBoard());
    setGameState('playing');
    setCurrentPlayerIndex(0);
    setCurrentColor('white');
    setMoveHistory([]);
    setWinner(null);
    setPromotionSquare(null);
    
    // Initialize move count for each player to 0
    setPlayerMoveCount(players.map(() => 0));
    
    // In random mode, set initial random color for first player
    if (gameMode === 'random') {
      setRandomPlayerColor(Math.random() < 0.5 ? 'white' : 'black');
    } else {
      setRandomPlayerColor('white');
    }
    
    // If host, broadcast game start to peers
    if (playMode === 'network' && networkRole === 'host' && dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({
        type: 'GAME_START',
        board: initializeBoard(),
        players,
        gameMode,
        currentPlayerIndex: 0,
        currentColor: 'white',
        playerMoveCount: players.map(() => 0),
        randomPlayerColor: gameMode === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : 'white'
      }));
    }
  };
  
  // WebRTC Functions
  const createHostConnection = async () => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    const pc = new RTCPeerConnection(config);
    setPeerConnection(pc);
    
    // Create data channel
    const dc = pc.createDataChannel('gameChannel');
    setDataChannel(dc);
    
    dc.onopen = () => {
      console.log('Data channel opened');
      setIsConnected(true);
    };
    
    dc.onmessage = (event) => {
      handlePeerMessage(JSON.parse(event.data));
    };
    
    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Wait for ICE gathering to complete
    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          }
        });
      }
    });
    
    const offerString = btoa(JSON.stringify(pc.localDescription));
    setConnectionOffer(offerString);
    setNetworkRole('host');
  };
  
  const acceptGuestAnswer = async (answerString) => {
    try {
      const answer = JSON.parse(atob(answerString));
      await peerConnection.setRemoteDescription(answer);
      setGuestAnswerInput('');
    } catch (error) {
      alert('Invalid answer code. Please check and try again.');
    }
  };
  
  const createGuestConnection = async (offerString) => {
    try {
      const offer = JSON.parse(atob(offerString));
      
      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      
      const pc = new RTCPeerConnection(config);
      setPeerConnection(pc);
      
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        setDataChannel(dc);
        
        dc.onopen = () => {
          console.log('Data channel opened');
          setIsConnected(true);
        };
        
        dc.onmessage = (event) => {
          handlePeerMessage(JSON.parse(event.data));
        };
      };
      
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Wait for ICE gathering
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          });
        }
      });
      
      const answerString = btoa(JSON.stringify(pc.localDescription));
      setConnectionAnswer(answerString);
      setNetworkRole('guest');
      setHostOfferInput('');
    } catch (error) {
      alert('Invalid offer code. Please check and try again.');
    }
  };
  
  const handlePeerMessage = (message) => {
    switch (message.type) {
      case 'GAME_START':
        setBoard(message.board);
        setPlayers(message.players);
        setGameMode(message.gameMode);
        setCurrentPlayerIndex(message.currentPlayerIndex);
        setCurrentColor(message.currentColor);
        setPlayerMoveCount(message.playerMoveCount);
        setRandomPlayerColor(message.randomPlayerColor);
        setGameState('playing');
        break;
        
      case 'MOVE_MADE':
        setBoard(message.board);
        setCurrentPlayerIndex(message.currentPlayerIndex);
        setCurrentColor(message.currentColor);
        setPlayerMoveCount(message.playerMoveCount);
        setMoveHistory(message.moveHistory);
        if (message.randomPlayerColor) {
          setRandomPlayerColor(message.randomPlayerColor);
        }
        if (message.winner) {
          setWinner(message.winner);
          setGameState('finished');
        }
        // Handle promotion state from peer
        if (message.gameState === 'promoting') {
          setGameState('promoting');
          setPromotionSquare(message.promotionSquare);
        } else {
          setGameState('playing');
          setPromotionSquare(null);
        }
        break;
    }
  };
  
  const broadcastMove = (newBoard, newPlayerIndex, newColor, newMoveCount, newHistory, newRandomColor, winnerName, newGameState = 'playing', newPromotionSquare = null) => {
    if (playMode === 'network' && networkRole === 'host' && dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({
        type: 'MOVE_MADE',
        board: newBoard,
        currentPlayerIndex: newPlayerIndex,
        currentColor: newColor,
        playerMoveCount: newMoveCount,
        moveHistory: newHistory,
        randomPlayerColor: newRandomColor,
        winner: winnerName,
        gameState: newGameState,
        promotionSquare: newPromotionSquare
      }));
    }
  };
  
  const getPlayerColor = (playerIndex, moveCount) => {
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

  const getPieceSymbol = (piece) => {
    if (!piece) return '';
    const whiteSymbols = {
      king: '♔',
      queen: '♕',
      rook: '♖',
      bishop: '♗',
      knight: '♘',
      pawn: '♙'
    };
    const blackSymbols = {
      king: '♚',
      queen: '♛',
      rook: '♜',
      bishop: '♝',
      knight: '♞',
      pawn: '♟︎'
    };
    return piece.color === 'white' ? whiteSymbols[piece.type] : blackSymbols[piece.type];
  };

  const isValidMove = (fromRow, fromCol, toRow, toCol, piece, testBoard = board) => {
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    const targetPiece = testBoard[toRow][toCol];
    if (targetPiece && targetPiece.color === piece.color) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
      case 'pawn':
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        if (colDiff === 0 && !targetPiece) {
          if (rowDiff === direction) return true;
          if (fromRow === startRow && rowDiff === 2 * direction && !testBoard[fromRow + direction][fromCol]) return true;
        }
        
        if (absColDiff === 1 && rowDiff === direction && targetPiece) return true;
        
        // TODO: En Passant
        return false;

      case 'rook':
        if (rowDiff === 0 || colDiff === 0) {
          return isPathClear(fromRow, fromCol, toRow, toCol, testBoard);
        }
        return false;

      case 'knight':
        return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);

      case 'bishop':
        if (absRowDiff === absColDiff) {
          return isPathClear(fromRow, fromCol, toRow, toCol, testBoard);
        }
        return false;

      case 'queen':
        if (rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) {
          return isPathClear(fromRow, fromCol, toRow, toCol, testBoard);
        }
        return false;

      case 'king':
        // Normal 1-square move
        if (absRowDiff <= 1 && absColDiff <= 1) {
          return true;
        }
        
        // Castling
        if (absRowDiff === 0 && absColDiff === 2 && !piece.hasMoved && !isInCheck(piece.color, testBoard)) {
          const rookCol = colDiff > 0 ? 7 : 0;
          const rook = testBoard[fromRow][rookCol];
          
          if (rook && rook.type === 'rook' && !rook.hasMoved) {
            // Check path is clear between king and rook
            if (isPathClear(fromRow, fromCol, fromRow, rookCol, testBoard)) {
              // Check king does not pass through check
              const stepCol = colDiff > 0 ? 1 : -1;
              if (!isSquareUnderAttack(fromRow, fromCol + stepCol, piece.color === 'white' ? 'black' : 'white', testBoard)) {
                return true;
              }
            }
          }
        }
        return false;

      default:
        return false;
    }
  };

  const isPathClear = (fromRow, fromCol, toRow, toCol, testBoard) => {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (testBoard[currentRow][currentCol]) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  };

  const findKing = (color, testBoard) => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = testBoard[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          return { row, col };
        }
      }
    }
    return null;
  };

  const isSquareUnderAttack = (row, col, byColor, testBoard) => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = testBoard[r][c];
        if (piece && piece.color === byColor) {
          if (isValidMove(r, c, row, col, piece, testBoard)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const isInCheck = (color, testBoard) => {
    const king = findKing(color, testBoard);
    if (!king) return false;
    
    const enemyColor = color === 'white' ? 'black' : 'white';
    return isSquareUnderAttack(king.row, king.col, enemyColor, testBoard);
  };

  const wouldBeInCheck = (fromRow, fromCol, toRow, toCol, testBoard) => {
    const newBoard = testBoard.map(row => [...row]);
    const piece = newBoard[fromRow][fromCol];
    
    // Simulate castling move for check test
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      newBoard[toRow][toCol] = { ...piece, hasMoved: true };
      newBoard[fromRow][fromCol] = null;
      // Note: This check isn't perfect, as it doesn't simulate the rook move
      // But we already check if king *is* in check or *passes through* check in isValidMove
    } else {
      newBoard[toRow][toCol] = piece;
      newBoard[fromRow][fromCol] = null;
    }
    
    return isInCheck(piece.color, newBoard);
  };

  const getValidMovesForPiece = (row, col) => {
    const piece = board[row][col];
    const currentPlayerColor = getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0);
    if (!piece || piece.color !== currentPlayerColor) return [];
    
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMove(row, col, r, c, piece) && !wouldBeInCheck(row, col, r, c, board)) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  };

  const isCheckmate = (color) => {
    if (!isInCheck(color, board)) return false;
    
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = board[fromRow][fromCol];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              if (isValidMove(fromRow, fromCol, toRow, toCol, piece) && 
                  !wouldBeInCheck(fromRow, fromCol, toRow, toCol, board)) {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  };

  // This function now contains the logic to advance the turn
  // It's called from handleSquareClick OR handlePromotionChoice
  const advanceTurn = (boardAfterMove, historyAfterMove, moveCountAfterMove) => {
    const nextChessColor = currentColor === 'white' ? 'black' : 'white';
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    let nextRandomColor = randomPlayerColor;
    if (gameMode === 'random') {
      nextRandomColor = Math.random() < 0.5 ? 'white' : 'black';
    }
    
    setTimeout(() => {
      const isCheckmateSituation = isCheckmate(nextChessColor);
      const winnerName = isCheckmateSituation ? players[currentPlayerIndex].name : null;
      
      if (isCheckmateSituation) {
        setWinner(winnerName);
        setGameState('finished');
      } else {
        setCurrentColor(nextChessColor);
        setCurrentPlayerIndex(nextPlayerIndex);
        
        if (gameMode === 'random') {
          setRandomPlayerColor(nextRandomColor);
        }
      }
      
      // Broadcast move to network peers
      broadcastMove(boardAfterMove, nextPlayerIndex, nextChessColor, moveCountAfterMove, historyAfterMove, nextRandomColor, winnerName, winnerName ? 'finished' : 'playing');
    }, 100);
  };

  const handleSquareClick = (row, col) => {
    if (gameState !== 'playing' || winner) return;
    
    // In network mode, only host can make moves
    if (playMode === 'network' && networkRole === 'guest') return;

    const piece = board[row][col];
    const currentPlayerColor = getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0);
    
    if (selectedSquare) {
      const isValidMoveSquare = validMoves.some(m => m.row === row && m.col === col);
      
      if (isValidMoveSquare) {
        const newBoard = board.map(r => [...r]);
        const movingPiece = { ...newBoard[selectedSquare.row][selectedSquare.col] }; // deep copy
        
        const capturedPiece = newBoard[row][col];
        
        // Handle hasMoved flags
        if (movingPiece.type === 'king' || movingPiece.type === 'rook' || movingPiece.type === 'pawn') {
          movingPiece.hasMoved = true;
        }
        
        newBoard[row][col] = movingPiece;
        newBoard[selectedSquare.row][selectedSquare.col] = null;
        
        // Handle Castling Rook Move
        if (movingPiece.type === 'king' && Math.abs(col - selectedSquare.col) === 2) {
          const rookCol = col > selectedSquare.col ? 7 : 0;
          const newRookCol = col > selectedSquare.col ? 5 : 3;
          const rook = { ...newBoard[row][rookCol] };
          rook.hasMoved = true;
          newBoard[row][newRookCol] = rook;
          newBoard[row][rookCol] = null;
        }
        
        setBoard(newBoard);
        
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
          setWinner(winnerName);
          setGameState('finished');
          broadcastMove(newBoard, (currentPlayerIndex + 1) % players.length, currentColor, newPlayerMoveCount, newHistory, randomPlayerColor, winnerName, 'finished');
        
        // 2. Check for Pawn Promotion
        } else if (movingPiece.type === 'pawn' && (row === 0 || row === 7)) {
          setGameState('promoting');
          setPromotionSquare({ row, col, color: movingPiece.color });
          // Don't advance turn yet, wait for promotion choice
          // Broadcast the 'promoting' state
          broadcastMove(newBoard, currentPlayerIndex, currentColor, newPlayerMoveCount, newHistory, randomPlayerColor, null, 'promoting', { row, col, color: movingPiece.color });
          
        // 3. Else, advance to next turn
        } else {
          advanceTurn(newBoard, newHistory, newPlayerMoveCount);
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
    
    // In network mode, only host can make moves
    if (playMode === 'network' && networkRole === 'guest') return;
    
    const newBoard = board.map(r => [...r]);
    newBoard[promotionSquare.row][promotionSquare.col].type = chosenPiece;
    
    setBoard(newBoard);
    setGameState('playing');
    setPromotionSquare(null);
    
    // Now that promotion is done, advance the turn
    // We use the moveHistory and playerMoveCount from state, which were set before we paused
    advanceTurn(newBoard, moveHistory, playerMoveCount);
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
              <h3 className="font-bold text-slate-800 mb-2">📤 Your Connection Code</h3>
              <p className="text-sm text-slate-600 mb-2">Share this code with your friend:</p>
              <textarea
                readOnly
                value={connectionOffer}
                className="w-full h-32 px-3 py-2 border-2 border-slate-300 rounded-lg text-xs font-mono mb-2"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(connectionOffer);
                  alert('Code copied to clipboard!');
                }}
                className="w-full px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm mb-3"
              >
                📋 Copy Code
              </button>
              
              <h3 className="font-bold text-slate-800 mb-2 mt-4">📥 Paste Guest's Answer</h3>
              <textarea
                placeholder="Paste the answer code from your friend here"
                value={guestAnswerInput}
                onChange={(e) => setGuestAnswerInput(e.target.value)}
                className="w-full h-24 px-3 py-2 border-2 border-slate-300 rounded-lg text-xs font-mono mb-2"
              />
              <button
                onClick={() => acceptGuestAnswer(guestAnswerInput)}
                disabled={!guestAnswerInput}
                className="w-full px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:opacity-50"
              >
                ✅ Connect
              </button>
            </div>
          )}
          
          {/* Guest Connection Display */}
          {playMode === 'network' && networkRole === 'guest' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
              <h3 className="font-bold text-slate-800 mb-2">📤 Your Answer Code</h3>
              <p className="text-sm text-slate-600 mb-2">Send this code back to the host:</p>
              <textarea
                readOnly
                value={connectionAnswer}
                className="w-full h-32 px-3 py-2 border-2 border-slate-300 rounded-lg text-xs font-mono mb-2"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(connectionAnswer);
                  alert('Code copied to clipboard!');
                }}
                className="w-full px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                📋 Copy Code
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
                </div>
              </div>
              
              {playMode === 'local' && (
                <div className="space-y-3 mb-6">
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
              
              {playMode === 'local' && players.length < 6 && (
                <button
                  onClick={addPlayer}
                  className="w-full mb-4 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 flex items-center justify-center gap-2"
                >
                  <Users size={20} />
                  Add Player
                </button>
              )}
              
              <button
                onClick={startGame}
                disabled={playMode === 'network' && networkRole === 'guest'}
                className="w-full px-6 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {playMode === 'network' && networkRole === 'guest' ? 'Waiting for Host...' : 'Start Game'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Main Game View ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 relative">
    
      {/* --- PAWN PROMOTION MODAL --- */}
      {gameState === 'promoting' && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Promote Your Pawn!</h2>
            <div className="flex gap-4">
              {['queen', 'rook', 'bishop', 'knight'].map((pieceType) => (
                <button
                  key={pieceType}
                  onClick={() => handlePromotionChoice(pieceType)}
                  disabled={playMode === 'network' && networkRole === 'guest'}
                  className="w-24 h-24 bg-amber-100 rounded-lg flex items-center justify-center text-6xl hover:bg-amber-200 disabled:opacity-50"
                  style={{
                    color: promotionSquare.color === 'white' ? '#f5f5dc' : '#000000',
                    textShadow: promotionSquare.color === 'white' 
                      ? '0 0 3px #000, 0 0 3px #000' 
                      : '0 0 2px #fff, 0 0 2px #fff'
                  }}
                >
                  {getPieceSymbol({ type: pieceType, color: promotionSquare.color })}
                </button>
              ))}
            </div>
            {playMode === 'network' && networkRole === 'guest' && (
              <p className="mt-4 text-slate-600">Waiting for host to choose...</p>
            )}
          </div>
        </div>
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
              🏆 {winner} wins! 🏆
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
                <span style={{
                  color: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '#f5f5dc' : '#000000',
                  textShadow: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' 
                    ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000' 
                    : '0 0 2px #fff, 0 0 2px #fff'
                }}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♔' : '♚'}
                </span>
                <span style={{
                  color: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '#f5f5dc' : '#000000',
                  textShadow: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' 
                    ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000' 
                    : '0 0 2px #fff, 0 0 2px #fff'
                }}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♕' : '♛'}
                </span>
                <span style={{
                  color: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '#f5f5dc' : '#000000',
                  textShadow: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' 
                    ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000' 
                    : '0 0 2px #fff, 0 0 2px #fff'
                }}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♖' : '♜'}
                </span>
                <span style={{
                  color: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '#f5f5dc' : '#000000',
                  textShadow: getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' 
                    ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000' 
                    : '0 0 2px #fff, 0 0 2px #fff'
                }}>
                  {getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0) === 'white' ? '♘' : '♞'}
                </span>
              </div>
              {isInCheck(getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0), board) && (
                <div className="mt-2 text-red-400 font-bold">⚠️ CHECK! ⚠️</div>
              )}
              {playMode === 'network' && networkRole === 'guest' && (
                <div className="mt-2 text-sm text-amber-300">👁️ Spectator Mode - Host controls the game</div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-center justify-center">
          <div className="bg-slate-800 p-4 rounded-xl shadow-2xl">
            <div className="grid grid-cols-8 gap-0 border-4 border-amber-600">
              {board.map((row, rowIndex) => (
                row.map((piece, colIndex) => {
                  const isLight = (rowIndex + colIndex) % 2 === 0;
                  const isSelected = selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === colIndex;
                  const isValidMoveSquare = validMoves.some(m => m.row === rowIndex && m.col === colIndex);
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleSquareClick(rowIndex, colIndex)}
                      className={`w-12 h-12 md:w-16 md:h-16 flex items-center justify-center text-4xl md:text-5xl cursor-pointer
                        ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                        ${isSelected ? 'ring-4 ring-blue-500' : ''}
                        ${isValidMoveSquare ? 'ring-4 ring-green-500' : ''}
                        hover:opacity-80 transition-all`}
                    >
                      <span style={{
                        color: piece?.color === 'white' ? '#f5f5dc' : '#000000',
                        textShadow: piece?.color === 'white' 
                          ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000, 0 0 3px #000' 
                          : '0 0 2px #fff, 0 0 2px #fff'
                      }}>
                        {getPieceSymbol(piece)}
                      </span>
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[280px]">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <RotateCcw size={20} />
              Players {gameMode === 'random' ? '🎲' : '🔄'}
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
                    {gameMode === 'random' 
                      ? (index === currentPlayerIndex ? `Playing: ${getPlayerColor(index, playerMoveCount[index] || 0)}` : '? Random ?')
                      : `Next plays: ${getPlayerColor(index, playerMoveCount[index] || 0)}`
                    }
                    {index === currentPlayerIndex && gameMode !== 'random' && ' (playing now)'}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setGameState('setup');
                setWinner(null);
                setMoveHistory([]);
                setSelectedSquare(null);
                setValidMoves([]);
                // Reset network state
                if (peerConnection) {
                  peerConnection.close();
                }
                if (dataChannel) {
                  dataChannel.close();
                }
                setPlayMode('local');
                setNetworkRole(null);
                setPeerConnection(null);
                setDataChannel(null);
                setIsConnected(false);
                setConnectionOffer('');
                setConnectionAnswer('');
              }}
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
        </div>
      </div>
    </div>
  );
};

export default ChessGame;