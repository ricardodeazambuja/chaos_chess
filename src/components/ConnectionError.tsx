import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConnectionErrorProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

const ConnectionError: React.FC<ConnectionErrorProps> = ({ message, onDismiss, onRetry }) => {
  // Parse message into lines
  const lines = message.split('\n').filter(line => line.trim());

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X size={24} />
        </button>

        {/* Icon and title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Connection Failed</h2>
        </div>

        {/* Message content */}
        <div className="space-y-2 mb-6">
          {lines.map((line, index) => {
            // Check if it's a bullet point
            if (line.trim().startsWith('•')) {
              return (
                <div key={index} className="flex gap-2 text-slate-600">
                  <span className="text-red-500">•</span>
                  <span className="text-sm">{line.trim().substring(1).trim()}</span>
                </div>
              );
            } else if (line.includes('❌')) {
              return (
                <p key={index} className="font-semibold text-slate-800">
                  {line}
                </p>
              );
            } else {
              return (
                <p key={index} className="text-slate-600 text-sm">
                  {line}
                </p>
              );
            }
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Additional help */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            💡 Tip: This issue affects ~20% of users due to network restrictions.
            <br />
            Try switching networks or contact your network administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionError;
