import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import Header from '@/CHAT/components/Header';
import type { ChatBubble } from '@/CHAT/components/MessageBubble';
import MessageBubble from '@/CHAT/components/MessageBubble';
import MessageComposer from '@/CHAT/components/MessageComposer';
import VoiceSendPreview from '@/CHAT/components/VoiceSendPreview';

import type { Timestamp } from '@/models';
import { callManager } from '@/P2P/callManager';
import { publishCallOffer } from '@/P2P/callSignaling';
import {
  cancelMedia,
  configureMediaService,
  flushOutbox,
  isConfigured,
  markSendFailed,
  retryMedia,
  subscribeMediaEvents,
} from '@/P2P/outbox';
import { loadKeys } from '@/Security/keyStore';
import type { RSAPair } from '@/Security/RSA';
import {
  discardRecording,
  enqueueVoiceMemo,
  type VoiceMemo,
} from '@/services/audioService';
import { getCurrentUser } from '@/services/authService';
import { callService } from '@/services/callService';
import { performEndCall } from '@/services/callKeepService';
// NATIVE RINGING (DISABLED — re-enable after upgrading to the Blaze plan):
//   import {reportOutgoingCall} from '@/services/callKeepService';
import {
  decryptChatMessage,
  deleteMessageForEveryone,
  markMessageRead,
  sendTextMessage,
  subscribeMessages,
  subscribeReadReceipts,
  threadId,
} from '@/services/chatService';
import {
  enqueuePickedFile,
  pickDocument,
  pickImage,
  type PickedFile,
} from '@/services/filePickerService';
import {
  deleteMedia,
  deleteMediaFile,
  getMedia,
  listPeerMedia,
  type MediaMessage,
} from '@/services/mediaStore';

function toDate(ts: Timestamp | null | undefined): Date {
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (ts != null && typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  if (ts != null && typeof ts === 'object') {
    const seconds = (ts as {seconds?: number}).seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return new Date(0);
}

export default function MessageScreen() {
  const params = useLocalSearchParams<{id: string; name: string; publicKey: string}>();
  const contactId = params.id;
  const contactName = params.name ?? 'CONTACT';
  const contactPublicKey = params.publicKey;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [myUid, setMyUid] = useState<string | null>(null);
  const [keys, setKeys] = useState<RSAPair | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [mediaRows, setMediaRows] = useState<MediaMessage[]>([]);
  const [pendingVoice, setPendingVoice] = useState<VoiceMemo | null>(null);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const decrypted = useRef<Map<string, string>>(new Map());
  const marked = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = getCurrentUser();
      if (!current) return;
      setMyUid(current.uid);
      const stored = await loadKeys(current.uid);
      if (mounted) setKeys(stored);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!myUid) return;
    return subscribeReadReceipts(
      myUid,
      entries => {
        setReadIds(new Set(entries.map(e => e.id)));
      },
      error => Alert.alert('Receipts unavailable', error.message),
    );
  }, [myUid]);

  useEffect(() => {
    if (!myUid || !keys || !contactId) return;
    const thread = threadId(myUid, contactId);
    return subscribeMessages(
      thread,
      entries => {
        (async () => {
          const next = new Map<string, ChatBubble>();
          for (const entry of entries) {
            try {
              if (
                entry.data.user._id === contactId &&
                !marked.current.has(entry.id)
              ) {
                marked.current.add(entry.id);
                markMessageRead(entry.id, myUid, entry.data.user._id).catch(() => {
                  marked.current.delete(entry.id);
                });
              }
              let text = decrypted.current.get(entry.id);
              if (text === undefined) {
                try {
                  text = await decryptChatMessage(entry.data, myUid, keys.private);
                } catch {
                  text = 'Unable to decrypt';
                }
                decrypted.current.set(entry.id, text);
              }
              next.set(entry.id, {
                _id: entry.id,
                text,
                createdAt: toDate(entry.data.createdAt),
                mine: entry.data.user._id === myUid,
              });
            } catch {
              // Skip malformed docs (e.g. hand-created in the console).
            }
          }
          const sorted = [...next.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          setMessages(sorted);
        })();
      },
      error => Alert.alert('Chat unavailable', error.message),
    );
  }, [myUid, keys, contactId]);

  useEffect(() => {
    if (!myUid || !contactId) return;
    let mounted = true;
    const reload = async () => {
      const rows = await listPeerMedia(myUid, contactId);
      if (mounted) setMediaRows(rows);
    };
    void reload();
    const unsub = subscribeMediaEvents(() => {
      void reload();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [myUid, contactId]);

  const ensureMediaConfigured = async () => {
    if (!myUid || !keys) return;
    if (isConfigured()) return;
    await configureMediaService({myUid, keys});
  };

  const entries = useMemo(() => {
    const all = new Map<string, ChatBubble>();
    for (const m of messages) all.set(`t_${m._id}`, m);
    for (const m of mediaRows) {
      all.set(`m_${m.id}`, {
        _id: m.id,
        text: '',
        createdAt: new Date(m.createdAt),
        mine: m.direction === 'out',
        media: m,
        status: m.direction === 'out' && m.status === 'delivered' ? 'read' : undefined,
      });
    }
    return [...all.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [messages, mediaRows]);

  const onSend = async (text: string) => {
    if (!myUid || !keys || !contactId || !contactPublicKey) return;
    try {
      await sendTextMessage({
        fromUid: myUid,
        fromPublicKey: keys.public,
        toUid: contactId,
        toPublicKey: contactPublicKey,
        text,
        msgId: randomUUID(),
      });
    } catch {
      Alert.alert('Error', 'Failed to send the message.');
    }
  };

  const onSendMemo = async (memo: VoiceMemo) => {
    if (!myUid || !contactId) return;
    let row: MediaMessage | null = null;
    try {
      row = await enqueueVoiceMemo({
        myUid,
        peerId: contactId,
        uri: memo.uri,
        durationMs: memo.durationMs,
      });
      discardRecording(memo.uri).catch(() => {});
      await ensureMediaConfigured();
      await flushOutbox(contactId, contactPublicKey);
    } catch (err) {
      if (row) {
        const stored = await getMedia(row.id);
        if (stored && !['ready', 'delivered'].includes(stored.status)) {
          await markSendFailed(row.id, err instanceof Error ? err.message : 'Could not send.');
          Alert.alert('Voice message', err instanceof Error ? err.message : 'Could not send.');
        }
      } else {
        Alert.alert('Voice message', err instanceof Error ? err.message : 'Could not send.');
      }
    }
  };

  const onCancelVoice = () => {
    if (!pendingVoice) return;
    discardRecording(pendingVoice.uri).catch(() => {});
    setPendingVoice(null);
  };

  const onConfirmVoice = () => {
    if (!pendingVoice) return;
    const memo = pendingVoice;
    setPendingVoice(null);
    void onSendMemo(memo);
  };

  const pickAndSend = async (pick: () => Promise<PickedFile | null>) => {
    if (!myUid || !contactId) return;
    let row: MediaMessage | null = null;
    try {
      const picked = await pick();
      if (!picked) return;
      row = await enqueuePickedFile({myUid, peerId: contactId, picked});
      await ensureMediaConfigured();
      await flushOutbox(contactId, contactPublicKey);
    } catch (err) {
      if (row) {
        const stored = await getMedia(row.id);
        if (stored && !['ready', 'delivered'].includes(stored.status)) {
          await markSendFailed(row.id, err instanceof Error ? err.message : 'Could not attach the file.');
          Alert.alert('Attach', err instanceof Error ? err.message : 'Could not attach the file.');
        }
      } else {
        Alert.alert('Attach', err instanceof Error ? err.message : 'Could not attach the file.');
      }
    }
  };

  const onCancelMedia = (id: string) => {
    if (!contactId) return;
    void cancelMedia(contactId, id).catch(() => {});
  };

  const onRetryMedia = (id: string) => {
    if (!contactId) return;
    void retryMedia(contactId, id, contactPublicKey).catch(() => {});
  };

  const onOpenMedia = (media: MediaMessage) => {
    if (media.kind === 'file' && media.status === 'ready') {
      void Sharing.shareAsync(media.path).catch(() => {});
    }
  };

  const selecting = selected.size > 0;
  const toggleSelected = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const onDeleteSelected = () => {
    if (!selecting || !myUid || !contactId) return;
    const label = selected.size > 1 ? `Delete ${selected.size} messages?` : 'Delete this message?';
    Alert.alert(label, 'This will remove the message for both of you.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => void removeSelected()},
    ]);
  };

  const removeSelected = async () => {
    const keys = [...selected];
    setSelected(new Set());
    try {
      const mediaIds = new Set(mediaRows.map(m => m.id));
      const chatKeys = keys.filter(k => !mediaIds.has(k));
      const mediaKeys = keys.filter(k => mediaIds.has(k));
      await Promise.all(chatKeys.map(id => deleteMessageForEveryone(id, myUid!, contactId!)));
      for (const id of mediaKeys) {
        const row = await getMedia(id);
        if (row) {
          await deleteMedia(id).catch(() => {});
          await deleteMediaFile(row.path).catch(() => {});
        }
      }
      if (mediaKeys.length > 0) {
        const rows = await listPeerMedia(myUid!, contactId!);
        setMediaRows(rows);
      }
    } catch {
      Alert.alert('Delete', 'Some messages could not be deleted.');
    }
  };

  const onStartCall = async (mediaType: 'audio' | 'video') => {
    if (!myUid || !contactId || !contactName) return;

    // Ask for the mic (and camera for video calls) here, up front. Doing it
    // via the Android permission API is safe; letting webrtc's native
    // getUserMedia ask itself crashes the app when denied.
    if (Platform.OS === 'android') {
      const perms = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ...(mediaType === 'video' ? [PermissionsAndroid.PERMISSIONS.CAMERA] : []),
      ];
      try {
        const results = await PermissionsAndroid.requestMultiple(perms);
        const allGranted = perms.every(
          p => results[p] === PermissionsAndroid.RESULTS.GRANTED,
        );
        if (!allGranted) {
          Alert.alert(
            'Permission needed',
            'Allow the microphone to start a call.',
          );
          return;
        }
      } catch {
        Alert.alert('Permission needed', 'Allow the microphone to start a call.');
        return;
      }
    }

    const call = callService.createCall(contactId, mediaType);
    // NATIVE RINGING (DISABLED): surface the outgoing call in the native
    // telecom UI. Depends on the Cloud Function relay → Blaze plan.
    // void reportOutgoingCall(call.id, contactName, mediaType === 'video').catch(() => {});

    // Open the call screen first, then set up WebRTC/signaling in the
    // background. The old flow (navigate only after the peer connection,
    // offer and Ice gathering finished) left both sides stuck with a black
    // frozen screen whenever that native setup stalled or threw.
    router.push({
      pathname: '/call/[id]',
      params: { id: contactId, name: contactName, callId: call.id },
    });

    let answered = false;

    void (async () => {
      try {
        await callManager.createPeerConnection(call.id, mediaType);
        const offerSDP = await callManager.createOffer(call.id);
        await callManager.waitForIceGathering(call.id);
        const candidates = callManager.getLocalCandidates(call.id);
        await publishCallOffer(contactId, call.id, offerSDP, mediaType, candidates);

        const { subscribeCallAnswer } = await import('@/P2P/callSignaling');
        subscribeCallAnswer(call.id, async (answerSDP, answerCandidates) => {
          answered = true;
          try {
            await callManager.setRemoteWithCandidates(call.id, answerSDP, 'answer', answerCandidates);
          } catch (err) {
            console.error('Failed to set remote description:', err);
          }
        });
      } catch (err) {
        console.error('Start call setup error:', err);
        await performEndCall(call.id).catch(() => {});
        Alert.alert('Error', 'Failed to start call');
      }
    })();

    // Don't leave the call screen up as a frozen shell if the other side
    // never answers — tear down and let the screen pop back to the chat.
    setTimeout(() => {
      if (answered) return;
      if (callService.getCurrentCall()?.id !== call.id) return;
      void performEndCall(call.id).catch(() => {});
      Alert.alert('No answer', 'The other user did not answer the call.');
    }, 45_000);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {paddingBottom: insets.bottom + 8}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <Header
        name={contactName}
        goBack={() => router.back()}
        selectCount={selected.size}
        onDeleteSelected={onDeleteSelected}
        onCancelSelect={() => setSelected(new Set())}
        onVoiceCall={() => void onStartCall('audio')}
        onVideoCall={() => void onStartCall('video')}
      />
      <FlatList
        style={styles.list}
        data={entries}
        keyExtractor={item => item._id}
        renderItem={({item}) => (
          <MessageBubble
            message={{
              ...item,
              status: !item.media
                ? item.mine
                  ? readIds.has(item._id)
                    ? 'read'
                    : 'sent'
                  : undefined
                : item.status,
            }}
            selected={selected.has(item._id)}
            selectable={selecting}
            onPress={selecting ? () => toggleSelected(item._id) : undefined}
            onLongPress={() => toggleSelected(item._id)}
            onCancelMedia={onCancelMedia}
            onRetryMedia={onRetryMedia}
            onOpenMedia={onOpenMedia}
          />
        )}
        inverted
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Messages you send here are end-to-end encrypted.
          </Text>
        }
      />
      {pendingVoice ? (
        <VoiceSendPreview
          memo={pendingVoice}
          onSend={onConfirmVoice}
          onCancel={onCancelVoice}
          disabled={!myUid || !keys}
        />
      ) : null}
      <MessageComposer
        onSend={onSend}
        onVoiceRecorded={setPendingVoice}
        onPickDocument={() => {
          void pickAndSend(pickDocument);
        }}
        onPickImage={() => {
          void pickAndSend(pickImage);
        }}
        disabled={!myUid || !keys}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.chat.back,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 8,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
  },
});