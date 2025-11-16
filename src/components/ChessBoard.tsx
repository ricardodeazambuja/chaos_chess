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
    <div className="bg-slate-800 p-2 sm:p-4 rounded-xl shadow-2xl w-full max-w-2xl">
      <div className="flex gap-1 sm:gap-2 items-start">
        {/* Rank labels (left side: 8-1) */}
        <div className="grid grid-rows-8 gap-0 w-4 sm:w-6 self-stretch">
          {ranks.map((rank) => (
            <div
              key={rank}
              className="flex items-center justify-center text-amber-400 font-bold text-xs sm:text-sm md:text-base"
            >
              {rank}
            </div>
          ))}
        </div>

        {/* Board and file labels container */}
        <div className="flex flex-col gap-1 sm:gap-2 flex-1">
          {/* Chess board */}
          <div className="grid grid-cols-8 gap-0 border-2 sm:border-4 border-amber-600 aspect-square w-full">
            {board.map((row, rowIndex) => (
              row.map((piece, colIndex) => {
                const isLight = (rowIndex + colIndex) % 2 === 0;
                const isSelected = selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === colIndex;
                const isValidMoveSquare = validMoves.some(m => m.row === rowIndex && m.col === colIndex);
                const isSingleMoveFrom = singleMove && singleMove.from.row === rowIndex && singleMove.from.col === colIndex;
                const isSingleMoveTo = singleMove && singleMove.to.row === rowIndex && singleMove.to.col === colIndex;
                const isSingleMove = isSingleMoveFrom || isSingleMoveTo;

                const ringClass = isSelected
                  ? 'ring-2 sm:ring-4 ring-blue-500 ring-offset-1 sm:ring-offset-2'
                  : isValidMoveSquare
                    ? 'ring-2 sm:ring-4 ring-green-500 ring-offset-1 animate-pulse'
                    : isSingleMove
                      ? 'ring-2 sm:ring-4 ring-purple-400 ring-offset-1'
                      : '';

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                    className={`aspect-square flex items-center justify-center text-2xl sm:text-4xl md:text-5xl cursor-pointer
                      ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                      ${ringClass}
                      hover:opacity-80 active:scale-95
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
          <div className="grid grid-cols-8 gap-0 w-full">
            {files.map((file) => (
              <div
                key={file}
                className="h-4 sm:h-6 flex items-center justify-center text-amber-400 font-bold text-xs sm:text-sm md:text-base"
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