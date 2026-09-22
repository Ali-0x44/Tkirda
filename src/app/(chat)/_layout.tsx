import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import COLORS from '@/AUTH/styles/colors';

import { callManager } from '@/P2P/callManager';
import { clearCallOffer, subscribeIncomingCalls } from '@/P2P/callSignaling';
import { configureMediaService, disposeMediaService, runScheduledRetries } from '@/P2P/outbox';
import { loadKeys } from '@/Security/keyStore';
import type { AuthUser } from '@/services/authService';
import { watchAuthState } from '@/services/authService';
import { callService } from '@/services/callService';
// NATIVE RINGING (DISABLED — re-enable after upgrading to the Blaze plan):
//   import {initCallKeep, isCallPresentedNatively} from '@/services/callKeepService';
//   import {registerPush, subscribePushTokenRefresh} from '@/services/pushService';

export default function ChatLayout() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const router = useRouter();
  const seenIncoming = useRef<Set<string>>(new Set());

  useEffect(() => watchAuthState(setUser), []);

  const userId = user?.uid;

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    void (async () => {
      const keys = await loadKeys(userId);
      if (!keys || disposed) return;
      await configureMediaService({myUid: userId, keys});
    })();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void runScheduledRetries();
    });
    return () => {
      disposed = true;
      sub.remove();
      disposeMediaService();
    };
  }, [userId]);

  // NATIVE RINGING (DISABLED — re-enable after upgrading to the Blaze plan):
  // Functionality depends on the Cloud Function FCM relay which cannot be
  // deployed on the free Spark plan.
  // useEffect(() => {
  //   void initCallKeep();
  //   if (!userId) return;
  //   void registerPush(userId);
  //   const unsubToken = subscribePushTokenRefresh(userId);
  //   return unsubToken;
  // }, [userId]);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeIncomingCalls(async (offer) => {
      try {
        // Ignore offers already handled in this session
        if (seenIncoming.current.has(offer.callId)) return;

        // Already in a call?
        if (callService.getCurrentCall()) return;

        // NATIVE RINGING (DISABLED): also check `isCallPresentedNatively(offer.callId)`
        // here so calls already ringing via the native telecom UI are skipped.

        // Remove stale offers that were never cleaned up, so they don't
        // re-trigger an incoming call on the next app launch
        if (Date.now() - (offer.timestamp ?? 0) > 45000) {
          await clearCallOffer(offer.callId).catch(() => {});
          return;
        }

        seenIncoming.current.add(offer.callId);

        // Receive the call in callService
        callService.receiveCall(offer.initiatorId, offer.callId, offer.mediaType);

        // Fetch caller's name from Firestore for display
        let callerName = 'Unknown';
        try {
          const { collection, getDocs, getFirestore, query, where } = await import('@react-native-firebase/firestore');
          const db = getFirestore();
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('userId', '==', offer.initiatorId));
          const snapshot = await getDocs(q);
          if (snapshot.size > 0) {
            const userData = snapshot.docs[0].data();
            callerName = userData.name || userData.displayName || 'Unknown';
          }
        } catch (err) {
          console.warn('Could not fetch caller name:', err);
        }

        // Navigate to the incoming call screen FIRST. Preparing the peer
        // connection / remote SDP before navigating is what left the receiver
        // stuck with no screen (black freeze) when the native webrtc setup
        // stalled or threw. If the user answers before the background setup
        // finishes, performAnswer rebuilds the connection from the offer doc.
        router.push({
          pathname: '/call-incoming',
          params: { id: offer.initiatorId, name: callerName },
        });

        void (async () => {
          try {
            await callManager.createPeerConnection(offer.callId, offer.mediaType);
            await callManager.setRemoteWithCandidates(
              offer.callId,
              offer.offer,
              'offer',
              offer.candidates ?? []
            );
          } catch (err) {
            console.error('Receiver peer connection setup failed:', err);
          }
        })();
      } catch (err) {
        console.error('Error handling incoming call:', err);
      }
    });

    return () => unsubscribe();
  }, [userId, router]);

  if (user === undefined) {
    return null;
  }

  if (user === null) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary.blue,
        tabBarInactiveTintColor: COLORS.brand.sub,
        tabBarStyle: {
          backgroundColor: COLORS.secondary.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.brand.inputBack,
        },
      }}>
      <Tabs.Screen
        name="contacts"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="profile" options={{href: null}} />
      <Tabs.Screen name="users" options={{href: null}} />
      <Tabs.Screen name="update" options={{href: null}} />
      <Tabs.Screen name="security-keys" options={{href: null}} />
      <Tabs.Screen name="decrypt-message" options={{href: null}} />
      <Tabs.Screen name="contact-us" options={{href: null}} />
      <Tabs.Screen name="encryption/index" options={{href: null}} />
      <Tabs.Screen
        name="message/[id]"
        options={{
          href: null,
          tabBarStyle: {display: 'none'},
        }}
      />
      <Tabs.Screen
        name="call-incoming"
        options={{
          href: null,
          tabBarStyle: {display: 'none'},
        }}
      />
      <Tabs.Screen
        name="call/[id]"
        options={{
          href: null,
          tabBarStyle: {display: 'none'},
        }}
      />
    </Tabs>
  );
}