import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

interface ChatMessage {
  playerName: string;
  message: string;
  timestamp: number;
  isOwn?: boolean;
}

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  playerName: string;
  disabled?: boolean;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, playerName, disabled = false }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col h-full">
      <h3 className="font-bold text-slate-800 mb-3 text-sm">💬 Chat</h3>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-400 text-center italic">No messages yet...</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`text-xs p-2 rounded-lg ${
                msg.isOwn
                  ? 'bg-blue-50 border-l-2 border-blue-400 ml-4'
                  : 'bg-slate-50 border-l-2 border-slate-300 mr-4'
              }`}
            >
              <div className="font-bold text-slate-700 mb-1">{msg.playerName}</div>
              <div className="text-slate-600 break-words">{msg.message}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={disabled ? 'Chat disabled' : 'Type a message...'}
          disabled={disabled}
          className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          maxLength={200}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !inputValue.trim()}
          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
