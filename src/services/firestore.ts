import {getApp} from '@react-native-firebase/app';
import {initializeFirestore} from '@react-native-firebase/firestore';

/** Cap Firestore's on-device cache (default 100 MB) to bound storage use. */
export const FIRESTORE_CACHE_SIZE_BYTES = 16 * 1024 * 1024;

let configured = false;

/**
 * Must run before any Firestore access so the cache settings take effect on
 * the first native persistence initialization.
 */
export function configureFirestore(): void {
  if (configured) return;
  configured = true;
  initializeFirestore(getApp(), {
    persistence: true,
    cacheSizeBytes: FIRESTORE_CACHE_SIZE_BYTES,
  });
}