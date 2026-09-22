import {File} from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type {Uid} from '../models';
import {extensionFromName} from '../P2P/transfer/util';
import {
  assertTransferAllowed,
  chunkCount,
  copyIntoMediaStore,
  createMedia,
  mediaId,
  sanitizeFilename,
  type MediaKind,
  type MediaMessage,
} from './mediaStore';

/**
 * File/image picking + enqueue (PLAN §25). The pickers only ever return a
 * local cache URI (never the bytes); picking is followed by validation and an
 * immediate copy into the media store, then the row is queued for the outbox.
 */

export type PickedFile = {
  uri: string;
  name: string;
  mime: string;
  size: number;
  kind: MediaKind;
};

export function kindForMime(mime: string): MediaKind {
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return 'file';
}

async function buildPicked(uri: string, name: string, mime: string): Promise<PickedFile | null> {
  const size = new File(uri).size;
  const kind = kindForMime(mime);
  assertTransferAllowed(kind, size, mime, null);
  return {uri, name: sanitizeFilename(name), mime, size, kind};
}

export async function pickDocument(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: '*/*',
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  return buildPicked(asset.uri, asset.name ?? 'file', asset.mimeType ?? 'application/octet-stream');
}

export async function pickImage(): Promise<PickedFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const name = asset.fileName ?? 'image.jpg';
  return buildPicked(asset.uri, name, asset.mimeType ?? 'image/jpeg');
}

export type EnqueuePickedArgs = {
  myUid: Uid;
  peerId: Uid;
  picked: PickedFile;
  durationMs?: number | null;
  id?: string;
};

/** Validate + copy a picked file into the media store and queue it. */
export async function enqueuePickedFile(args: EnqueuePickedArgs): Promise<MediaMessage> {
  const {picked} = args;
  assertTransferAllowed(picked.kind, picked.size, picked.mime, args.durationMs ?? null);

  const id = args.id ?? mediaId();
  const safeName = sanitizeFilename(picked.name);
  const ext = extensionFromName(safeName);
  const finalUri = await copyIntoMediaStore(picked.uri, args.myUid, args.peerId, id, ext);

  const row: MediaMessage = {
    id,
    uid: args.myUid,
    peerId: args.peerId,
    direction: 'out',
    kind: picked.kind,
    name: safeName,
    mime: picked.mime,
    size: picked.size,
    durationMs: picked.kind === 'audio' ? (args.durationMs ?? null) : null,
    path: finalUri,
    status: 'queued',
    transferredChunks: 0,
    totalChunks: chunkCount(picked.size),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
    nextRetryAt: null,
  };
  await createMedia(row);
  return row;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}