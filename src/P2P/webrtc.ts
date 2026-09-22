import {
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
} from 'react-native-webrtc';
import type { DataChannelLike } from './PeerLink';
import { rtcIceServers } from './config';

/**
 * Thin factory around react-native-webrtc. Data-channel only (no media
 * streams) — SDP + ICE are gathered up-front (no trickle sub-documents).
 * Types are inferred from the library's own classes (they are published as
 * default-exported classes, not named types).
 */

export { RTCIceCandidate, RTCSessionDescription };

type PeerConnection = InstanceType<typeof RTCPeerConnection>;
type PeerConfig = ConstructorParameters<typeof RTCPeerConnection>[0];
type DataChannel = ReturnType<typeof RTCPeerConnection.prototype.createDataChannel>;
type DataChannelOptions = NonNullable<Parameters<typeof RTCPeerConnection.prototype.createDataChannel>[1]>;

export type { DataChannel, DataChannelOptions, PeerConfig, PeerConnection };

export function createPeerConnection(): PeerConnection {
  const configuration: PeerConfig = {
    iceServers: rtcIceServers(),
    bundlePolicy: 'max-bundle',
  };
  return new RTCPeerConnection(configuration);
}

export function dataChannelOptions(): DataChannelOptions {
  return {ordered: true};
}

export type SignalingPayloadArgs = {
  sdp: string;
  candidates: {candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null}[];
};

/** Wait for ICE gathering to complete, then snapshot sdp + candidates. */
export async function gatherDescription(
  pc: PeerConnection,
  kind: 'offer' | 'answer' = 'offer',
): Promise<SignalingPayloadArgs> {
  const candidates: {candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null}[] = [];
  pc.onicecandidate = (event: {
    candidate?: {candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null} | null;
  }) => {
    if (event.candidate) {
      candidates.push({
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    }
  };

  if (!pc.localDescription) {
    const next = kind === 'offer' ? await pc.createOffer() : await pc.createAnswer();
    await pc.setLocalDescription(next);
  }

  if (pc.iceGatheringState === 'complete') {
    return {sdp: pc.localDescription?.sdp ?? '', candidates};
  }

  await new Promise<void>(resolve => {
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') resolve();
    };
    const poll = setInterval(() => {
      if (pc.iceGatheringState === 'complete') {
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });
  return {sdp: pc.localDescription?.sdp ?? '', candidates};
}

/** Apply a remote description + its ICE candidates. */
export async function applyRemote(
  pc: PeerConnection,
  payload: SignalingPayloadArgs,
  type: 'offer' | 'answer',
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription({type, sdp: payload.sdp}));
  for (const c of payload.candidates) {
    if (!c?.candidate) continue;
    await pc.addIceCandidate(new RTCIceCandidate(c));
  }
}

export function createDataChannel(pc: PeerConnection): DataChannel {
  const channel = pc.createDataChannel('chat', dataChannelOptions());
  channel.binaryType = 'arraybuffer';
  return channel;
}

/**
 * Adapter that maps react-native-webrtc's `onopen/onmessage/onclose/onerror`
 * callback properties onto the EventTarget-style `DataChannelLike` surface
 * PeerLink expects (the library's default-export type does not expose
 * `addEventListener`).
 */
export function createDataChannelAdapter(channel: DataChannel): DataChannelLike {
  const raw = channel as unknown as {
    readyState: string;
    bufferedAmount: number;
    send(data: string | Uint8Array | ArrayBuffer): void;
    close(): void;
    onopen?: ((event?: unknown) => void) | null;
    onmessage?: ((event?: unknown) => void) | null;
    onclose?: ((event?: unknown) => void) | null;
    onerror?: ((event?: unknown) => void) | null;
  };
  const listeners = new Map<string, ((event?: any) => void)[]>();
  const emit = (type: string, event?: any): void => {
    const list = listeners.get(type);
    if (!list) return;
    for (const l of [...list]) l(event);
  };

  raw.onopen = () => emit('open', {});
  raw.onclose = () => emit('close', {});
  raw.onerror = (event) => emit('error', event);
  raw.onmessage = (event) => emit('message', event);

  return {
    get readyState(): string {
      return raw.readyState;
    },
    get bufferedAmount(): number {
      return raw.bufferedAmount;
    },
    send(data: string | Uint8Array): void {
      raw.send(data);
    },
    close(): void {
      raw.close();
    },
    addEventListener(type: string, listener: (event: any) => void): void {
      const arr = listeners.get(type) ?? [];
      arr.push(listener);
      listeners.set(type, arr);
    },
    removeEventListener(type: string, listener: (event: any) => void): void {
      const arr = listeners.get(type) ?? [];
      listeners.set(type, arr.filter(l => l !== listener));
    },
  };
}