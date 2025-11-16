import { useState, useEffect, useRef, useCallback } from 'react';
import type { INetworkAdapter } from '../network/INetworkAdapter';
import { WebRTCAdapter } from '../network/adapters/WebRTCAdapter';
import { wrapCode, unwrapCode } from '../network/utils/code-wrapper';

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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(adapter.isConnected);
  const [networkRole, setNetworkRole] = useState<'host' | 'guest' | null>(adapter.role);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(adapter.statusMessage);

  // Connection data for UI
  const [connectionOffer, setConnectionOffer] = useState<string>('');
  const [connectionAnswer, setConnectionAnswer] = useState<string>('');

  // Input state for manual code entry
  const [hostOfferInput, setHostOfferInput] = useState<string>('');
  const [guestAnswerInput, setGuestAnswerInput] = useState<string>('');
  
  // Ref for the countdown interval
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Countdown Timer Logic
  // ============================================================================

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startCountdown = useCallback((duration: number) => {
    stopCountdown(); // Ensure no multiple intervals are running
    setCountdown(duration);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
  }, [stopCountdown]);

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
        if (offer) setConnectionOffer(wrapCode(offer, 'OFFER'));
        if (answer) setConnectionAnswer(wrapCode(answer, 'ANSWER'));
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
      stopCountdown(); // Ensure cleanup on unmount
    };
  }, [adapter, onMessage, stopCountdown]);

  // ============================================================================
  // Adapter Methods (wrapped for React)
  // ============================================================================

  const createHostConnection = useCallback(async () => {
    setIsLoading(true);
    startCountdown(15);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection setup timed out after 15 seconds. Please check your network and try again.')), 15000)
      );

      const connectionInfo = await Promise.race([
        adapter.createConnection(),
        timeoutPromise
      ]);

      setConnectionOffer(wrapCode(connectionInfo.code, 'OFFER'));
      setNetworkRole('host');
    } catch (error) {
      onMessage({
        type: 'CONNECTION_ERROR',
        error: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
      adapter.disconnect(); // Clean up failed attempt
    } finally {
      setIsLoading(false);
      stopCountdown();
    }
  }, [adapter, onMessage, startCountdown, stopCountdown]);

  const createGuestConnection = useCallback(async (offerCode: string) => {
    setIsLoading(true);
    startCountdown(15);
    try {
      const { code: rawOffer, type } = unwrapCode(offerCode);
      if (type !== 'OFFER') {
        throw new Error('Invalid code type. An Offer code from the host is expected.');
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Joining game timed out after 15 seconds. Please check the code and your network.')), 15000)
      );
      
      await Promise.race([
        adapter.joinConnection(rawOffer),
        timeoutPromise
      ]);

      // Get answer code from adapter
      if (adapter.getConnectionData) {
        const { answer } = adapter.getConnectionData();
        if (answer) setConnectionAnswer(wrapCode(answer, 'ANSWER'));
      }
      setNetworkRole('guest');
    } catch (error) {
      onMessage({
        type: 'CONNECTION_ERROR',
        error: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
      adapter.disconnect(); // Clean up failed attempt
    } finally {
      setIsLoading(false);
      stopCountdown();
    }
  }, [adapter, onMessage, startCountdown, stopCountdown]);

  const acceptGuestAnswer = useCallback(async (answerCode: string) => {
    if (adapter.acceptAnswer) {
      setIsLoading(true);
      startCountdown(15);
      try {
        const { code: rawAnswer, type } = unwrapCode(answerCode);
        if (type !== 'ANSWER') {
          throw new Error('Invalid code type. An Answer code from the guest is expected.');
        }

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Accepting answer timed out after 15 seconds. Please check the code and your network.')), 15000)
        );

        await Promise.race([
          adapter.acceptAnswer(rawAnswer),
          timeoutPromise
        ]);

      } catch (error) {
        onMessage({
          type: 'CONNECTION_ERROR',
          error: error instanceof Error ? error.message : 'An unknown error occurred.',
        });
        adapter.disconnect(); // Clean up failed attempt
      } finally {
        setIsLoading(false);
        stopCountdown();
      }
    }
  }, [adapter, onMessage, startCountdown, stopCountdown]);

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

  const clearInputsAndError = useCallback(() => {
    setHostOfferInput('');
    setGuestAnswerInput('');
    setConnectionMessage(null); // Clear any status messages, including errors
  }, []);

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
    countdown,
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
    clearInputsAndError,

    // Future: Expose adapter directly for advanced features
    adapter,
  };
};
