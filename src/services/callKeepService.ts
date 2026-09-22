import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { router } from 'expo-router';

import { callManager } from '@/P2P/callManager';
import { clearCallOffer, endCall as endCallSignaling, publishCallAnswer } from '@/P2P/callSignaling';
import { callService, type MediaType } from '@/services/callService';
import { getUser } from '@/services/userService';

/**
 * Native ringing layer (CallKit on iOS / Android Telecom ConnectionService).
 *
 * This is deliberately BEST-EFFORT and never a hard dependency:
 *  - every RNCallKeep call is wrapped in try/catch;
 *  - a missing phone account, invalid UUID, or FCM quota expiry simply means
 *    the always-on Firestore `subscribeIncomingCalls` flow keeps working when
 *    the app is open — the app never crashes because of this layer.
 *
 * NOTE: importing `react-native-callkeep` at module scope THROWS on the new
 * architecture while its config plugin is commented out (the native
 * TurboModule is not compiled into the APK). Load it lazily and treat a
 * missing module as "native ringing unavailable" — the in-app call flow is
 * the source of truth either way.
 */
let rnCallKeep: any;
function callkeep(): any {
  if (rnCallKeep === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      rnCallKeep = require('react-native-callkeep').default;
    } catch {
      rnCallKeep = null;
    }
  }
  return rnCallKeep;
}

interface IncomingOffer {
  initiatorId: string;
  receiverId: string;
  callId: string;
  mediaType: MediaType;
  offer: string;
  candidates: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  }[];
  timestamp?: number;
}

const OFFER_TTL_MS = 45_000;

let setupPromise: Promise<void> | null = null;
let listenersRegistered = false;
const nativePresented = new Map<string, number>();
const endedGuard = new Set<string>();

const CALLKEEP_OPTIONS = {
  ios: {
    appName: 'Tkirda',
    supportsVideo: true,
    includesCallsInRecents: true,
    maximumCallGroups: '1',
    maximumCallsPerCallGroup: '1',
    ringtoneSound: 'default',
  },
  android: {
    alertTitle: 'Permissions required',
    alertDescription:
      'This application needs to access your phone account to ring for incoming calls.',
    cancelButton: 'Cancel',
    okButton: 'OK',
    additionalPermissions: ['android.permission.POST_NOTIFICATIONS'],
    selfManaged: false,
    foregroundService: {
      // @config-plugins/react-native-callkeep renders the in-call notification.
      channelId: 'com.ali0x44.chatapp.call',
      channelName: 'Calls',
      notificationTitle: 'Tkirda is running a call',
      notificationIcon: 'mipmap/ic_launcher',
    },
  },
};

async function fetchOffer(callId: string): Promise<IncomingOffer | null> {
  try {
    const db = getFirestore();
    const snap = await getDoc(doc(db, 'callOffers', callId));
    if (snap.exists()) return snap.data() as IncomingOffer;
  } catch (err) {
    console.warn('Fetch offer failed:', err);
  }
  return null;
}

async function lookupCallerName(uid: string): Promise<string> {
  try {
    const user = await getUser(uid);
    if (user && user.name) return user.name;
  } catch {
    // name is cosmetic — fall through to the default
  }
  return 'Unknown';
}

/** Initializes CallKeep once and wires the native answer/end actions. */
export async function initCallKeep(): Promise<void> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    try {
      const RNCallKeep = callkeep();
      if (!RNCallKeep) {
        console.warn('CallKeep unavailable (native module not linked)');
        return;
      }
      const configured = await RNCallKeep.setup(CALLKEEP_OPTIONS as never);
      if (!configured) {
        console.warn('CallKeep setup returned false (in-app flow remains available)');
      }
      registerNativeListeners();
    } catch (err) {
      console.warn('CallKeep setup failed (in-app flow remains available):', err);
    }
  })();
  return setupPromise;
}

function registerNativeListeners(): void {
  if (listenersRegistered) return;
  const RNCallKeep = callkeep();
  if (!RNCallKeep) {
    console.warn('CallKeep unavailable — native answer/end listeners not registered');
    return;
  }
  listenersRegistered = true;

  RNCallKeep.addEventListener('answerCall', ({callUUID}: {callUUID: string}) => {
    void handleAnswerAction(callUUID);
  });

  RNCallKeep.addEventListener('endCall', ({callUUID}: {callUUID: string}) => {
    void handleEndAction(callUUID);
  });
}

async function handleAnswerAction(callUUID: string): Promise<void> {
  try {
    await initCallKeep();
    const info = await performAnswer(callUUID);
    if (info) {
      await navigateToActiveCall(info);
    } else {
      // No live offer anymore (e.g. caller hung up while the app was dead).
      try {
        callkeep()?.endCall(callUUID);
      } catch {}
    }
  } catch (err) {
    console.warn('Native answer failed:', err);
    try {
      callkeep()?.endCall(callUUID);
    } catch {}
  }
}

async function handleEndAction(callUUID: string): Promise<void> {
  // Teardown only — the active call screen notices the call is gone and pops
  // itself, so ending from the native UI never rips an unrelated screen away.
  await performEndCall(callUUID).catch(() => {});
}

/**
 * Presents the native incoming-call UI (full-screen on Android, CallKit on
 * iOS). Called from the FCM background/foreground handler. No-ops safely if
 * the phone account is unavailable.
 */
export function presentIncomingCall(callId: string, callerName: string, hasVideo: boolean): void {
  const now = Date.now();
  for (const [id, ts] of nativePresented) {
    if (now - ts > 10 * 60_000) nativePresented.delete(id);
  }
  nativePresented.set(callId, now);
  try {
    callkeep()?.displayIncomingCall(
      callId,
      callerName,
      callerName,
      'number',
      hasVideo,
    );
  } catch (err) {
    console.warn('Failed to present native incoming call:', err);
  }
}

/** True once a call was presented via the native UI instead of the in-app flow. */
export function isCallPresentedNatively(callId: string): boolean {
  return nativePresented.has(callId);
}

/**
 * Answers a call end-to-end. Safe in every path:
 *  - in-app screen: the peer connection + receiveCall already happened, so it
 *    only creates the SDP answer and publishes it;
 *  - native cold-boot answer: it rebuilds the receiver side from the offer doc.
 * Returns the call display info (or null when the offer is gone/stale) so the
 * caller can decide whether/how to navigate.
 */
export async function performAnswer(
  callId: string,
): Promise<{id: string; name: string; callId: string} | null> {
  let info: {id: string; name: string; callId: string} | null = null;

  if (!callManager.getConnection(callId)) {
    const offer = await fetchOffer(callId);
    if (!offer) {
      console.warn('Answer skipped: call offer not found');
      return null;
    }
    if (Date.now() - (offer.timestamp ?? 0) > OFFER_TTL_MS) {
      console.warn('Answer skipped: stale call offer');
      await clearCallOffer(callId).catch(() => {});
      return null;
    }

    await callManager.createPeerConnection(callId, offer.mediaType);
    await callManager.setRemoteWithCandidates(callId, offer.offer, 'offer', offer.candidates ?? []);
    callService.receiveCall(offer.initiatorId, callId, offer.mediaType);
    const name = await lookupCallerName(offer.initiatorId);
    info = {id: offer.initiatorId, name, callId};
  } else {
    // The in-app flow already prepared everything; nothing extra to rebuild.
    info = null;
  }

  callService.answerCall();
  const answerSDP = await callManager.createAnswer(callId);
  await callManager.waitForIceGathering(callId);
  const candidates = callManager.getLocalCandidates(callId);
  await publishCallAnswer(callId, answerSDP, candidates);
  return info;
}

/**
 * Ends a call everywhere: app state, WebRTC, Firestore docs and the native
 * telecom UI. Idempotent via `endedGuard` so a native `endCall` event can
 * never cause recursion.
 */
export async function performEndCall(callId: string): Promise<void> {
  if (!callId || endedGuard.has(callId)) return;
  endedGuard.add(callId);
  try {
    callService.endCall();
  } catch {}
  try {
    await callManager.closeConnection(callId);
  } catch {}
  try {
    await endCallSignaling(callId);
  } catch {}
  try {
    callkeep()?.endCall(callId);
  } catch {}
  nativePresented.delete(callId);
  setTimeout(() => endedGuard.delete(callId), 5000);
}

/**
 * Reports an outgoing call to the native telecom UI. Best-effort: the app's
 * own call screen remains the source of truth either way.
 */
export async function reportOutgoingCall(
  callId: string,
  displayName: string,
  hasVideo: boolean,
): Promise<void> {
  try {
    const RNCallKeep = callkeep();
    if (!RNCallKeep) {
      console.warn('CallKeep unavailable — outgoing call not reported natively');
      return;
    }
    await initCallKeep();
    RNCallKeep.startCall(callId, displayName, displayName, 'number', hasVideo);
  } catch (err) {
    console.warn('Failed to report outgoing call to the system:', err);
  }
}

/**
 * Navigates to the active call screen with retries so it also works right
 * after a cold boot (the router may not be mounted yet when a native answer
 * wakes the app). Never throws back to the caller on exhaustion — it just
 * stops trying, leaving the native in-call UI visible.
 */
export async function navigateToActiveCall(
  info: {id: string; name: string; callId: string},
): Promise<void> {
  for (let i = 0; i < 20; i++) {
    try {
      router.push({
        pathname: '/call/[id]',
        params: {id: info.id, name: info.name, callId: info.callId},
      });
      return;
    } catch {
      // Router not ready yet (cold boot) — wait and retry.
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  console.warn('Could not navigate to the active call screen');
}