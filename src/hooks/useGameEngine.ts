import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Piece, LastMove } from '../chess-logic';
import {
  BOARD_SIZE,
  BOARD_MAX_INDEX,
  BLACK_BACK_ROW,
  WHITE_BACK_ROW,
  PIECE_VALUES,
  initializeBoard,
  isValidMove,
  isCheckmate,
  isStalemate,
  isInsufficientMaterial,
  wouldBeInCheck,
  isInCheck,
} from '../chess-logic';

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

interface GameEngineOptions {
  onGameStart?: (startData: GameStartData) => void;
  onMoveMade?: (moveData: MoveMadeData) => void;
  onGameOver?: (gameOverData: { winner: { name: string, reason: string } | null }) => void;
}

interface GameStartData {
  board: (Piece | null)[][];
  players: Player[];
  gameMode: 'rotating' | 'random' | 'normie';
  currentPlayerIndex: number;
  currentColor: 'white' | 'black';
  playerMoveCount: number[];
  randomPlayerColor: 'white' | 'black';
  isTimedGame: boolean;
  timeSetting: number;
  isPointsGame: boolean;
  targetScore: number;
}

interface MoveMadeData {
  board: (Piece | null)[][];
  currentPlayerIndex: number;
  currentColor: 'white' | 'black';
  playerMoveCount: number[];
  moveHistory: Move[];
  randomPlayerColor: 'white' | 'black';
  winner: { name: string, reason: string } | null;
  lastMove: LastMove | null;
  playerTimes: number[];
  playerScores: number[];
}

export type { GameStartData, MoveMadeData };

export const useGameEngine = ({ onGameStart, onMoveMade, onGameOver }: GameEngineOptions) => {
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

  // Timed games state
  const [isTimedGame, setIsTimedGame] = useState<boolean>(false);
  const [timeSetting, setTimeSetting] = useState<number>(5);
  const [playerTimes, setPlayerTimes] = useState<number[]>([]);

  // Points game state
  const [isPointsGame, setIsPointsGame] = useState<boolean>(false);
  const [playerScores, setPlayerScores] = useState<number[]>([]);
  const [targetScore, setTargetScore] = useState<number>(20);

  // Pawn Promotion state
  const [promotionSquare, setPromotionSquare] = useState<PromotionSquare | null>(null);

  // En Passant state
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  // Captured Pieces state
  const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>({ white: [], black: [] });

  // Single move highlight - derived via useMemo instead of state to avoid setState in effect
  // (removed useState)

  // Derived state for check
  const [inCheck, setInCheck] = useState<boolean>(false);

  const getPlayerColor = useCallback((playerIndex: number, moveCount: number): 'white' | 'black' => {
    if (gameMode === 'normie') {
      return playerIndex % 2 === 0 ? 'white' : 'black';
    }
    if (gameMode === 'random') {
      if (playerIndex === currentPlayerIndex) {
        return randomPlayerColor;
      }
      return playerIndex % 2 === 0 ? 'white' : 'black';
    }
    const startsWithWhite = playerIndex % 2 === 0;
    const movesAreEven = moveCount % 2 === 0;
    return startsWithWhite ? (movesAreEven ? 'white' : 'black') : (movesAreEven ? 'black' : 'white');
  }, [gameMode, currentPlayerIndex, randomPlayerColor]);

  const getValidMovesForPiece = useCallback((row: number, col: number) => {
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
  }, [board, currentPlayerIndex, playerMoveCount, lastMove, getPlayerColor]);

  const advanceTurn = useCallback((boardAfterMove: (Piece | null)[][], historyAfterMove: Move[], moveCountAfterMove: number[], lastMoveAfterMove: LastMove | null) => {
    if (!lastMoveAfterMove || !lastMoveAfterMove.piece) return;

    const pieceColorThatJustMoved = lastMoveAfterMove.piece.color;
    const nextChessColor = pieceColorThatJustMoved === 'white' ? 'black' : 'white';
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    let nextRandomColor = randomPlayerColor;
    if (gameMode === 'random') {
      nextRandomColor = Math.random() < 0.5 ? 'white' : 'black';
    }

    const isCheckmateSituation = isCheckmate(nextChessColor, boardAfterMove, lastMoveAfterMove);
    const isStalemateSituation = isStalemate(nextChessColor, boardAfterMove, lastMoveAfterMove);
    const isInsufficientMaterialSituation = isInsufficientMaterial(boardAfterMove);

    let winnerInfo: { name: string, reason: string } | null = null;

    if (isCheckmateSituation) {
      winnerInfo = { name: players[currentPlayerIndex].name, reason: 'Checkmate' };
    } else if (isStalemateSituation || isInsufficientMaterialSituation) {
      const reason = isStalemateSituation ? 'Stalemate' : 'Insufficient Material';
      if (isPointsGame) {
        const maxScore = Math.max(...playerScores);
        const winningPlayerIndices = playerScores.map((score, index) => score === maxScore ? index : -1).filter(index => index !== -1);
        winnerInfo = winningPlayerIndices.length === 1 ? { name: players[winningPlayerIndices[0]].name, reason: 'Points' } : { name: 'Draw', reason: 'Points' };
      } else {
        winnerInfo = { name: 'Draw', reason };
      }
    }

    if (winnerInfo) {
      setWinner(winnerInfo);
      setGameState('finished');
      setInCheck(false);
      onGameOver?.({ winner: winnerInfo });
    } else {
      setCurrentColor(nextChessColor);
      setCurrentPlayerIndex(nextPlayerIndex);
      if (gameMode === 'random') {
        setRandomPlayerColor(nextRandomColor);
      }
      // Update check status for the next player
      setInCheck(isInCheck(nextChessColor, boardAfterMove, lastMoveAfterMove));
    }

    onMoveMade?.({
      board: boardAfterMove,
      currentPlayerIndex: nextPlayerIndex,
      currentColor: nextChessColor,
      playerMoveCount: moveCountAfterMove,
      moveHistory: historyAfterMove,
      randomPlayerColor: nextRandomColor,
      winner: winnerInfo,
      lastMove: lastMoveAfterMove,
      playerTimes,
      playerScores,
    });
  }, [currentPlayerIndex, players, gameMode, randomPlayerColor, isPointsGame, playerScores, onGameOver, onMoveMade, playerTimes]);

  const makeMove = useCallback((row: number, col: number) => {
    if (gameState !== 'playing' || winner) return;

    const piece = board[row][col];
    const currentPlayerColor = getPlayerColor(currentPlayerIndex, playerMoveCount[currentPlayerIndex] || 0);

    if (selectedSquare) {
      const isValidMoveSquare = validMoves.some(m => m.row === row && m.col === col);
      if (isValidMoveSquare) {
        const newBoard = board.map(r => [...r]);
        const movingPiece = { ...newBoard[selectedSquare.row][selectedSquare.col]! };

        const capturedPiece = newBoard[row][col];
        let enPassantCapture = null;

        if (movingPiece.type === 'king' || movingPiece.type === 'rook' || movingPiece.type === 'pawn') {
          movingPiece.hasMoved = true;
        }

        newBoard[row][col] = movingPiece;
        newBoard[selectedSquare.row][selectedSquare.col] = null;

        if (movingPiece.type === 'pawn' && !capturedPiece && Math.abs(col - selectedSquare.col) === 1) {
          enPassantCapture = newBoard[selectedSquare.row][col];
          newBoard[selectedSquare.row][col] = null;
        }
        
        if (movingPiece.type === 'king' && Math.abs(col - selectedSquare.col) === 2) {
          const rookCol = col > selectedSquare.col ? BOARD_MAX_INDEX : 0;
          const newRookCol = col > selectedSquare.col ? 5 : 3;
          const rook = { ...newBoard[row][rookCol]! };
          rook.hasMoved = true;
          newBoard[row][newRookCol] = rook;
          newBoard[row][rookCol] = null;
        }
        
        setBoard(newBoard);

        const actualCaptured = capturedPiece || enPassantCapture;
        let updatedPlayerScores = playerScores;
        if (actualCaptured) {
          setCapturedPieces(prev => ({ ...prev, [movingPiece.color]: [...prev[movingPiece.color], actualCaptured.type] }));
          if (isPointsGame) {
            updatedPlayerScores = [...playerScores];
            updatedPlayerScores[currentPlayerIndex] = (updatedPlayerScores[currentPlayerIndex] || 0) + PIECE_VALUES[actualCaptured.type];
            setPlayerScores(updatedPlayerScores);

            // Check for target score win immediately after updating scores
            if (updatedPlayerScores[currentPlayerIndex] >= targetScore) {
              const winnerInfo = { name: players[currentPlayerIndex].name, reason: 'Target Score' };
              setWinner(winnerInfo);
              setGameState('finished');
              onGameOver?.({ winner: winnerInfo });
              return;
            }
          }
        }

        const newLastMove = { fromRow: selectedSquare.row, fromCol: selectedSquare.col, toRow: row, toCol: col, piece: movingPiece };
        setLastMove(newLastMove);

        const newHistory = [...moveHistory, { player: players[currentPlayerIndex].name, color: currentPlayerColor, from: `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}`, to: `${String.fromCharCode(97 + col)}${8 - row}`, piece: movingPiece.type }];
        setMoveHistory(newHistory);

        setSelectedSquare(null);
        setValidMoves([]);

        const newPlayerMoveCount = [...playerMoveCount];
        newPlayerMoveCount[currentPlayerIndex] = (newPlayerMoveCount[currentPlayerIndex] || 0) + 1;
        setPlayerMoveCount(newPlayerMoveCount);

        // Calculate check status for display
        const checkStatus = isInCheck(currentPlayerColor, newBoard, newLastMove);
        setInCheck(checkStatus);

        if (capturedPiece?.type === 'king') {
          const winnerInfo = { name: players[currentPlayerIndex].name, reason: 'King Capture' };
          setWinner(winnerInfo);
          setGameState('finished');
          onGameOver?.({ winner: winnerInfo });
        } else if (movingPiece.type === 'pawn' && (row === BLACK_BACK_ROW || row === WHITE_BACK_ROW)) {
          setGameState('promoting');
          setPromotionSquare({ row, col, color: movingPiece.color });
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
  }, [gameState, winner, board, selectedSquare, validMoves, currentPlayerIndex, playerMoveCount, getPlayerColor, isPointsGame, moveHistory, players, advanceTurn, onGameOver, getValidMovesForPiece, targetScore, playerScores]);

  const promotePawn = useCallback((chosenPiece: Piece['type']) => {
    if (gameState !== 'promoting' || !promotionSquare) return;

    const newBoard = board.map((r, rowIndex) => {
      if (rowIndex !== promotionSquare.row) return r;
      return r.map((p, colIndex) => {
        if (colIndex !== promotionSquare.col) return p;
        return { ...p!, type: chosenPiece };
      });
    });
    
    setBoard(newBoard);
    setGameState('playing');
    setPromotionSquare(null);

    advanceTurn(newBoard, moveHistory, playerMoveCount, lastMove);
  }, [gameState, promotionSquare, board, advanceTurn, moveHistory, playerMoveCount, lastMove]);

  const startGame = useCallback(() => {
    const startingPlayerIndex = Math.floor(Math.random() * players.length);
    const startingColor = 'white';
    const initialRandomColor = gameMode === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : startingColor;

    const initialBoard = initializeBoard();
    setBoard(initialBoard);
    setGameState('playing');
    setCurrentPlayerIndex(startingPlayerIndex);
    setCurrentColor(startingColor);
    setMoveHistory([]);
    setWinner(null);
    setPromotionSquare(null);
    setLastMove(null);
    setCapturedPieces({ white: [], black: [] });
    setPlayerMoveCount(players.map(() => 0));
    setRandomPlayerColor(initialRandomColor);
    setInCheck(false);

    const initialPlayerTimes = isTimedGame ? players.map(() => timeSetting * 60) : [];
    setPlayerTimes(initialPlayerTimes);

    const initialPlayerScores = isPointsGame ? players.map(() => 0) : [];
    setPlayerScores(initialPlayerScores);
    
    onGameStart?.({
      board: initialBoard,
      players,
      gameMode,
      currentPlayerIndex: startingPlayerIndex,
      currentColor: startingColor,
      playerMoveCount: players.map(() => 0),
      randomPlayerColor: initialRandomColor,
      isTimedGame,
      timeSetting,
      isPointsGame,
      targetScore,
    });
  }, [players, gameMode, isTimedGame, timeSetting, isPointsGame, targetScore, onGameStart]);

  const addPlayer = useCallback(() => {
    if (players.length < 6) {
      setPlayers(prev => [...prev, { name: `Player ${prev.length + 1}` }]);
    }
  }, [players.length]);

  const removePlayer = useCallback((index: number) => {
    if (players.length > 2) {
      setPlayers(prev => prev.filter((_, i) => i !== index));
    }
  }, [players.length]);

  const updatePlayerName = useCallback((index: number, name: string) => {
    setPlayers(prev => {
      const newPlayers = [...prev];
      newPlayers[index] = { ...newPlayers[index], name };
      return newPlayers;
    });
  }, []);

  // Effect for game timer
  useEffect(() => {
    if (gameState !== 'playing' || !isTimedGame || winner) return;
    const timer = setInterval(() => {
      setPlayerTimes(prev => {
        const newTimes = [...prev];
        if (newTimes[currentPlayerIndex] > 0) {
          newTimes[currentPlayerIndex]--;
        } else {
          const winnerIndex = 1 - currentPlayerIndex;
          const winnerInfo = players.length === 2 ? { name: players[winnerIndex].name, reason: 'Time' } : { name: 'Draw', reason: `Timeout (${players[currentPlayerIndex].name})` };
          setWinner(winnerInfo);
          setGameState('finished');
          onGameOver?.({ winner: winnerInfo });
        }
        return newTimes;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, isTimedGame, winner, currentPlayerIndex, players, onGameOver]);

  // Target score win is now checked immediately in makeMove() when scores update

  // Single move highlight - derive the value using useMemo instead of effect + state
  const singleMove = useMemo(() => {
    if (gameState !== 'playing' || winner || board.length === 0) {
      return null;
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

    return allMoves.length === 1 ? allMoves[0] : null;
  }, [currentPlayerIndex, board, gameState, winner, getPlayerColor, getValidMovesForPiece, playerMoveCount]);

  // Check status is now calculated in makeMove() and advanceTurn() when board changes
  // This avoids cascading renders from setState in effects

  // Network message handlers
  const receiveNetworkGameStart = useCallback((data: GameStartData) => {
    setBoard(data.board);
    setPlayers(data.players);
    setGameMode(data.gameMode);
    setCurrentPlayerIndex(data.currentPlayerIndex);
    setCurrentColor(data.currentColor);
    setPlayerMoveCount(data.playerMoveCount);
    setRandomPlayerColor(data.randomPlayerColor);
    setIsTimedGame(data.isTimedGame);
    if (data.isTimedGame) {
      setTimeSetting(data.timeSetting);
      setPlayerTimes(data.players.map(() => data.timeSetting * 60));
    }
    setIsPointsGame(data.isPointsGame);
    if (data.isPointsGame) {
      setPlayerScores(data.players.map(() => 0));
      setTargetScore(data.targetScore);
    }
    setInCheck(false);
    setGameState('playing');
  }, []);

  const receiveNetworkMove = useCallback((data: MoveMadeData) => {
    setBoard(data.board);
    setCurrentPlayerIndex(data.currentPlayerIndex);
    setCurrentColor(data.currentColor);
    setPlayerMoveCount(data.playerMoveCount);
    setMoveHistory(data.moveHistory);
    setLastMove(data.lastMove);
    if (data.randomPlayerColor) setRandomPlayerColor(data.randomPlayerColor);
    if (data.playerTimes) setPlayerTimes(data.playerTimes);
    if (data.playerScores) setPlayerScores(data.playerScores);
    if (data.winner) {
      setWinner(data.winner);
      setInCheck(false);
      setGameState('finished');
    } else {
      // Calculate check status for current player after receiving network move
      if (data.board.length > 0 && data.lastMove) {
        setInCheck(isInCheck(data.currentColor, data.board, data.lastMove));
      } else {
        setInCheck(false);
      }
      setGameState('playing');
    }
  }, []);

  return {
    state: {
      gameState,
      players,
      currentPlayerIndex,
      currentColor,
      board,
      selectedSquare,
      validMoves,
      moveHistory,
      winner,
      playerMoveCount,
      gameMode,
      randomPlayerColor,
      isTimedGame,
      timeSetting,
      playerTimes,
      isPointsGame,
      playerScores,
      targetScore,
      promotionSquare,
      lastMove,
      capturedPieces,
      singleMove,
      inCheck,
    },
    actions: {
      setGameState,
      setPlayers,
      setGameMode,
      setIsTimedGame,
      setTimeSetting,
      setIsPointsGame,
      setTargetScore,
      addPlayer,
      removePlayer,
      updatePlayerName,
      startGame,
      makeMove,
      promotePawn,
      getPlayerColor,
      receiveNetworkGameStart,
      receiveNetworkMove,
    },
  };
};
