import type {MediaKind} from '../services/mediaStore';

/**
 * P2P wire protocol over a single WebRTC DataChannel.
 *
 * Two message families on the same channel:
 *  - control: JSON text messages ({kind: ...})
 *  - data:    binary chunk frames (see encodeDataFrame)
 *
 * Frame layout: [0x43 0x4D][tidLen u16BE][tid utf8][index u32BE][payload]
 */

export type ControlMessage =
  | {kind: 'hello'; uid: string; nonce: string}
  | {kind: 'file_offer'; tid: string; messageId: string; mediaKind: MediaKind; name: string; mime: string; size: number; durationMs: number | null; totalChunks: number; chunkSize: number; wrappedKey: string; baseIvHex: string}
  | {kind: 'file_accept'; tid: string; nextIndex: number}
  | {kind: 'file_reject'; tid: string; reason: string}
  | {kind: 'file_ack'; tid: string; upTo: number}
  | {kind: 'file_done'; tid: string}
  | {kind: 'file_complete'; tid: string}
  | {kind: 'file_cancel'; tid: string; reason: string}
  | {kind: 'ping'; nonce: string};

export const MAGIC_HI = 0x43; // 'C'
export const MAGIC_LO = 0x4d; // 'M'

function encodeTwo(a: number, b: number): number {
  return (a << 8) | b;
}

function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

export function encodeControl(msg: ControlMessage): string {
  return JSON.stringify(msg);
}

export function decodeControl(raw: string): ControlMessage {
  const msg = JSON.parse(raw) as ControlMessage;
  if (!msg || typeof (msg as {kind?: unknown}).kind !== 'string') {
    throw new Error('bad_control_message');
  }
  return msg;
}

export function encodeDataFrame(tid: string, index: number, payload: Uint8Array): Uint8Array {
  const tidBytes = utf8(tid);
  if (tidBytes.length > 0xffff) throw new Error('tid_too_long');
  if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) {
    throw new Error('bad_index');
  }
  const out = new Uint8Array(4 + tidBytes.length + 4 + payload.length);
  out[0] = MAGIC_HI;
  out[1] = MAGIC_LO;
  out[2] = (tidBytes.length >>> 8) & 0xff;
  out[3] = tidBytes.length & 0xff;
  out.set(tidBytes, 4);
  const off = 4 + tidBytes.length;
  out[off] = (index >>> 24) & 0xff;
  out[off + 1] = (index >>> 16) & 0xff;
  out[off + 2] = (index >>> 8) & 0xff;
  out[off + 3] = index & 0xff;
  out.set(payload, off + 4);
  return out;
}

export type DataFrame = {
  tid: string;
  index: number;
  payload: Uint8Array;
};

export function decodeDataFrame(buf: Uint8Array): DataFrame {
  if (buf.length < 8) throw new Error('frame_too_short');
  if (buf[0] !== MAGIC_HI || buf[1] !== MAGIC_LO) throw new Error('bad_magic');
  const tidLen = encodeTwo(buf[2], buf[3]);
  if (4 + tidLen + 4 > buf.length) throw new Error('bad_frame_length');
  const tid = new TextDecoder().decode(buf.subarray(4, 4 + tidLen));
  const off = 4 + tidLen;
  const index =
    ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
  const payload = buf.subarray(off + 4);
  return {tid, index, payload};
}

export function isDataFrame(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === MAGIC_HI && buf[1] === MAGIC_LO;
}

export function isHello(msg: ControlMessage): boolean {
  return msg.kind === 'hello';
}

export function makeNonce(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}