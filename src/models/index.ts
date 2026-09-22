/**
 * Firestore + device data model (PLAN §4). Firestore Timestamps are
 * referenced as `FieldValue`-compatible values via `Timestamp`.
 */

export type Uid = string;

export type Timestamp = {
  seconds: number;
  nanoseconds: number;
} | number | Date;

export interface User {
  userId: string;
  name: string;
  email: string;
  phone: string;
  date: Timestamp;
  publicKey: string;
}

export type MessageType = 'text' | 'audio';

export interface MessageUser {
  _id: Uid;
}

export interface AudioRef {
  thread: string; // 'sender_receiver', locates the relay doc
  blobId: string; // = message _id
  size: number; // ciphertext length
  ch: string; // sha256 of ciphertext (transport integrity)
}

export interface MessageMetadata {
  keys: Record<string, string>; // uid -> RSA(AES key) for receiver AND sender
}

export interface Message {
  _id: string;
  type: MessageType;
  text: string; // AES ciphertext of the JSON payload (PLAN §5)
  audio?: AudioRef;
  createdAt: Timestamp;
  user: MessageUser;
  metadata: MessageMetadata;
}

/** `voice/{sender}_{receiver}/blobs/{msgId}` temporary relay, deleted after delivery. */
export interface VoiceBlob {
  data: string; // base64 AES ciphertext of the audio
  size: number;
  createdAt: Timestamp;
  expireAt: Timestamp; // createdAt + 7 days, for TTL
}

/** Manual one-way encryption screen payload (text only). */
export interface ManualEncryptionDoc {
  text: string;
  createdAt: Timestamp;
  metadata: {keys: Record<string, string>}; // receiver only
}

export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed' | 'busy';

/** `calls/{callId}`. SDP is AES(sessionKey, ...); sessionKey wrapped for callee. */
export interface CallDoc {
  callerId: Uid;
  calleeId: Uid;
  status: CallStatus;
  createdAt: Timestamp;
  answeredAt?: Timestamp;
  endedAt?: Timestamp;
  expireAt: Timestamp; // createdAt + 1 day, for TTL
  offer?: string; // AES(sessionKey, JSON SDP)
  answer?: string;
  metadata: {keys: Record<string, string>}; // RSA(sessionKey) for callee
}

/** `calls/{callId}/candidates/{id}`. */
export interface CallCandidateDoc {
  from: Uid;
  data: string; // AES(sessionKey, JSON ICE candidate)
  expireAt: Timestamp;
}