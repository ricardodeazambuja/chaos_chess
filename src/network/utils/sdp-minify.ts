/**
 * SDP Minification Utilities
 *
 * Reduces WebRTC SDP size from ~5-10KB to ~300-600 bytes by extracting
 * only essential fields for datachannel-only connections.
 *
 * For datachannel connections, we only need:
 * - ICE candidates (connection endpoints)
 * - ICE credentials (ufrag/pwd)
 * - DTLS fingerprint (encryption)
 * - Setup role (active/passive)
 * - SDP type (offer/answer)
 */

interface MinimalSDP {
  type: 'offer' | 'answer';
  ufrag: string;
  pwd: string;
  fingerprint: string;
  setup: string;
  candidates: string[];
}

/**
 * Extract minimal connection data from full SDP
 */
export function minifySDP(sdp: RTCSessionDescriptionInit): string {
  const sdpText = sdp.sdp || '';

  // Extract ICE credentials
  const ufragMatch = sdpText.match(/a=ice-ufrag:(\S+)/);
  const pwdMatch = sdpText.match(/a=ice-pwd:(\S+)/);

  // Extract DTLS fingerprint
  const fingerprintMatch = sdpText.match(/a=fingerprint:(\S+ \S+)/);

  // Extract setup role
  const setupMatch = sdpText.match(/a=setup:(\S+)/);

  // Extract all ICE candidates (capture entire line after "a=candidate:")
  const candidateMatches = sdpText.matchAll(/a=candidate:(.+)/g);
  const candidates = Array.from(candidateMatches, m => m[1].trim());

  if (!ufragMatch || !pwdMatch || !fingerprintMatch || !setupMatch) {
    throw new Error('Failed to extract required SDP fields');
  }

  const minimal: MinimalSDP = {
    type: sdp.type as 'offer' | 'answer',
    ufrag: ufragMatch[1],
    pwd: pwdMatch[1],
    fingerprint: fingerprintMatch[1],
    setup: setupMatch[1],
    candidates: candidates,
  };

  // Convert to JSON and base64 encode
  return btoa(JSON.stringify(minimal));
}

/**
 * Reconstruct full SDP from minimal data
 */
export function expandSDP(minimalCode: string): RTCSessionDescriptionInit {
  const minimal: MinimalSDP = JSON.parse(atob(minimalCode));

  // Build minimal but valid SDP structure
  const sdpLines = [
    'v=0',
    'o=- 0 0 IN IP4 0.0.0.0',
    's=-',
    't=0 0',
    // Media line for datachannel (application)
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    // ICE credentials
    `a=ice-ufrag:${minimal.ufrag}`,
    `a=ice-pwd:${minimal.pwd}`,
    'a=ice-options:trickle',
    // DTLS fingerprint
    `a=fingerprint:${minimal.fingerprint}`,
    `a=setup:${minimal.setup}`,
    // Mid
    'a=mid:0',
    // SCTP port for datachannel
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];

  // Add all ICE candidates
  for (const candidate of minimal.candidates) {
    sdpLines.push(`a=candidate:${candidate}`);
  }

  // Add end-of-candidates marker
  sdpLines.push('a=end-of-candidates');

  const sdp = sdpLines.join('\r\n') + '\r\n';

  return {
    type: minimal.type,
    sdp: sdp,
  };
}

/**
 * Calculate size reduction percentage
 */
export function calculateSizeReduction(original: RTCSessionDescriptionInit, minified: string): {
  originalSize: number;
  minifiedSize: number;
  reduction: number;
  reductionPercent: string;
} {
  const originalSize = btoa(JSON.stringify(original)).length;
  const minifiedSize = minified.length;
  const reduction = originalSize - minifiedSize;
  const reductionPercent = ((reduction / originalSize) * 100).toFixed(1);

  return {
    originalSize,
    minifiedSize,
    reduction,
    reductionPercent,
  };
}
