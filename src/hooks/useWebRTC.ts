import { useState, useRef, useEffect, useCallback } from 'react';

// LocalStorage constants
const STORAGE_KEY = 'chaosChess_connection';
const CONNECTION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// LocalStorage helper functions
const saveConnectionState = (localDescription: RTCSessionDescriptionInit) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      role: 'host',
      localDescription,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Failed to save connection state:', error);
  }
};

const loadConnectionState = (): { localDescription: RTCSessionDescriptionInit; timestamp: number } | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Check if expired
    if (Date.now() - data.timestamp > CONNECTION_EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to load connection state:', error);
    return null;
  }
};

const clearConnectionState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear connection state:', error);
  }
};

interface UseWebRTCProps {
  onMessage: (message: any) => void;
}

export const useWebRTC = ({ onMessage }: UseWebRTCProps) => {
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [connectionOffer, setConnectionOffer] = useState<string>('');
  const [connectionAnswer, setConnectionAnswer] = useState<string>('');
  const [hostOfferInput, setHostOfferInput] = useState<string>('');
  const [guestAnswerInput, setGuestAnswerInput] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [networkRole, setNetworkRole] = useState<'host' | 'guest' | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const handlePeerMessage = useCallback((data: string) => {
    try {
      const message = JSON.parse(data);
      onMessage(message);
    } catch (error) {
      console.error('Failed to parse peer message:', error);
    }
  }, [onMessage]);

  const broadcastMove = useCallback((message: any) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(message));
    }
  }, [dataChannel]);

  const createHostConnection = useCallback(async () => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;

    // Create data channel
    const dc = pc.createDataChannel('gameChannel');
    setDataChannel(dc);

    dc.onopen = () => {
      console.log('Data channel opened');
      setIsConnected(true);
      clearConnectionState();
    };

    dc.onmessage = (event) => {
      handlePeerMessage(event.data);
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          }
        });
      }
    });

    // Save to localStorage for later restoration
    if (pc.localDescription) {
      saveConnectionState(pc.localDescription);
    }

    // Generate shareable URL
    const offerString = btoa(JSON.stringify(pc.localDescription));
    const shareableURL = `${window.location.origin}${window.location.pathname}#offer=${offerString}`;
    setConnectionOffer(shareableURL);
    setNetworkRole('host');
  }, [handlePeerMessage]);

  const acceptGuestAnswer = useCallback(async (answerString: string) => {
    try {
      const answer = JSON.parse(atob(answerString));
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
        setGuestAnswerInput('');
      }
    } catch (error) {
      alert('Invalid answer code. Please check and try again.');
    }
  }, []);

  const createGuestConnection = useCallback(async (offerString: string) => {
    try {
      let offerCode = offerString;
      const offerPrefix = '#offer=';
      const offerIndex = offerCode.indexOf(offerPrefix);
      if (offerIndex !== -1) {
        offerCode = offerCode.substring(offerIndex + offerPrefix.length);
      }

      const offer = JSON.parse(atob(offerCode));

      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        setDataChannel(dc);

        dc.onopen = () => {
          console.log('Data channel opened');
          setIsConnected(true);
        };

        dc.onmessage = (event) => {
          handlePeerMessage(event.data);
        };
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          });
        }
      });

      // Generate shareable answer URL
      const answerString = btoa(JSON.stringify(pc.localDescription));
      const shareableURL = `${window.location.origin}${window.location.pathname}#answer=${answerString}`;
      setConnectionAnswer(shareableURL);
      setNetworkRole('guest');
      setHostOfferInput('');
    } catch (error) {
      alert('Invalid offer code. Please check and try again.');
    }
  }, [handlePeerMessage]);

  const processOfferFromURL = useCallback(async (offerCode: string) => {
    try {
      await createGuestConnection(offerCode);
    } catch (error) {
      console.error('Failed to process offer from URL:', error);
      alert('Failed to process connection link. Please try again or use manual setup.');
    }
  }, [createGuestConnection]);

  const processAnswerFromURL = useCallback(async (answerCode: string) => {
    try {
      console.log('[DEBUG] Processing answer from URL...');

      // Decode the answer
      console.log('[DEBUG] Decoding answer...');
      const answer = JSON.parse(atob(answerCode));
      console.log('[DEBUG] Answer decoded successfully');

      // If we already have an active peer connection, just apply the answer
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
        console.log('[DEBUG] Using existing peer connection, state:', peerConnectionRef.current.signalingState);
        await peerConnectionRef.current.setRemoteDescription(answer);
        console.log('[DEBUG] Remote description set successfully');
        setNetworkRole('host');
        return;
      }

      // Otherwise, restore from localStorage
      console.log('[DEBUG] No active peer connection, restoring from localStorage...');
      const savedState = loadConnectionState();

      if (!savedState) {
        console.error('[DEBUG] No saved state found in localStorage');
        alert('Connection expired or not found. Please start a new connection.');
        clearConnectionState();
        return;
      }

      console.log('[DEBUG] Saved state found, recreating peer connection...');

      // Recreate the peer connection
      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

      // Recreate data channel
      const dc = pc.createDataChannel('gameChannel');
      setDataChannel(dc);

      dc.onopen = () => {
        console.log('Data channel opened');
        setIsConnected(true);
        clearConnectionState();
      };

      dc.onmessage = (event) => {
        handlePeerMessage(event.data);
      };

      // Restore local description
      console.log('[DEBUG] Restoring local description...');
      await pc.setLocalDescription(savedState.localDescription);
      console.log('[DEBUG] Local description restored');

      // Apply remote answer
      console.log('[DEBUG] Applying remote answer...');
      await pc.setRemoteDescription(answer);
      console.log('[DEBUG] Remote answer applied successfully');

      setNetworkRole('host');
      setConnectionMessage('Connection established! Click "Start Game" to begin.');
      console.log('[DEBUG] Connection process complete!');
    } catch (error: any) {
      console.error('[ERROR] Failed to process answer from URL:', error);
      console.error('[ERROR] Error details:', error.message, error.stack);
      alert('Failed to process answer link. Please try again or use manual setup.');
      clearConnectionState();
    }
  }, [handlePeerMessage]);

  const resetConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (dataChannel) {
      dataChannel.close();
    }
    peerConnectionRef.current = null;
    setDataChannel(null);
    setIsConnected(false);
    setConnectionOffer('');
    setConnectionAnswer('');
    setNetworkRole(null);
    setConnectionMessage(null);
    setHostOfferInput('');
    setGuestAnswerInput('');
  }, [dataChannel]);

  // Process URL hash on mount and when hash changes
  useEffect(() => {
    const processHash = () => {
      const hash = window.location.hash;
      if (!hash) return;

      // Parse offer or answer from URL
      if (hash.startsWith('#offer=')) {
        const offerCode = hash.substring(7); // Remove '#offer='
        processOfferFromURL(offerCode);
        // Clear hash after processing
        window.history.replaceState(null, '', window.location.pathname);
      } else if (hash.startsWith('#answer=')) {
        const answerCode = hash.substring(8); // Remove '#answer='
        processAnswerFromURL(answerCode);
        // Clear hash after processing
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    // Process on mount
    processHash();

    // Listen for hash changes
    window.addEventListener('hashchange', processHash);

    return () => {
      window.removeEventListener('hashchange', processHash);
    };
  }, [processOfferFromURL, processAnswerFromURL]);

  return {
    dataChannel,
    connectionOffer,
    connectionAnswer,
    hostOfferInput,
    setHostOfferInput,
    guestAnswerInput,
    setGuestAnswerInput,
    isConnected,
    setIsConnected,
    connectionMessage,
    networkRole,
    setNetworkRole,
    peerConnectionRef,
    createHostConnection,
    acceptGuestAnswer,
    createGuestConnection,
    broadcastMove,
    resetConnection
  };
};
