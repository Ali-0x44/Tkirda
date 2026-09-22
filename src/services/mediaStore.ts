import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

export type MediaKind = 'audio' | 'image' | 'file';
export type MediaDirection = 'in' | 'out';
export type MediaStatus =
  | 'queued'
  | 'connecting'
  | 'sending'
  | 'receiving'
  | 'delivered'
  | 'ready'
  | 'failed'
  | 'cancelled';

export type MediaMessage = {
  id: string;
  uid: string;
  peerId: string;
  direction: MediaDirection;
  kind: MediaKind;
  name: string;
  mime: string;
  size: number;
  durationMs: number | null;
  path: string;
  status: MediaStatus;
  transferredChunks: number;
  totalChunks: number;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  nextRetryAt: number | null;
};

export const LIMITS = {
  MAX_FILE_BYTES: 50 * 1024 * 1024,
  MAX_AUDIO_DURATION_MS: 5 * 60 * 1000,
  CHUNK_SIZE: 16 * 1024,
} as const;

export const PART_SUFFIX = '.part';

/** Unique id for a media row (also used as the transfer tid and file stem). */
export function mediaId(): string {
  return randomUUID();
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/^.*[\\/]/, '')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 120);
  return cleaned || 'file';
}

export function sanitizePeerId(peerId: string): string {
  const cleaned = peerId.replace(/[^a-zA-Z0-9_.-]/g, '');
  return cleaned || 'peer';
}

export function chunkCount(size: number, chunkSize = LIMITS.CHUNK_SIZE): number {
  return Math.max(1, Math.ceil(size / chunkSize));
}

export function assertTransferAllowed(kind: MediaKind, size: number, mime: string, durationMs: number | null): void {
  if (size < 1) throw new Error('transfer_invalid_size');
  if (size > LIMITS.MAX_FILE_BYTES) throw new Error('transfer_too_large');
  if (kind === 'audio' && durationMs != null && durationMs > LIMITS.MAX_AUDIO_DURATION_MS) {
    throw new Error('audio_too_long');
  }
  const ok = mime.startsWith('audio/') || mime.startsWith('image/') ||
    mime === 'application/pdf' || mime === 'text/plain' ||
    mime === 'application/zip' || mime === 'application/octet-stream';
  if (!ok) throw new Error('mime_not_allowed');
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function initMediaStore(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('tkirda.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS media_messages (
          id TEXT PRIMARY KEY NOT NULL,
          uid TEXT NOT NULL,
          peerId TEXT NOT NULL,
          direction TEXT NOT NULL,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          durationMs INTEGER,
          path TEXT NOT NULL,
          status TEXT NOT NULL,
          transferredChunks INTEGER NOT NULL DEFAULT 0,
          totalChunks INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          nextRetryAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_media_uid_time ON media_messages (uid, createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_media_uid_status ON media_messages (uid, status);
      `);
      return db;
    })();
  }
  return dbPromise;
}

const COLS = [
  'id', 'uid', 'peerId', 'direction', 'kind', 'name', 'mime', 'size', 'durationMs',
  'path', 'status', 'transferredChunks', 'totalChunks', 'createdAt', 'updatedAt', 'attempts', 'nextRetryAt',
] as const;

function toRow(m: MediaMessage): SQLite.SQLiteBindValue[] {
  return COLS.map(c => m[c] as SQLite.SQLiteBindValue);
}

function bind(vals: unknown[]): SQLite.SQLiteBindValue[] {
  return vals as SQLite.SQLiteBindValue[];
}

function fromRow(r: Record<string, unknown>): MediaMessage {
  return {
    id: String(r.id),
    uid: String(r.uid),
    peerId: String(r.peerId),
    direction: r.direction as MediaDirection,
    kind: r.kind as MediaKind,
    name: String(r.name),
    mime: String(r.mime),
    size: Number(r.size),
    durationMs: r.durationMs == null ? null : Number(r.durationMs),
    path: String(r.path),
    status: r.status as MediaStatus,
    transferredChunks: Number(r.transferredChunks),
    totalChunks: Number(r.totalChunks),
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
    attempts: Number(r.attempts),
    nextRetryAt: r.nextRetryAt == null ? null : Number(r.nextRetryAt),
  };
}

async function db(): Promise<SQLite.SQLiteDatabase> {
  return initMediaStore();
}

const Q = (rows: Record<string, unknown>[]): MediaMessage[] => rows.map(fromRow);
const PH = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';

export async function createMedia(m: MediaMessage): Promise<void> {
  await (await db()).runAsync(
    `INSERT INTO media_messages (${COLS.join(', ')}) VALUES (${PH})`,
    toRow(m),
  );
}

export async function getMedia(id: string): Promise<MediaMessage | null> {
  const row = await (await db()).getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM media_messages WHERE id = ?',
    [id],
  );
  return row ? fromRow(row) : null;
}

export async function updateMedia(id: string, patch: Partial<MediaMessage>): Promise<void> {
  const only: { k: string; v: SQLite.SQLiteBindValue }[] = [];
  for (const key of COLS) {
    if (key === 'id') continue;
    if (key in patch) only.push({ k: key, v: patch[key] as SQLite.SQLiteBindValue });
  }
  only.push({ k: 'updatedAt', v: Date.now() });
  await (await db()).runAsync(
    `UPDATE media_messages SET ${only.map(x => `${x.k} = ?`).join(', ')} WHERE id = ?`,
    [...only.map(x => x.v), id],
  );
}

export async function progressMedia(id: string, transferredChunks: number, totalChunks: number, status?: MediaStatus): Promise<void> {
  const dbc = await db();
  const now = Date.now();
  if (status) {
    await dbc.runAsync(
      'UPDATE media_messages SET status = ?, transferredChunks = ?, totalChunks = ?, updatedAt = ? WHERE id = ?',
      bind([status, transferredChunks, totalChunks, now, id]),
    );
  } else {
    await dbc.runAsync(
      'UPDATE media_messages SET transferredChunks = ?, totalChunks = ?, updatedAt = ? WHERE id = ?',
      bind([transferredChunks, totalChunks, now, id]),
    );
  }
}

export async function setTransferState(id: string, status: MediaStatus, attempts: number, nextRetryAt: number | null): Promise<void> {
  await (await db()).runAsync(
    'UPDATE media_messages SET status = ?, attempts = ?, nextRetryAt = ?, updatedAt = ? WHERE id = ?',
    bind([status, attempts, nextRetryAt, Date.now(), id]),
  );
}

export async function listMedia(uid: string): Promise<MediaMessage[]> {
  const rows = await (await db()).getAllAsync<Record<string, unknown>>(
    'SELECT * FROM media_messages WHERE uid = ? ORDER BY createdAt DESC',
    [uid],
  );
  return Q(rows);
}

export async function listPeerMedia(uid: string, peerId: string): Promise<MediaMessage[]> {
  const rows = await (await db()).getAllAsync<Record<string, unknown>>(
    'SELECT * FROM media_messages WHERE uid = ? AND peerId = ? ORDER BY createdAt ASC',
    [uid, peerId],
  );
  return Q(rows);
}

export async function listOutgoing(uid: string): Promise<MediaMessage[]> {
  const rows = await (await db()).getAllAsync<Record<string, unknown>>(
    'SELECT * FROM media_messages WHERE uid = ? AND status IN (?, ?, ?, ?) ORDER BY createdAt ASC',
    [uid, 'queued', 'failed', 'connecting', 'sending'],
  );
  return Q(rows);
}

export async function listIncompleteIncoming(uid: string): Promise<MediaMessage[]> {
  const rows = await (await db()).getAllAsync<Record<string, unknown>>(
    'SELECT * FROM media_messages WHERE uid = ? AND status IN (?, ?) ORDER BY createdAt ASC',
    [uid, 'receiving', 'queued'],
  );
  return Q(rows);
}

export async function deleteMedia(id: string): Promise<void> {
  await (await db()).runAsync('DELETE FROM media_messages WHERE id = ?', [id]);
}

export async function claimForRetry(id: string, attemptLimit: number): Promise<boolean> {
  const row = await (await db()).getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM media_messages WHERE id = ?',
    [id],
  );
  const attempts = row ? Number(row.attempts) : 0;
  if (attempts >= attemptLimit) return false;
  const ts = Date.now();
  await (await db()).runAsync(
    'UPDATE media_messages SET attempts = ?, nextRetryAt = ?, updatedAt = ? WHERE id = ?',
    bind([attempts + 1, ts, ts, id]),
  );
  return true;
}

export function backoffForAttempt(attempt: number): number {
  const table = [15_000, 30_000, 60_000, 300_000];
  return table[Math.min(Math.max(attempt - 1, 0), table.length - 1)];
}

export function mediaRootDir(): Directory {
  return new Directory(Paths.document, 'media');
}

export async function ensureMediaDir(uid: string, peerId: string): Promise<Directory> {
  const root = mediaRootDir();
  await root.create({ idempotent: true, intermediates: true });
  const userDir = root.createDirectory(sanitizePeerId(uid));
  await userDir.create({ idempotent: true, intermediates: true });
  const peerDir = userDir.createDirectory(sanitizePeerId(peerId));
  await peerDir.create({ idempotent: true, intermediates: true });
  return new Directory(userDir, sanitizePeerId(peerId));
}

export async function ensureDiskSpace(bytes: number): Promise<boolean> {
  return Paths.availableDiskSpace >= bytes;
}

export function mediaFinalUri(uid: string, peerId: string, id: string, ext: string): string {
  const base = `media/${sanitizePeerId(uid)}/${sanitizePeerId(peerId)}/`;
  const safeExt = ext.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20);
  return uriJoin(base + sanitizeMessageId(id) + (safeExt ? '.' + safeExt : ''));
}

export function mediaPartUri(uid: string, peerId: string, id: string): string {
  return uriJoin(`media/${sanitizePeerId(uid)}/${sanitizePeerId(peerId)}/${sanitizeMessageId(id)}${PART_SUFFIX}`);
}

export function sanitizeMessageId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || 'msg';
}

export async function copyIntoMediaStore(srcUri: string, uid: string, peerId: string, id: string, ext: string): Promise<string> {
  const dir = await ensureMediaDir(uid, peerId);
  const dest = new File(dir, sanitizeMessageId(id) + (ext ? '.' + ext.replace(/[^a-zA-Z0-9_.-]/g, '') : ''));
  await new File(srcUri).copy(dest);
  return dest.uri;
}

export async function deleteMediaFile(uri: string): Promise<void> {
  const f = new File(uri);
  if (f.exists) await f.delete();
}

function uriJoin(relPath: string): string {
  return `file://${Paths.document.uri.replace(/^file:\/\//, '').replace(/\/+$/, '')}/${relPath}`;
}