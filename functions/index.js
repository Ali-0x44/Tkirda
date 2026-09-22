'use strict';

const admin = require('firebase-admin');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {logger} = require('firebase-functions/v2');

const OFFER_TTL_MS = 45_000;

admin.initializeApp();

const db = admin.firestore();

async function lookupUserByUid(uid) {
  const byDoc = await db.doc(`users/${uid}`).get();
  if (byDoc.exists) return byDoc.data();
  const snaps = await db
    .collection('users')
    .where('userId', '==', uid)
    .limit(1)
    .get();
  if (!snaps.empty) return snaps.docs[0].data();
  return null;
}

/**
 * Fired whenever a new offer lands in `callOffers/{callId}`.
 * Relays a high-priority data-only FCM message to the callee's devices so the
 * app can display a native incoming call even when it is closed.
 * Cleans up offers that were never accepted (they would otherwise replay on
 * every app launch).
 */
exports.relayCallOffer = onDocumentCreated(
  {document: 'callOffers/{callId}', region: 'europe-west1'},
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const callId = event.params.callId;
    const offer = snap.data() || {};

    const ageMs = Date.now() - (offer.timestamp || 0);
    if (ageMs > OFFER_TTL_MS) {
      logger.info(`Dropping stale offer ${callId} (${ageMs}ms old)`);
      await snap.ref.delete().catch(() => {});
      return;
    }

    const receiverId = offer.receiverId;
    if (!receiverId) return;

    // Resolve the caller display name.
    let callerName = 'Unknown';
    const caller = await lookupUserByUid(offer.initiatorId).catch(() => null);
    if (caller) {
      callerName = caller.name || caller.displayName || callerName;
    }

    // Resolve the callee's registered device tokens.
    const callee = await db.doc(`users/${receiverId}`).get().catch(() => null);
    const tokens = callee && callee.exists ? callee.data().pushTokens || [] : [];
    const relayTargets = tokens.filter(
      (entry) =>
        entry &&
        typeof entry.token === 'string' &&
        (entry.platform !== 'ios') // iOS ring-when-killed needs APNs VoIP, not FCM
    );

    if (relayTargets.length === 0) {
      logger.info(`No push targets for ${callId}`);
      return;
    }

    const message = {
      data: {
        type: 'incoming_call',
        callId: String(callId),
        initiatorId: String(offer.initiatorId || ''),
        callerName: String(callerName),
        mediaType: String(offer.mediaType || 'audio'),
        timestamp: String(offer.timestamp || Date.now()),
      },
      android: {priority: 'high'},
      apns: {
        headers: {'apns-priority': '10', 'apns-push-type': 'background'},
        payload: {aps: {'content-available': 1}},
      },
    };

    let relayed = 0;
    const results = await Promise.allSettled(
      relayTargets.map((entry) =>
        admin.messaging().send({...message, token: entry.token})
      )
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        relayed += 1;
      } else {
        logger.warn(
          `FCM send to ${relayTargets[index].token} failed: ${result.reason?.code || result.reason}`
        );
      }
    });

    logger.info(`Relayed incoming call ${callId} to ${relayed} targets`);
  }
);