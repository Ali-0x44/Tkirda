import {File} from 'expo-file-system';
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type RecordingOptions,
} from 'expo-audio';

import type {Uid} from '../models';
import {
  assertTransferAllowed,
  chunkCount,
  copyIntoMediaStore,
  createMedia,
  mediaId,
  type MediaMessage,
} from './mediaStore';

/**
 * Voice memo recording + enqueue (PLAN §24). The recorder writes a mono AAC
 * `.m4a` into the document directory; the memo is validated, copied into the
 * media store and queued for the outbox. Playback lives in the AudioBubble
 * component (`useAudioPlayer`).
 */

export const VOICE_MIME = 'audio/mp4';
export const VOICE_EXT = 'm4a';

export type VoiceMemo = {
  uri: string;
  durationMs: number;
};

/**
 * Low-bitrate mono voice preset (~32 kbps AAC). Roughly 1 MB per 4 minutes of
 * audio — small enough for the 50 MB per-transfer ceiling.
 */
export const AUDIO_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.m4a',
  sampleRate: 32000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MIN,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  directory: 'document',
};

export async function ensureRecordingPermissions(): Promise<boolean> {
  const res = await requestRecordingPermissionsAsync();
  return res.granted;
}

/** Route microphone audio to the recorder session. */
export async function activateRecordingMode(): Promise<void> {
  await setAudioModeAsync({allowsRecording: true, playsInSilentMode: true});
}

/** Restore normal playback audio session after recording. */
export async function releaseRecordingMode(): Promise<void> {
  await setAudioModeAsync({allowsRecording: false});
}

export function readVoiceSize(uri: string): number {
  return new File(uri).size;
}

export function voiceFileName(): string {
  return `voice_${Date.now()}.${VOICE_EXT}`;
}

export function validateVoiceMemo(size: number, durationMs: number): void {
  assertTransferAllowed('audio', size, VOICE_MIME, durationMs);
}

export type EnqueueVoiceArgs = {
  myUid: Uid;
  peerId: Uid;
  uri: string;
  durationMs: number;
  name?: string;
  mime?: string;
  id?: string;
};

/** Validate, copy into the media store and queue the memo for the outbox. */
export async function enqueueVoiceMemo(args: EnqueueVoiceArgs): Promise<MediaMessage> {
  const size = readVoiceSize(args.uri);
  validateVoiceMemo(size, args.durationMs);

  const id = args.id ?? mediaId();
  const name = args.name ?? voiceFileName();
  const mime = args.mime ?? VOICE_MIME;
  const finalUri = await copyIntoMediaStore(args.uri, args.myUid, args.peerId, id, VOICE_EXT);

  const row: MediaMessage = {
    id,
    uid: args.myUid,
    peerId: args.peerId,
    direction: 'out',
    kind: 'audio',
    name,
    mime,
    size,
    durationMs: args.durationMs,
    path: finalUri,
    status: 'queued',
    transferredChunks: 0,
    totalChunks: chunkCount(size),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
    nextRetryAt: null,
  };
  await createMedia(row);
  return row;
}

/** `m:ss` (or `h:mm:ss` for long memos). */
export function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '0:00';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** Delete a recorder temp file after it was copied or discarded. */
export async function discardRecording(uri: string): Promise<void> {
  const file = new File(uri);
  if (file.exists) await file.delete();
}