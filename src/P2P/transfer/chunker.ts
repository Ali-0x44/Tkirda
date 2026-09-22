import {File, FileMode} from 'expo-file-system';

/**
 * Streaming source for an outgoing file transfer: reads a file from disk in
 * 16KiB chunks (random access so resume starts at `nextIndex` without reading
 * the whole file).
 */

export type ChunkReader = {
  size: number;
  chunkSize: number;
  totalChunks: number;
  read(index: number): Promise<Uint8Array>;
  close(): Promise<void>;
};

export function countChunks(size: number, chunkSize: number): number {
  return Math.max(1, Math.ceil(size / chunkSize));
}

export async function openChunkReader(uri: string, chunkSize: number): Promise<ChunkReader> {
  const file = new File(uri);
  const handle = await file.open(FileMode.ReadOnly);
  const size = file.size;
  const totalChunks = countChunks(size, chunkSize);

  return {
    size,
    chunkSize,
    totalChunks,
    async read(index: number): Promise<Uint8Array> {
      const offset = index * chunkSize;
      const len = Math.min(chunkSize, Math.max(0, size - offset));
      if (len <= 0) return new Uint8Array(0);
      handle.offset = offset;
      return handle.readBytes(len);
    },
    async close(): Promise<void> {
      try {
        handle.close();
      } catch {
        // already closed
      }
    },
  };
}