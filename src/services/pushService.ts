import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

import { presentIncomingCall } from './callKeepService';
import { getCurrentUser } from './authService';
import { removePushToken, upsertPushToken } from './userService';

export const PUSH_TYPE_INCOMING_CALL = 'incoming_call';

/**
 * FCM payload carried by the Cloud Function relay for `incoming_call`.
 */
export type IncomingCallPushData = {
  type: string;
  callId: string;
  initiatorId?: string;
  callerName?: string;
  mediaType?: string;
  timestamp?: string;
};

let registered = false;
let token = '';

/**
 * Registers the FCM background handler. Must run as early as possible (module
 * scope of the root layout) so data-only pushes wake headless JS when the app
 * is killed. The handler itself is fully guarded: if anything fails the
 * Firestore in-app incoming flow still catches the call when the app is open.
 */
export function attachBackgroundMessageHandler(): void {
  try {
    setBackgroundMessageHandler(getMessaging(), async (message: RemoteMessage) => {
      handleCallPushData(message.data as IncomingCallPushData | undefined);
    });
  } catch (err) {
    console.warn('Failed to attach FCM background handler:', err);
  }
}

/**
 * Hands a call push to the native ringing UI. Safe to call from either the
 * background handler or a foreground listener — fails are swallowed.
 */
export function handleCallPushData(data: IncomingCallPushData | undefined): void {
  try {
    if (!data || data.type !== PUSH_TYPE_INCOMING_CALL || !data.callId) return;
    const callerName = (data.callerName || 'Unknown').trim() || 'Unknown';
    const hasVideo = data.mediaType !== 'audio';
    presentIncomingCall(data.callId, callerName, hasVideo);
  } catch (err) {
    console.warn('Failed to handle call push:', err);
  }
}

/**
 * Registers this device for FCM and stores its token on the user doc.
 * Returns true when the device is reachable for call pushes. Any failure just
 * means background ringing is unavailable — the in-app call flow still works.
 */
export async function registerPush(uid: string): Promise<boolean> {
  if (registered) return true;
  try {
    const messaging = getMessaging();

    // Android 13+ needs a runtime notification permission for the in-call
    // foreground-service notification.
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ).catch(() => undefined);
    }

    const status = await requestPermission(messaging);
    const granted =
      status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
    if (!granted) {
      return false;
    }

    const deviceToken = await getToken(messaging);
    if (!deviceToken) return false;

    token = deviceToken;
    await upsertPushToken(uid, {token: deviceToken, platform: Platform.OS === 'ios' ? 'ios' : 'android'});
    registered = true;
    return true;
  } catch (err) {
    console.warn('Push registration failed (in-app flow still works):', err);
    return false;
  }
}

/** Re-stores the FCM token when the provider rotates it. */
export function subscribePushTokenRefresh(uid: string): () => void {
  const messaging = getMessaging();
  return onTokenRefresh(messaging, async (next: string) => {
    try {
      if (!next || next === token) return;
      token = next;
      await upsertPushToken(uid, {
        token: next,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      });
    } catch {
      // Never let token rotation break the app.
    }
  });
}

/** Removes this device's token so logged-out devices stop ringing. */
export async function unregisterPush(): Promise<void> {
  const deviceToken = token;
  registered = false;
  token = '';
  if (!deviceToken) return;
  try {
    const user = getCurrentUser();
    if (user) await removePushToken(user.uid, deviceToken);
  } catch {
    // Best-effort; a stale token is harmless (only rings for calls meant for
    // the previously signed-in user).
  }
}