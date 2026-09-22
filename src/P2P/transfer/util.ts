/** Shared helpers for the transfer engine. */

export function utf8Aad(tid: string): Uint8Array {
  return new TextEncoder().encode(tid);
}

export function extensionFromName(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 || idx === name.length - 1 ? '' : name.slice(idx + 1);
}