import {PermissionsAndroid, Platform} from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import type { MediaType } from '../services/callService';

export interface IceCandidateData {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface CallPeerConnection {
  pc: RTCPeerConnection;
  localStream: any;
  remoteStream: any;
  localCandidates: IceCandidateData[];
  pendingRemoteCandidates: RTCIceCandidate[];
}

class CallManager {
  private peerConnections = new Map<string, CallPeerConnection>();
  private streamListeners = new Set<(callId: string, stream: any) => void>();
  private connectionStateListeners = new Map<string, Set<(state: string) => void>>();

  async createPeerConnection(callId: string, mediaType: MediaType = 'audio-video'): Promise<CallPeerConnection> {
    const existing = this.peerConnections.get(callId);
    if (existing) return existing;

    const config = {
      iceServers: [
        {urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']},
        {urls: ['stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302']},
      ],
    };

    const pc = new RTCPeerConnection(config);
    let localStream: any = null;

    try {
      const constraints =
        mediaType === 'audio'
          ? {audio: true}
          : {audio: true, video: {width: 640, height: 480}};

      // react-native-webrtc's native getUserMedia path CRASHES the app on
      // Android when the permission is missing/denied (a process-killing
      // IllegalStateException), and it happens on both callers and receivers.
      // Pre-check the permission (no dialog) and only touch getUserMedia when
      // it is already granted — otherwise run the call without local media.
      if (await this.hasLocalMediaPermission(mediaType)) {
        localStream = await mediaDevices.getUserMedia(constraints as any);

        if (localStream) {
          localStream.getTracks().forEach((track: any) => {
            pc.addTrack(track, localStream);
          });
        }
      }
    } catch (err) {
      // Never let a media error take down the call or the app.
      console.warn('Local media unavailable, continuing without it:', err);
    }

    let remoteStream: any = null;
    const localCandidates: IceCandidateData[] = [];
    const pendingRemoteCandidates: RTCIceCandidate[] = [];

    pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
        const conn = this.peerConnections.get(callId);
        if (conn) {
          conn.remoteStream = remoteStream;
        }
        this.notifyStreamListeners(callId, remoteStream);
      }
    };

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        localCandidates.push({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const listeners = this.connectionStateListeners.get(callId);
      if (listeners) listeners.forEach(listener => listener(pc.connectionState));
    };

    pc.oniceconnectionstatechange = () => {};

    pc.onsignalingstatechange = () => {};

    const connection: CallPeerConnection = {
      pc,
      localStream,
      remoteStream,
      localCandidates,
      pendingRemoteCandidates,
    };

    this.peerConnections.set(callId, connection);
    return connection;
  }

  async createOffer(callId: string): Promise<string> {
    const connection = this.peerConnections.get(callId);
    if (!connection) throw new Error('Peer connection not found');

    const offer = await connection.pc.createOffer();

    await connection.pc.setLocalDescription(offer);
    return offer.sdp;
  }

  async createAnswer(callId: string): Promise<string> {
    const connection = this.peerConnections.get(callId);
    if (!connection) throw new Error('Peer connection not found');

    const answer = await connection.pc.createAnswer();

    await connection.pc.setLocalDescription(answer);
    return answer.sdp;
  }

  async setRemoteDescription(callId: string, sdp: string, type: 'offer' | 'answer'): Promise<void> {
    const connection = this.peerConnections.get(callId);
    if (!connection) throw new Error('Peer connection not found');

    try {
      const description = new (RTCSessionDescription as any)({type, sdp});
      await connection.pc.setRemoteDescription(description);

      // Flush any candidates that arrived before the remote description was set
      for (const candidate of connection.pendingRemoteCandidates) {
        try {
          await connection.pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn('Failed to add queued ICE candidate:', err);
        }
      }
      connection.pendingRemoteCandidates = [];
    } catch (err) {
      console.error(`❌ Failed to set remote ${type}:`, err);
      throw err;
    }
  }

  async setRemoteWithCandidates(
    callId: string,
    sdp: string,
    type: 'offer' | 'answer',
    candidates: IceCandidateData[] = []
  ): Promise<void> {
    await this.setRemoteDescription(callId, sdp, type);
    for (const data of candidates) {
      if (!data?.candidate) continue;
      await this.addICECandidate(callId, new RTCIceCandidate(data));
    }
  }

  async waitForIceGathering(callId: string, timeoutMs = 8000): Promise<void> {
    const connection = this.peerConnections.get(callId);
    if (!connection) return;
    const pc = connection.pc;
    if (pc.iceGatheringState === 'complete') return;

    await new Promise<void>(resolve => {
      const done = () => {
        clearTimeout(timer);
        clearInterval(poll);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      const poll = setInterval(() => {
        if (pc.iceGatheringState === 'complete') done();
      }, 100);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') done();
      };
    });
  }

  getLocalCandidates(callId: string): IceCandidateData[] {
    const connection = this.peerConnections.get(callId);
    return connection ? [...connection.localCandidates] : [];
  }

  async addICECandidate(callId: string, candidate: RTCIceCandidate): Promise<void> {
    const connection = this.peerConnections.get(callId);
    if (!connection) {
      console.warn('Peer connection not found for ICE candidate');
      return;
    }

    try {
      await connection.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!connection.pc.remoteDescription) {
        // Remote description not set yet — queue it and flush after setRemoteDescription
        connection.pendingRemoteCandidates.push(candidate);
        return;
      }
      console.warn('Failed to add ICE candidate:', err);
    }
  }

  getConnection(callId: string): CallPeerConnection | undefined {
    return this.peerConnections.get(callId);
  }

  getLocalStream(callId: string): any {
    return this.peerConnections.get(callId)?.localStream;
  }

  getRemoteStream(callId: string): any {
    return this.peerConnections.get(callId)?.remoteStream;
  }

  isStreamReady(callId: string): boolean {
    const connection = this.peerConnections.get(callId);
    return !!(connection?.localStream && connection?.remoteStream);
  }

  async closeConnection(callId: string): Promise<void> {
    const connection = this.peerConnections.get(callId);
    if (!connection) return;

    if (connection.localStream) {
      connection.localStream.getTracks().forEach((track: any) => {
        track.stop();
      });
    }

    connection.pc.close();
    this.peerConnections.delete(callId);
    this.connectionStateListeners.delete(callId);
  }

  subscribeStreams(listener: (callId: string, stream: any) => void): () => void {
    this.streamListeners.add(listener);
    return () => this.streamListeners.delete(listener);
  }

  subscribeConnectionState(callId: string, listener: (state: string) => void): () => void {
    let listeners = this.connectionStateListeners.get(callId);
    if (!listeners) {
      listeners = new Set();
      this.connectionStateListeners.set(callId, listeners);
    }
    listeners.add(listener);
    const connection = this.peerConnections.get(callId);
    if (connection) listener(connection.pc.connectionState);
    return () => {
      const set = this.connectionStateListeners.get(callId);
      if (!set) return;
      set.delete(listener);
      if (set.size === 0) this.connectionStateListeners.delete(callId);
    };
  }

  private notifyStreamListeners(callId: string, stream: any): void {
    this.streamListeners.forEach(listener => listener(callId, stream));
  }

  private async hasLocalMediaPermission(mediaType: MediaType): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      let granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (mediaType !== 'audio') {
        granted =
          granted &&
          (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA));
      }
      return granted;
    } catch {
      return false;
    }
  }
}

export const callManager = new CallManager();
