import {
    collection,
    deleteDoc,
    doc,
    getFirestore,
    onSnapshot,
    setDoc,
} from '@react-native-firebase/firestore';
import { getCurrentUser } from '../services/authService';
import type { MediaType } from '../services/callService';

export interface IceCandidateData {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

interface CallOffer {
  initiatorId: string;
  receiverId: string;
  callId: string;
  mediaType: MediaType;
  offer: string;
  candidates: IceCandidateData[];
  timestamp: number;
}

interface CallAnswer {
  answer: string;
  candidates: IceCandidateData[];
  timestamp: number;
}

const CALL_OFFERS_COLLECTION = 'callOffers';
const CALL_ANSWERS_COLLECTION = 'callAnswers';

export async function publishCallOffer(
  receiverId: string,
  callId: string,
  offerSDP: string,
  mediaType: MediaType,
  candidates: IceCandidateData[] = []
): Promise<void> {
  const me = getCurrentUser();
  if (!me) throw new Error('Not authenticated');

  const db = getFirestore();
  const offerDoc: CallOffer = {
    initiatorId: me.uid,
    receiverId,
    callId,
    mediaType,
    offer: offerSDP,
    candidates,
    timestamp: Date.now(),
  };

  const callRef = doc(db, CALL_OFFERS_COLLECTION, callId);
  await setDoc(callRef, offerDoc);
}

export async function publishCallAnswer(
  callId: string,
  answerSDP: string,
  candidates: IceCandidateData[] = []
): Promise<void> {
  const db = getFirestore();
  const answerData: CallAnswer = {
    answer: answerSDP,
    candidates,
    timestamp: Date.now(),
  };

  const answerRef = doc(db, CALL_ANSWERS_COLLECTION, callId);
  await setDoc(answerRef, answerData);
}

export function subscribeIncomingCalls(
  onCall: (offer: CallOffer) => void
): () => void {
  const me = getCurrentUser();
  if (!me) {
    console.warn('Not authenticated for incoming calls');
    return () => {};
  }

  const db = getFirestore();
  const offersRef = collection(db, CALL_OFFERS_COLLECTION);

  const unsubscribe = onSnapshot(offersRef, snapshot => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== 'added') continue;
      const offer = change.doc.data() as CallOffer;
      if (!offer || offer.receiverId !== me.uid) continue;
      // Reject offers that are too old to still be valid
      if (Date.now() - (offer.timestamp ?? 0) > 60000) continue;
      onCall(offer);
    }
  });

  return unsubscribe;
}

export function subscribeCallAnswer(
  callId: string,
  onAnswer: (answer: string, candidates: IceCandidateData[]) => void
): () => void {
  const db = getFirestore();
  const answerRef = doc(db, CALL_ANSWERS_COLLECTION, callId);

  const unsubscribe = onSnapshot(answerRef, snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.data() as CallAnswer;
      onAnswer(data.answer, data.candidates ?? []);
    }
  });

  return unsubscribe;
}

export async function rejectCall(callId: string): Promise<void> {
  const db = getFirestore();
  const offerRef = doc(db, CALL_OFFERS_COLLECTION, callId);
  await deleteDoc(offerRef);
}

export async function clearCallOffer(callId: string): Promise<void> {
  const db = getFirestore();
  try {
    await deleteDoc(doc(db, CALL_OFFERS_COLLECTION, callId));
  } catch {}
}

export async function endCall(callId: string): Promise<void> {
  const db = getFirestore();
  try {
    const offerRef = doc(db, CALL_OFFERS_COLLECTION, callId);
    await deleteDoc(offerRef);
  } catch {}
  try {
    const answerRef = doc(db, CALL_ANSWERS_COLLECTION, callId);
    await deleteDoc(answerRef);
  } catch {}
}