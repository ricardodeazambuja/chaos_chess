/**
 * Network Adapter Interface
 *
 * This interface defines the contract for all network implementations.
 * The game logic uses this interface and doesn't care about the underlying
 * network technology (WebRTC, WebSockets, simple-peer, Trystero, etc.)
 *
 * Benefits:
 * - Easy to swap network implementations
 * - Simple to test (mock the interface)
 * - Clean separation of concerns
 * - Future-proof (add new backends without changing game logic)
 */

/**
 * Information returned when creating a connection as host
 */
export interface ConnectionInfo {
  code: string;        // Shareable connection code/URL for guests to join
  role: 'host';        // Always 'host' when creating a connection
}

/**
 * Network message payload
 * The adapter handles serialization/deserialization
 */
export type NetworkMessage = any;

/**
 * Connection status strings
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'closed';

/**
 * Main Network Adapter Interface
 * All network implementations must implement this interface
 */
export interface INetworkAdapter {
  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Create a new connection as host
   * @returns Promise that resolves with connection info to share with guests
   */
  createConnection(): Promise<ConnectionInfo>;

  /**
   * Join an existing connection as guest
   * @param code - Connection code/URL from host
   * @returns Promise that resolves when connection is established
   */
  joinConnection(code: string): Promise<void>;

  /**
   * Manually accept answer from guest (for manual signaling flows)
   * @param answerCode - Answer code from guest
   */
  acceptAnswer?(answerCode: string): Promise<void>;

  /**
   * Disconnect and clean up resources
   */
  disconnect(): void;

  // ============================================================================
  // State
  // ============================================================================

  /**
   * Current connection state
   */
  readonly isConnected: boolean;

  /**
   * Role in the network (host creates, guest joins)
   */
  readonly role: 'host' | 'guest' | null;

  /**
   * Current connection status
   */
  readonly status: ConnectionStatus;

  /**
   * Human-readable status message
   */
  readonly statusMessage: string | null;

  // ============================================================================
  // Messaging
  // ============================================================================

  /**
   * Send a message to the connected peer(s)
   * For 1v1: sends to the other peer
   * For multi-peer: host broadcasts to all guests
   * @param message - Message to send (will be JSON serialized)
   */
  broadcast(message: NetworkMessage): void;

  /**
   * Register callback for incoming messages
   * @param callback - Function to call when message received
   */
  onMessage(callback: (message: NetworkMessage) => void): void;

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Register callback for connection status changes
   * @param callback - Function to call when status changes
   */
  onStatusChange(callback: (status: ConnectionStatus, message: string | null) => void): void;

  /**
   * Register callback for errors
   * @param callback - Function to call when error occurs
   */
  onError(callback: (error: string) => void): void;

  // ============================================================================
  // Additional Data (for UI display)
  // ============================================================================

  /**
   * Get connection offer/answer data for manual exchange (optional)
   * Some implementations (WebRTC manual signaling) need this
   */
  getConnectionData?(): {
    offer?: string;
    answer?: string;
  };
}

/**
 * Factory function type for creating network adapters
 */
export type NetworkAdapterFactory = () => INetworkAdapter;

/**
 * Available network adapter types
 */
export enum NetworkAdapterType {
  WEBRTC_MANUAL = 'webrtc-manual',      // Current implementation (manual SDP exchange)
  SIMPLE_PEER = 'simple-peer',          // Using simple-peer library
  TRYSTERO = 'trystero',                // Using Trystero (serverless)
  PEERJS = 'peerjs',                    // Using PeerJS
  // Future options:
  // WEBSOCKET = 'websocket',
  // SOCKETIO = 'socketio',
}
