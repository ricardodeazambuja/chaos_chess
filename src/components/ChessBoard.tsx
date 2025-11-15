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
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  return (
    <div className="bg-slate-800 p-4 rounded-xl shadow-2xl">
      <div className="flex gap-2">
        {/* Rank labels (left side: 8-1) */}
        <div className="flex flex-col justify-around py-1">
          {ranks.map((rank) => (
            <div
              key={rank}
              className="w-6 h-12 md:h-16 flex items-center justify-center text-amber-400 font-bold text-sm md:text-base"
            >
              {rank}
            </div>
          ))}
        </div>

        {/* Board and file labels container */}
        <div className="flex flex-col gap-2">
          {/* Chess board */}
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
                  ? 'ring-4 ring-blue-500 ring-offset-2'
                  : isValidMoveSquare
                    ? 'ring-4 ring-green-500 ring-offset-1 animate-pulse'
                    : isSingleMove
                      ? 'ring-4 ring-purple-400 ring-offset-1'
                      : '';

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                    className={`w-12 h-12 md:w-16 md:h-16 flex items-center justify-center text-4xl md:text-5xl cursor-pointer
                      ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                      ${ringClass}
                      hover:opacity-80 hover:scale-105 active:scale-95
                      transition-all duration-200 ease-in-out`}
                  >
                    <span
                      className="transition-transform duration-150 ease-in-out select-none"
                      style={piece ? getPieceStyle(piece.color) : {}}
                    >
                      {getPieceSymbol(piece)}
                    </span>
                  </div>
                );
              })
            ))}
          </div>

          {/* File labels (bottom: a-h) */}
          <div className="grid grid-cols-8 gap-0">
            {files.map((file) => (
              <div
                key={file}
                className="w-12 md:w-16 h-6 flex items-center justify-center text-amber-400 font-bold text-sm md:text-base"
              >
                {file}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChessBoard;