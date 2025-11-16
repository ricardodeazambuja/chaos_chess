/**
 * WebRTCAdapter - Manual Signaling Implementation
 *
 * This adapter implements peer-to-peer connections using native WebRTC APIs
 * with manual signaling (copy-paste SDP exchange). This is truly serverless -
 * users manually exchange connection codes instead of using a signaling server.
 *
 * Flow:
 * 1. Host calls createConnection() -> gets offer code
 * 2. Guest calls joinConnection(offerCode) -> gets answer code to share back
 * 3. Host calls acceptAnswer(answerCode) -> connection established
 * 4. Both peers can now broadcast() messages
 */

import type {
  INetworkAdapter,
  ConnectionInfo,
  NetworkMessage,
  ConnectionStatus,
} from '../INetworkAdapter';
import { minifySDP, expandSDP, calculateSizeReduction } from '../utils/sdp-minify';

// LocalStorage constants for connection persistence
const STORAGE_KEY = 'chaosChess_connection';
const CONNECTION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

interface StoredConnectionState {
  role: 'host';
  localDescription: RTCSessionDescriptionInit;
  timestamp: number;
}

export class WebRTCAdapter implements INetworkAdapter {
  // ============================================================================
  // Private State
  // ============================================================================

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private _role: 'host' | 'guest' | null = null;
  private _status: ConnectionStatus = 'disconnected';
  private _statusMessage: string | null = null;
  private _isConnected: boolean = false;

  // Callbacks
  private messageCallback: ((message: NetworkMessage) => void) | null = null;
  private statusCallback: ((status: ConnectionStatus, message: string | null) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;

  // Connection data for UI display
  private offerCode: string = '';
  private answerCode: string = '';

  // WebRTC configuration
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // ============================================================================
  // Public Properties (INetworkAdapter)
  // ============================================================================

  get isConnected(): boolean {
    return this._isConnected;
  }

  get role(): 'host' | 'guest' | null {
    return this._role;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get statusMessage(): string | null {
    return this._statusMessage;
  }

  // ============================================================================
  // Connection Management (INetworkAdapter)
  // ============================================================================

  async createConnection(): Promise<ConnectionInfo> {
    this.setStatus('connecting', 'Creating connection...');

    try {
      // Create peer connection
      const pc = new RTCPeerConnection(this.rtcConfig);
      this.peerConnection = pc;
      this.setupConnectionMonitoring(pc);

      // Create data channel
      const dc = pc.createDataChannel('gameChannel');
      this.dataChannel = dc;
      this.setupDataChannel(dc);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete with a timeout
      await Promise.race([
        this.waitForIceGathering(pc),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ICE gathering timed out after 15 seconds')), 15000)
        ),
      ]);

      // Save to localStorage for later restoration
      if (pc.localDescription) {
        this.saveConnectionState(pc.localDescription);
      }

      // Generate minified offer code (compressed SDP)
      const offerCode = minifySDP(pc.localDescription);
      this.offerCode = offerCode;

      // Log size reduction in development
      if (import.meta.env.DEV) {
        const stats = calculateSizeReduction(pc.localDescription, offerCode);
        console.log(`📦 SDP Compression Stats:
  Original: ${stats.originalSize} chars
  Minified: ${stats.minifiedSize} chars
  Saved: ${stats.reduction} chars (${stats.reductionPercent}% reduction)`);
      }

      this._role = 'host';
      this.setStatus('connecting', 'Waiting for guest to join...');

      return {
        code: offerCode,
        role: 'host',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus('failed', `Failed to create connection: ${errorMsg}`);
      this.handleError(`Failed to create connection: ${errorMsg}`);
      throw error;
    }
  }

  async joinConnection(code: string): Promise<void> {
    this.setStatus('connecting', 'Joining connection...');

    try {
      // Expand minified offer code to full SDP
      const offer = expandSDP(code.trim());

      // Create peer connection
      const pc = new RTCPeerConnection(this.rtcConfig);
      this.peerConnection = pc;
      this.setupConnectionMonitoring(pc);

      // Setup data channel listener
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        this.dataChannel = dc;
        this.setupDataChannel(dc);
      };

      // Set remote offer and create answer
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering
      await this.waitForIceGathering(pc);

      // Generate minified answer code (compressed SDP)
      const answerCode = minifySDP(pc.localDescription);
      this.answerCode = answerCode;

      // Log size reduction in development
      if (import.meta.env.DEV) {
        const stats = calculateSizeReduction(pc.localDescription, answerCode);
        console.log(`📦 SDP Compression Stats (Answer):
  Original: ${stats.originalSize} chars
  Minified: ${stats.minifiedSize} chars
  Saved: ${stats.reduction} chars (${stats.reductionPercent}% reduction)`);
      }

      this._role = 'guest';
      this.setStatus('connecting', 'Waiting for host to accept answer...');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus('failed', `Failed to join connection: ${errorMsg}`);
      this.handleError(`Invalid offer code: ${errorMsg}`);
      throw error;
    }
  }

  async acceptAnswer(answerCode: string): Promise<void> {
    try {
      // Expand minified answer code to full SDP
      const answer = expandSDP(answerCode.trim());

      // Host must have an active peer connection with a local offer already set
      if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
        throw new Error('Host connection not active. Please create a host connection first.');
      }

      // Apply remote answer
      await this.peerConnection.setRemoteDescription(answer);

      this._role = 'host'; // Confirm role as host
      this.setStatus('connected', '✅ Connected!'); // Set status to connected
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus('failed', `Failed to accept answer: ${errorMsg}`);
      this.handleError(`Invalid answer code: ${errorMsg}`);
      this.clearConnectionState(); // Clear any potentially bad state
      throw error;
    }
  }

  disconnect(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    this._role = null;
    this._isConnected = false;
    this.offerCode = '';
    this.answerCode = '';
    this.setStatus('disconnected', null);
  }

  // ============================================================================
  // Messaging (INetworkAdapter)
  // ============================================================================

  broadcast(message: NetworkMessage): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    } else {
      console.warn('Cannot broadcast: data channel not ready');
    }
  }

  onMessage(callback: (message: NetworkMessage) => void): void {
    this.messageCallback = callback;
  }

  // ============================================================================
  // Events (INetworkAdapter)
  // ============================================================================

  onStatusChange(callback: (status: ConnectionStatus, message: string | null) => void): void {
    this.statusCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  // ============================================================================
  // Additional Data (Optional)
  // ============================================================================

  getConnectionData(): { offer?: string; answer?: string } {
    return {
      offer: this.offerCode,
      answer: this.answerCode,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setupConnectionMonitoring(pc: RTCPeerConnection): void {
    pc.oniceconnectionstatechange = () => {
      switch (pc.iceConnectionState) {
        case 'connected':
        case 'completed':
          this.setStatus('connected', '✅ Connected!');
          break;
        case 'disconnected':
          this.setStatus('disconnected', '⚠️ Connection lost. Please refresh and reconnect.');
          this._isConnected = false;
          break;
        case 'failed':
          this.setStatus('failed', '❌ Connection failed. Please try again.');
          this._isConnected = false;
          break;
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this._isConnected = true;
          this.setStatus('connected', '✅ Connected!');
          break;
        case 'failed':
        case 'closed':
          this._isConnected = false;
          this.setStatus('failed', '❌ Connection failed. Please try again.');
          break;
      }
    };
  }

  private setupDataChannel(dc: RTCDataChannel): void {
    dc.onopen = () => {
      this._isConnected = true;
      this.setStatus('connected', '✅ Connected!');
      this.clearConnectionState();
    };

    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (this.messageCallback) {
          this.messageCallback(message);
        }
      } catch (error) {
        this.handleError('Failed to parse message');
      }
    };

    dc.onerror = (error) => {
      this.handleError('Data channel error occurred');
    };

    dc.onclose = () => {
      this._isConnected = false;
      this.setStatus('closed', 'Connection closed');
    };
  }

  private async waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise<void>((resolve) => {
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
  }

  private setStatus(status: ConnectionStatus, message: string | null): void {
    this._status = status;
    this._statusMessage = message;

    if (this.statusCallback) {
      this.statusCallback(status, message);
    }
  }

  private handleError(error: string): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  // ============================================================================
  // LocalStorage Helpers
  // ============================================================================

  private saveConnectionState(localDescription: RTCSessionDescriptionInit): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          role: 'host',
          localDescription,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      // Silently fail - localStorage may be disabled
    }
  }

  private loadConnectionState(): StoredConnectionState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data: StoredConnectionState = JSON.parse(stored);

      // Check if expired
      if (Date.now() - data.timestamp > CONNECTION_EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  private clearConnectionState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Silently fail
    }
  }
}
