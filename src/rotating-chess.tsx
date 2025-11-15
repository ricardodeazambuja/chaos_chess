import React, { useState, useEffect, useRef } from 'react';
import { Crown, Users, RotateCcw, Clock } from 'lucide-react';

interface Piece {
  type: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
  color: 'white' | 'black';
  hasMoved?: boolean;
}

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

interface LastMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  piece: Piece;
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

// Board constants
const BOARD_SIZE = 8;
const BOARD_MAX_INDEX = 7;
const BLACK_PAWN_ROW = 1;
const WHITE_PAWN_ROW = 6;
const BLACK_BACK_ROW = 0;
const WHITE_BACK_ROW = 7;

// LocalStorage constants
const STORAGE_KEY = 'chaosChess_connection';
const CONNECTION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// LocalStorage helper functions
const saveConnectionState = (localDescription: RTCSessionDescriptionInit) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      role: 'host',
      localDescription,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Failed to save connection state:', error);
  }
};

const loadConnectionState = (): { localDescription: RTCSessionDescriptionInit; timestamp: number } | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Check if expired
    if (Date.now() - data.timestamp > CONNECTION_EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to load connection state:', error);
    return null;
  }
};

const clearConnectionState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear connection state:', error);
  }
};

const formatTime = (seconds: number): string => {
  if (seconds === undefined || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const ChessGame = () => {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'promoting' | 'finished'>('setup');
  const [players, setPlayers] = useState<Player[]>([{ name: 'Player 1' }, { name: 'Player 2' }]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [currentColor, setCurrentColor] = useState<'white' | 'black'>('white');
  const [board, setBoard] = useState<(Piece | null)[][]>([]);
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [validMoves, setValidMoves] = useState<{ row: number; col: number }[]>([]);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [playerMoveCount, setPlayerMoveCount] = useState<number[]>([0, 0]);
  const [gameMode, setGameMode] = useState<'rotating' | 'random' | 'normie'>('rotating');
  const [randomPlayerColor, setRandomPlayerColor] = useState<'white' | 'black'>('white');

  // State for timed games
  const [isTimedGame, setIsTimedGame] = useState<boolean>(false);
  const [timeSetting, setTimeSetting] = useState<number>(5); // In minutes
  const [playerTimes, setPlayerTimes] = useState<number[]>([]); // In seconds

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
  const [networkRole, setNetworkRole] = useState<'host' | 'guest' | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [connectionOffer, setConnectionOffer] = useState<string>('');
  const [connectionAnswer, setConnectionAnswer] = useState<string>('');
  const [hostOfferInput, setHostOfferInput] = useState<string>('');
  const [guestAnswerInput, setGuestAnswerInput] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  // Ref to track current peer connection for event handlers
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const initializeBoard = (): (Piece | null)[][] => {
    const newBoard: (Piece | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    // Pawns
    for (let i = 0; i < BOARD_SIZE; i++) {
      newBoard[BLACK_PAWN_ROW][i] = { type: 'pawn', color: 'black', hasMoved: false };
      newBoard[WHITE_PAWN_ROW][i] = { type: 'pawn', color: 'white', hasMoved: false };
    }

    // Rooks
    newBoard[BLACK_BACK_ROW][0] = { type: 'rook', color: 'black', hasMoved: false };
    newBoard[BLACK_BACK_ROW][BOARD_MAX_INDEX] = { type: 'rook', color: 'black', hasMoved: false };
    newBoard[WHITE_BACK_ROW][0] = { type: 'rook', color: 'white', hasMoved: false };
    newBoard[WHITE_BACK_ROW][BOARD_MAX_INDEX] = { type: 'rook', color: 'white', hasMoved: false };

    // Knights
    newBoard[BLACK_BACK_ROW][1] = newBoard[BLACK_BACK_ROW][6] = { type: 'knight', color: 'black' };
    newBoard[WHITE_BACK_ROW][1] = newBoard[WHITE_BACK_ROW][6] = { type: 'knight', color: 'white' };

    // Bishops
    newBoard[BLACK_BACK_ROW][2] = newBoard[BLACK_BACK_ROW][5] = { type: 'bishop', color: 'black' };
    newBoard[WHITE_BACK_ROW][2] = newBoard[WHITE_BACK_ROW][5] = { type: 'bishop', color: 'white' };

    // Queens
    newBoard[BLACK_BACK_ROW][3] = { type: 'queen', color: 'black' };
    newBoard[WHITE_BACK_ROW][3] = { type: 'queen', color: 'white' };

    // Kings
    newBoard[BLACK_BACK_ROW][4] = { type: 'king', color: 'black', hasMoved: false };
    newBoard[WHITE_BACK_ROW][4] = { type: 'king', color: 'white', hasMoved: false };
    
    return newBoard;
  };

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
    
    // If host, broadcast game start to peers
    if (playMode === 'network' && networkRole === 'host' && dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({
        type: 'GAME_START',
        board: initializeBoard(),
        players,
        gameMode,
        currentPlayerIndex: startingPlayerIndex,
        currentColor: startingColor,
        playerMoveCount: players.map(() => 0),
        randomPlayerColor: initialRandomColor,
        isTimedGame,
        timeSetting
      }));
    }
  };

  // Process URL hash on mount and when hash changes
  useEffect(() => {
    const processHash = () => {
      const hash = window.location.hash;
      if (!hash) return;

      // Parse offer or answer from URL
      if (hash.startsWith('#offer=')) {
        const offerCode = hash.substring(7); // Remove '#offer='
        setPlayMode('network');
        // Auto-process offer as guest
        processOfferFromURL(offerCode);
        // Clear hash after processing
        window.history.replaceState(null, '', window.location.pathname);
      } else if (hash.startsWith('#answer=')) {
        const answerCode = hash.substring(8); // Remove '#answer='
        setPlayMode('network');
        // Auto-process answer as host
        processAnswerFromURL(answerCode);
        // Clear hash after processing
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    // Process on mount
    processHash();

    // Listen for hash changes (when user clicks answer link while on page)
    window.addEventListener('hashchange', processHash);

    return () => {
      window.removeEventListener('hashchange', processHash);
    };
  }, []);

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
      if (players.length === 2) {
        const winnerIndex = 1 - timedOutPlayerIndex;
        setWinner(`${players[winnerIndex].name} wins on time!`);
      } else {
        setWinner(`${players[timedOutPlayerIndex].name} lost on time.`);
      }
      setGameState('finished');
    }
  }, [playerTimes, isTimedGame, players, gameState]);

  // Auto-process offer when guest clicks offer URL
  const processOfferFromURL = async (offerCode: string) => {
    try {
      await createGuestConnection(offerCode);
    } catch (error) {
      console.error('Failed to process offer from URL:', error);
      alert('Failed to process connection link. Please try again or use manual setup.');
    }
  };

  // Auto-process answer when host clicks answer URL
  const processAnswerFromURL = async (answerCode: string) => {
    try {
      console.log('[DEBUG] Processing answer from URL...');

      // Decode the answer
      console.log('[DEBUG] Decoding answer...');
      const answer = JSON.parse(atob(answerCode));
      console.log('[DEBUG] Answer decoded successfully');

      // If we already have an active peer connection, just apply the answer
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
        console.log('[DEBUG] Using existing peer connection, state:', peerConnectionRef.current.signalingState);
        await peerConnectionRef.current.setRemoteDescription(answer);
        console.log('[DEBUG] Remote description set successfully');
        setNetworkRole('host');
        return;
      }

      // Otherwise, restore from localStorage
      console.log('[DEBUG] No active peer connection, restoring from localStorage...');
      const savedState = loadConnectionState();

      if (!savedState) {
        console.error('[DEBUG] No saved state found in localStorage');
        alert('Connection expired or not found. Please start a new connection.');
        clearConnectionState();
        return;
      }

      console.log('[DEBUG] Saved state found, recreating peer connection...');

      // Recreate the peer connection
      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

      // Recreate data channel
      const dc = pc.createDataChannel('gameChannel');
      setDataChannel(dc);

      dc.onopen = () => {
        console.log('Data channel opened');
        setIsConnected(true);
        clearConnectionState(); // Clear after successful connection
      };

      dc.onmessage = (event) => {
        handlePeerMessage(JSON.parse(event.data));
      };

      // Restore local description
      console.log('[DEBUG] Restoring local description...');
      await pc.setLocalDescription(savedState.localDescription);
      console.log('[DEBUG] Local description restored');

      // Apply remote answer
      console.log('[DEBUG] Applying remote answer...');
      await pc.setRemoteDescription(answer);
      console.log('[DEBUG] Remote answer applied successfully');

      setNetworkRole('host');
      setConnectionMessage('Connection established! Click "Start Game" to begin.');
      console.log('[DEBUG] Connection process complete!');
    } catch (error) {
      console.error('[ERROR] Failed to process answer from URL:', error);
      console.error('[ERROR] Error details:', error.message, error.stack);
      alert('Failed to process answer link. Please try again or use manual setup.');
      clearConnectionState();
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
    peerConnectionRef.current = pc;

    // Create data channel
    const dc = pc.createDataChannel('gameChannel');
    setDataChannel(dc);

    dc.onopen = () => {
      console.log('Data channel opened');
      setIsConnected(true);
      clearConnectionState(); // Clear after successful connection
    };

    dc.onmessage = (event) => {
      handlePeerMessage(JSON.parse(event.data));
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await new Promise<void>((resolve) => {
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

    // Save to localStorage for later restoration
    if (pc.localDescription) {
      saveConnectionState(pc.localDescription);
    }

    // Generate shareable URL
    const offerString = btoa(JSON.stringify(pc.localDescription));
    const shareableURL = `${window.location.origin}${window.location.pathname}#offer=${offerString}`;
    setConnectionOffer(shareableURL);
    setNetworkRole('host');
  };
  
  const acceptGuestAnswer = async (answerString) => {
    try {
      const answer = JSON.parse(atob(answerString));
      await peerConnectionRef.current.setRemoteDescription(answer);
      setGuestAnswerInput('');
    } catch (error) {
      alert('Invalid answer code. Please check and try again.');
    }
  };
  
  const createGuestConnection = async (offerString: string) => {
    try {
      let offerCode = offerString;
      const offerPrefix = '#offer=';
      const offerIndex = offerCode.indexOf(offerPrefix);
      if (offerIndex !== -1) {
        offerCode = offerCode.substring(offerIndex + offerPrefix.length);
      }
      
      const offer = JSON.parse(atob(offerCode));

      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

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
      await new Promise<void>((resolve) => {
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

      // Generate shareable answer URL
      const answerString = btoa(JSON.stringify(pc.localDescription));
      const shareableURL = `${window.location.origin}${window.location.pathname}#answer=${answerString}`;
      setConnectionAnswer(shareableURL);
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
        
        // Handle timed game settings
        setIsTimedGame(message.isTimedGame);
        if (message.isTimedGame) {
          setTimeSetting(message.timeSetting);
          const initialTime = message.timeSetting * 60;
          setPlayerTimes(message.players.map(() => initialTime));
        } else {
          setPlayerTimes([]);
        }

        setGameState('playing');
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
        if (message.winner) {
          setWinner(message.winner);
          setGameState('finished');
        } else {
          setGameState('playing');
        }
        break;
    }
  };
  
  const broadcastMove = (newBoard, newPlayerIndex, newColor, newMoveCount, newHistory, newRandomColor, winnerName, newGameState = 'playing', newLastMove = null) => {
    if (playMode === 'network' && dataChannel && dataChannel.readyState === 'open') {
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
        lastMove: newLastMove,
        playerTimes
      }));
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

  const getPieceSymbol = (piece: Piece | null): string => {
    if (!piece) return '';
    const whiteSymbols: Record<Piece['type'], string> = {
      king: '♔',
      queen: '♕',
      rook: '♖',
      bishop: '♗',
      knight: '♘',
      pawn: '♙'
    };
    const blackSymbols: Record<Piece['type'], string> = {
      king: '♚',
      queen: '♛',
      rook: '♜',
      bishop: '♝',
      knight: '♞',
      pawn: '♟︎'
    };
    return piece.color === 'white' ? whiteSymbols[piece.type] : blackSymbols[piece.type];
  };

  const getPieceStyle = (color: 'white' | 'black'): { color: string; textShadow: string } => ({
    color: color === 'white' ? '#f5f5dc' : '#000000',
    textShadow: color === 'white'
      ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000'
      : '0 0 2px #fff, 0 0 2px #fff'
  });

  const isValidMove = (fromRow, fromCol, toRow, toCol, piece, testBoard = board) => {
    if (toRow < 0 || toRow > BOARD_MAX_INDEX || toCol < 0 || toCol > BOARD_MAX_INDEX) return false;
    
    const targetPiece = testBoard[toRow][toCol];
    if (targetPiece && targetPiece.color === piece.color) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
      case 'pawn':
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? WHITE_PAWN_ROW : BLACK_PAWN_ROW;

        if (colDiff === 0 && !targetPiece) {
          if (rowDiff === direction) return true;
          if (fromRow === startRow && rowDiff === 2 * direction && !testBoard[fromRow + direction][fromCol]) return true;
        }

        if (absColDiff === 1 && rowDiff === direction && targetPiece) return true;

        // En Passant
        if (absColDiff === 1 && rowDiff === direction && !targetPiece && lastMove) {
          const enemyColor = piece.color === 'white' ? 'black' : 'white';
          const expectedRow = piece.color === 'white' ? 3 : 4;

          // Check if we're on the right row for en passant
          if (fromRow === expectedRow &&
              lastMove.piece.type === 'pawn' &&
              lastMove.piece.color === enemyColor &&
              Math.abs(lastMove.toRow - lastMove.fromRow) === 2 &&
              lastMove.toRow === fromRow &&
              lastMove.toCol === toCol) {
            return true;
          }
        }

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
          const rookCol = colDiff > 0 ? BOARD_MAX_INDEX : 0;
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
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const piece = testBoard[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          return { row, col };
        }
      }
    }
    return null;
  };

  const isSquareUnderAttack = (row, col, byColor, testBoard) => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
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

    if (!piece) return false; // Should not happen if called correctly

    // Simulate castling move for check test
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      newBoard[toRow][toCol] = { ...piece, hasMoved: true };
      newBoard[fromRow][fromCol] = null;

      // Also simulate the rook move for complete castling simulation
      const rookCol = toCol > fromCol ? BOARD_MAX_INDEX : 0;
      const newRookCol = toCol > fromCol ? 5 : 3;
      const rook = newBoard[fromRow][rookCol];
      if (rook) {
        newBoard[fromRow][newRookCol] = { ...rook, hasMoved: true };
        newBoard[fromRow][rookCol] = null;
      }
    } else {
      // Handle en-passant capture simulation
      if (piece.type === 'pawn' && toCol !== fromCol && !newBoard[toRow][toCol]) {
        newBoard[fromRow][toCol] = null; // Remove captured pawn
      }
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
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isValidMove(row, col, r, c, piece) && !wouldBeInCheck(row, col, r, c, board)) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  };

  const isCheckmate = (color, testBoard) => {
    if (!isInCheck(color, testBoard)) return false;

    for (let fromRow = 0; fromRow < BOARD_SIZE; fromRow++) {
      for (let fromCol = 0; fromCol < BOARD_SIZE; fromCol++) {
        const piece = testBoard[fromRow][fromCol];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < BOARD_SIZE; toRow++) {
            for (let toCol = 0; toCol < BOARD_SIZE; toCol++) {
              if (isValidMove(fromRow, fromCol, toRow, toCol, piece, testBoard) &&
                  !wouldBeInCheck(fromRow, fromCol, toRow, toCol, testBoard)) {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  };

  const isStalemate = (color, testBoard) => {
    if (isInCheck(color, testBoard)) return false;

    for (let fromRow = 0; fromRow < BOARD_SIZE; fromRow++) {
      for (let fromCol = 0; fromCol < BOARD_SIZE; fromCol++) {
        const piece = testBoard[fromRow][fromCol];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < BOARD_SIZE; toRow++) {
            for (let toCol = 0; toCol < BOARD_SIZE; toCol++) {
              if (isValidMove(fromRow, fromCol, toRow, toCol, piece, testBoard) &&
                  !wouldBeInCheck(fromRow, fromCol, toRow, toCol, testBoard)) {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  };

  const isInsufficientMaterial = (testBoard) => {
    const pieces: { type: Piece['type']; color: 'white' | 'black'; row: number; col: number }[] = [];

    // Collect all pieces on the board
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const piece = testBoard[row][col];
        if (piece) {
          pieces.push({ type: piece.type, color: piece.color, row, col });
        }
      }
    }

    // K vs K (only two kings)
    if (pieces.length === 2) {
      return pieces.every(p => p.type === 'king');
    }

    // K+B vs K or K+N vs K (three pieces: two kings + one minor piece)
    if (pieces.length === 3) {
      const kings = pieces.filter(p => p.type === 'king');
      const others = pieces.filter(p => p.type !== 'king');

      if (kings.length === 2 && others.length === 1) {
        const piece = others[0];
        return piece.type === 'bishop' || piece.type === 'knight';
      }
    }

    // K+B vs K+B with same-colored bishops (four pieces: two kings + two bishops)
    if (pieces.length === 4) {
      const kings = pieces.filter(p => p.type === 'king');
      const bishops = pieces.filter(p => p.type === 'bishop');

      if (kings.length === 2 && bishops.length === 2) {
        // Check if bishops are on same color square
        const bishop1 = bishops[0];
        const bishop2 = bishops[1];
        const bishop1Color = (bishop1.row + bishop1.col) % 2;
        const bishop2Color = (bishop2.row + bishop2.col) % 2;
        return bishop1Color === bishop2Color;
      }
    }

    return false;
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
      const isCheckmateSituation = isCheckmate(nextChessColor, boardAfterMove);
      const isStalemateSituation = isStalemate(nextChessColor, boardAfterMove);
      const isInsufficientMaterialSituation = isInsufficientMaterial(boardAfterMove);

      const winnerName = isCheckmateSituation
        ? players[currentPlayerIndex].name
        : (isStalemateSituation || isInsufficientMaterialSituation ? 'Draw' : null);

      if (isCheckmateSituation || isStalemateSituation || isInsufficientMaterialSituation) {
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
      broadcastMove(boardAfterMove, nextPlayerIndex, nextChessColor, moveCountAfterMove, historyAfterMove, nextRandomColor, winnerName, winnerName ? 'finished' : 'playing', lastMove);
    }, 100);
  };

  const handleSquareClick = (row, col) => {
    if (gameState !== 'playing' || winner) return;

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
          setWinner(winnerName);
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
              
              {playMode === 'local' && gameMode !== 'normie' && (
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
                  className="w-24 h-24 bg-amber-100 rounded-lg flex items-center justify-center text-6xl hover:bg-amber-200"
                  style={getPieceStyle(promotionSquare.color)}
                >
                  {getPieceSymbol({ type: pieceType, color: promotionSquare.color })}
                </button>
              ))}
            </div>
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
              {winner === 'Draw' ? '🤝 Draw! 🤝' : `🏆 ${winner} wins! 🏆`}
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
              {isInCheck(getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0), board) && (
                <div className="mt-2 text-red-400 font-bold">⚠️ CHECK! ⚠️</div>
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

        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          <div className="bg-slate-800 p-4 rounded-xl shadow-2xl">
            <div className="grid grid-cols-8 gap-0 border-4 border-amber-600">
              {board.map((row, rowIndex) => (
                row.map((piece, colIndex) => {
                  const isLight = (rowIndex + colIndex) % 2 === 0;
                  const isSelected = selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === colIndex;
                  const isValidMoveSquare = validMoves.some(m => m.row === rowIndex && m.col === colIndex);
                  const isSingleMoveFrom = singleMove && singleMove.from.row === rowIndex && singleMove.from.col === colIndex;
                  const isSingleMoveTo = singleMove && singleMove.to.row === rowIndex && singleMove.to.col === colIndex;
                  const isSingleMove = isSingleMoveFrom || isSingleMoveTo;

                  const ringClass = isSelected
                    ? 'ring-4 ring-blue-500'
                    : isValidMoveSquare
                      ? 'ring-4 ring-green-500'
                      : isSingleMove
                        ? 'ring-4 ring-purple-500'
                        : '';
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleSquareClick(rowIndex, colIndex)}
                      className={`w-12 h-12 md:w-16 md:h-16 flex items-center justify-center text-4xl md:text-5xl cursor-pointer
                        ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                        ${ringClass}
                        hover:opacity-80 transition-all`}
                    >
                      <span style={piece ? getPieceStyle(piece.color) : {}}>
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
              onClick={() => {
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