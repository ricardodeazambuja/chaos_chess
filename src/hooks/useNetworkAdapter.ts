/**
 * useNetworkAdapter Hook
 *
 * React hook that wraps a network adapter (INetworkAdapter) and provides
 * a React-friendly interface with state management.
 *
 * This hook bridges the gap between the adapter pattern and React components,
 * managing adapter lifecycle and exposing state as React hooks.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { INetworkAdapter } from '../network/INetworkAdapter';
import { WebRTCAdapter } from '../network/adapters/WebRTCAdapter';

interface UseNetworkAdapterProps {
  onMessage: (message: any) => void;
  adapterType?: 'webrtc'; // Future: 'simple-peer' | 'trystero' | 'peerjs'
}

export const useNetworkAdapter = ({ onMessage, adapterType = 'webrtc' }: UseNetworkAdapterProps) => {
  // Create adapter instance (memoized)
  const adapterRef = useRef<INetworkAdapter | null>(null);

  if (!adapterRef.current) {
    // Factory pattern - create adapter based on type
    switch (adapterType) {
      case 'webrtc':
        adapterRef.current = new WebRTCAdapter();
        break;
      // Future:
      // case 'simple-peer':
      //   adapterRef.current = new SimplePeerAdapter();
      //   break;
      // case 'trystero':
      //   adapterRef.current = new TrysteroAdapter();
      //   break;
      default:
        adapterRef.current = new WebRTCAdapter();
    }
  }

  const adapter = adapterRef.current;

  // ============================================================================
  // State (mirrors adapter state for React reactivity)
  // ============================================================================

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(adapter.isConnected);
  const [networkRole, setNetworkRole] = useState<'host' | 'guest' | null>(adapter.role);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(adapter.statusMessage);

  // Connection data for UI
  const [connectionOffer, setConnectionOffer] = useState<string>('');
  const [connectionAnswer, setConnectionAnswer] = useState<string>('');

  // Input state for manual code entry
  const [hostOfferInput, setHostOfferInput] = useState<string>('');
  const [guestAnswerInput, setGuestAnswerInput] = useState<string>('');

  // ============================================================================
  // Subscribe to Adapter Events
  // ============================================================================

  useEffect(() => {
    // Subscribe to messages
    adapter.onMessage((message) => {
      onMessage(message);
    });

    // Subscribe to status changes
    adapter.onStatusChange((status, message) => {
      setIsConnected(adapter.isConnected);
      setNetworkRole(adapter.role);
      setConnectionMessage(message);

      // Update connection data if available
      if (adapter.getConnectionData) {
        const { offer, answer } = adapter.getConnectionData();
        if (offer) setConnectionOffer(offer);
        if (answer) setConnectionAnswer(answer);
      }

      // Notify parent of connection failures via onMessage
      if (status === 'failed' && message) {
        onMessage({
          type: 'CONNECTION_ERROR',
          error: message
        });
      }
    });

    // Subscribe to errors
    adapter.onError((error) => {
      // Could show a toast/alert here in the future
    });

    // Cleanup on unmount
    return () => {
      adapter.disconnect();
    };
  }, [adapter, onMessage]);

  // ============================================================================
  // Adapter Methods (wrapped for React)
  // ============================================================================

  const createHostConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const connectionInfo = await adapter.createConnection();
      setConnectionOffer(connectionInfo.code);
      setNetworkRole('host');
    } finally {
      setIsLoading(false);
    }
  }, [adapter]);

  const createGuestConnection = useCallback(async (offerCode: string) => {
    setIsLoading(true);
    try {
      await adapter.joinConnection(offerCode);
      // Get answer code from adapter
      if (adapter.getConnectionData) {
        const { answer } = adapter.getConnectionData();
        if (answer) setConnectionAnswer(answer);
      }
      setNetworkRole('guest');
    } finally {
      setIsLoading(false);
    }
  }, [adapter]);

  const acceptGuestAnswer = useCallback(async (answerCode: string) => {
    if (adapter.acceptAnswer) {
      setIsLoading(true);
      try {
        await adapter.acceptAnswer(answerCode);
      } finally {
        setIsLoading(false);
      }
    }
  }, [adapter]);

  const broadcastMove = useCallback((message: any) => {
    adapter.broadcast(message);
  }, [adapter]);

  const resetConnection = useCallback(() => {
    adapter.disconnect();
    setConnectionOffer('');
    setConnectionAnswer('');
    setHostOfferInput('');
    setGuestAnswerInput('');
    setIsConnected(false);
    setNetworkRole(null);
    setConnectionMessage(null);
  }, [adapter]);

  // ============================================================================
  // Return Interface (same as old useWebRTC)
  // ============================================================================

  return {
    // Connection data
    connectionOffer,
    connectionAnswer,

    // Input state
    hostOfferInput,
    setHostOfferInput,
    guestAnswerInput,
    setGuestAnswerInput,

    // Connection state
    isLoading,
    isConnected,
    setIsConnected, // Kept for compatibility, but adapter manages this
    connectionMessage,
    networkRole,
    setNetworkRole, // Kept for compatibility

    // Adapter reference (for advanced use cases)
    peerConnectionRef: adapterRef, // Renamed but kept for compatibility

    // Methods
    createHostConnection,
    acceptGuestAnswer,
    createGuestConnection,
    broadcastMove,
    resetConnection,

    // Future: Expose adapter directly for advanced features
    adapter,
  };
};
