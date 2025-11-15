import React from 'react';

const PromotionModal = ({
  handlePromotionChoice,
  promotionSquare,
  getPieceStyle,
  getPieceSymbol,
}) => {
  if (!promotionSquare) return null;

  return (
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
  );
};

export default PromotionModal;