export interface Piece {
  type: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
  color: 'white' | 'black';
  hasMoved?: boolean;
}

export interface LastMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  piece: Piece;
}

// Board constants
export const BOARD_SIZE = 8;
export const BOARD_MAX_INDEX = 7;
export const BLACK_PAWN_ROW = 1;
export const WHITE_PAWN_ROW = 6;
export const BLACK_BACK_ROW = 0;
export const WHITE_BACK_ROW = 7;

// Piece values for points game
export const PIECE_VALUES: Record<Piece['type'], number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0 // King's value is usually infinite, but for scoring captured pieces, it's 0 as it ends the game.
};

export const initializeBoard = (): (Piece | null)[][] => {
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

export const getPieceSymbol = (piece: Piece | null): string => {
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

export const getPieceStyle = (color: 'white' | 'black'): { color: string; textShadow: string } => ({
  color: color === 'white' ? '#f5f5dc' : '#000000',
  textShadow: color === 'white'
    ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000'
    : '0 0 2px #fff, 0 0 2px #fff'
});

export const isPathClear = (fromRow: number, fromCol: number, toRow: number, toCol: number, testBoard: (Piece | null)[][]): boolean => {
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

export const findKing = (color: 'white' | 'black', testBoard: (Piece | null)[][]): { row: number; col: number } | null => {
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

export const isSquareUnderAttack = (
  row: number,
  col: number,
  byColor: 'white' | 'black',
  testBoard: (Piece | null)[][],
  lastMove: LastMove | null = null
): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = testBoard[r][c];
      if (piece && piece.color === byColor) {
        if (isValidMove(r, c, row, col, piece, testBoard, lastMove)) {
          return true;
        }
      }
    }
  }
  return false;
};

export const isInCheck = (color: 'white' | 'black', testBoard: (Piece | null)[][], lastMove: LastMove | null = null): boolean => {
  const king = findKing(color, testBoard);
  if (!king) return false;

  const enemyColor = color === 'white' ? 'black' : 'white';
  return isSquareUnderAttack(king.row, king.col, enemyColor, testBoard, lastMove);
};

export const isValidMove = (
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: Piece,
  testBoard: (Piece | null)[][],
  lastMove: LastMove | null = null
): boolean => {
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
      if (absRowDiff === 0 && absColDiff === 2 && !piece.hasMoved && !isInCheck(piece.color, testBoard, lastMove)) {
        const rookCol = colDiff > 0 ? BOARD_MAX_INDEX : 0;
        const rook = testBoard[fromRow][rookCol];

        if (rook && rook.type === 'rook' && !rook.hasMoved) {
          // Check path is clear between king and rook
          if (isPathClear(fromRow, fromCol, fromRow, rookCol, testBoard)) {
            // CASTLING RULES: King cannot pass through check OR land in check
            // Note: We use piece.color from the function parameter (source of truth),
            // not any state variable, to avoid the stale state bugs we had previously.
            const stepCol = colDiff > 0 ? 1 : -1;
            const enemyColor = piece.color === 'white' ? 'black' : 'white';

            // Rule 1: King cannot pass THROUGH a square under attack (f1/f8 or d1/d8)
            if (!isSquareUnderAttack(fromRow, fromCol + stepCol, enemyColor, testBoard, lastMove)) {
              // Rule 2: King cannot LAND ON a square under attack (g1/g8 or c1/c8)
              // This was missing before (BUG) - now fixed
              if (!isSquareUnderAttack(fromRow, toCol, enemyColor, testBoard, lastMove)) {
                return true;
              }
            }
          }
        }
      }
      return false;

    default:
      return false;
  }
};

export const wouldBeInCheck = (
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  testBoard: (Piece | null)[][],
  lastMove: LastMove | null = null
): boolean => {
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

  return isInCheck(piece.color, newBoard, lastMove);
};

export const isCheckmate = (color: 'white' | 'black', testBoard: (Piece | null)[][], lastMove: LastMove | null = null): boolean => {
  if (!isInCheck(color, testBoard, lastMove)) return false;

  for (let fromRow = 0; fromRow < BOARD_SIZE; fromRow++) {
    for (let fromCol = 0; fromCol < BOARD_SIZE; fromCol++) {
      const piece = testBoard[fromRow][fromCol];
      if (piece && piece.color === color) {
        for (let toRow = 0; toRow < BOARD_SIZE; toRow++) {
          for (let toCol = 0; toCol < BOARD_SIZE; toCol++) {
            if (isValidMove(fromRow, fromCol, toRow, toCol, piece, testBoard, lastMove) &&
                !wouldBeInCheck(fromRow, fromCol, toRow, toCol, testBoard, lastMove)) {
              return false;
            }
          }
        }
      }
    }
  }
  return true;
};

export const isStalemate = (color: 'white' | 'black', testBoard: (Piece | null)[][], lastMove: LastMove | null = null): boolean => {
  if (isInCheck(color, testBoard, lastMove)) return false;

  for (let fromRow = 0; fromRow < BOARD_SIZE; fromRow++) {
    for (let fromCol = 0; fromCol < BOARD_SIZE; fromCol++) {
      const piece = testBoard[fromRow][fromCol];
      if (piece && piece.color === color) {
        for (let toRow = 0; toRow < BOARD_SIZE; toRow++) {
          for (let toCol = 0; toCol < BOARD_SIZE; toCol++) {
            if (isValidMove(fromRow, fromCol, toRow, toCol, piece, testBoard, lastMove) &&
                !wouldBeInCheck(fromRow, fromCol, toRow, toCol, testBoard, lastMove)) {
              return false;
            }
          }
        }
      }
    }
  }
  return true;
};

export const isInsufficientMaterial = (testBoard: (Piece | null)[][]): boolean => {
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
