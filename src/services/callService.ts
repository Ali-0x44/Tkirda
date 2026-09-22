import { getCurrentUser } from './authService';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'rejected' | 'missed';
export type CallDirection = 'incoming' | 'outgoing';
export type MediaType = 'audio' | 'video' | 'audio-video';

export interface Call {
  id: string;
  initiatorId: string;
  receiverId: string;
  direction: CallDirection;
  state: CallState;
  mediaType: MediaType;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number;
}

class CallService {
  private activeCall: Call | null = null;
  private listeners = new Set<(call: Call | null) => void>();
  private mediaStreamListeners = new Set<(stream: any) => void>();

  getCurrentCall(): Call | null {
    return this.activeCall;
  }

  createCall(receiverId: string, mediaType: MediaType = 'audio-video'): Call {
    const me = getCurrentUser();
    if (!me) throw new Error('Not authenticated');

    const call: Call = {
      id: `${me.uid}-${receiverId}-${Date.now()}`,
      initiatorId: me.uid,
      receiverId,
      direction: 'outgoing',
      state: 'ringing',
      mediaType,
      startedAt: null,
      endedAt: null,
      durationMs: 0,
    };

    this.activeCall = call;
    this.notifyListeners();
    return call;
  }

  receiveCall(
    initiatorId: string,
    callId: string,
    mediaType: MediaType = 'audio-video'
  ): Call {
    const me = getCurrentUser();
    if (!me) throw new Error('Not authenticated');

    const call: Call = {
      id: callId,
      initiatorId,
      receiverId: me.uid,
      direction: 'incoming',
      state: 'ringing',
      mediaType,
      startedAt: null,
      endedAt: null,
      durationMs: 0,
    };

    this.activeCall = call;
    this.notifyListeners();
    return call;
  }

  answerCall(): Call | null {
    if (!this.activeCall) return null;
    this.activeCall.state = 'connecting';
    this.notifyListeners();
    return this.activeCall;
  }

  rejectCall(): void {
    if (!this.activeCall) return;
    this.activeCall.state = 'rejected';
    this.activeCall.endedAt = Date.now();
    this.activeCall = null;
    this.notifyListeners();
  }

  startCall(): Call | null {
    if (!this.activeCall) return null;
    this.activeCall.state = 'active';
    this.activeCall.startedAt = Date.now();
    this.notifyListeners();
    return this.activeCall;
  }

  endCall(): void {
    if (!this.activeCall) return;
    this.activeCall.state = 'ended';
    this.activeCall.endedAt = Date.now();
    if (this.activeCall.startedAt) {
      this.activeCall.durationMs = this.activeCall.endedAt - this.activeCall.startedAt;
    }
    this.activeCall = null;
    this.notifyListeners();
  }

  missedCall(): void {
    if (!this.activeCall) return;
    this.activeCall.state = 'missed';
    this.activeCall.endedAt = Date.now();
    this.activeCall = null;
    this.notifyListeners();
  }

  updateCallState(state: CallState): void {
    if (!this.activeCall) return;
    this.activeCall.state = state;
    if (state === 'active' && !this.activeCall.startedAt) {
      this.activeCall.startedAt = Date.now();
    }
    if ((state === 'ended' || state === 'rejected' || state === 'missed') && !this.activeCall.endedAt) {
      this.activeCall.endedAt = Date.now();
    }
    this.notifyListeners();
  }

  subscribe(listener: (call: Call | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.activeCall);
    return () => this.listeners.delete(listener);
  }

  subscribeMediaStream(listener: (stream: any) => void): () => void {
    this.mediaStreamListeners.add(listener);
    return () => this.mediaStreamListeners.delete(listener);
  }

  notifyMediaStream(stream: any): void {
    this.mediaStreamListeners.forEach(listener => listener(stream));
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.activeCall));
  }
}

export const callService = new CallService();
