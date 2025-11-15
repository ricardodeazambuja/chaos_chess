import React from 'react';

const ChessBoard = ({
  board,
  selectedSquare,
  validMoves,
  singleMove,
  handleSquareClick,
  getPieceStyle,
  getPieceSymbol,
}) => {
  return (
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
  );
};

export default ChessBoard;