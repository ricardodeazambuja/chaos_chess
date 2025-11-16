import React from 'react';
import { RotateCcw } from 'lucide-react';

interface DisconnectionModalProps {
  isOpen: boolean;
  onReturnToSetup: () => void;
}

const DisconnectionModal: React.FC<DisconnectionModalProps> = ({
  isOpen,
  onReturnToSetup
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">
            Connection Lost
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Your opponent has disconnected or lost their internet connection.
          </p>
          <p className="text-slate-500 text-sm mt-3">
            The game will resume automatically if they reconnect.
          </p>
        </div>

        {/* Single Action Button */}
        <button
          onClick={onReturnToSetup}
          className="w-full px-4 py-3 bg-slate-500 text-white font-semibold rounded-lg hover:bg-slate-600 active:bg-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={18} />
          Return to Setup
        </button>
      </div>
    </div>
  );
};

export default DisconnectionModal;
