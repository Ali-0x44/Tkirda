import {useEffect, useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useLocalSearchParams, useRouter} from 'expo-router';

import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import CustomHeader from '@/CHAT/components/CustomHeader';
import Loader from '@/AUTH/components/Loader';
import {screen_width} from '@/AUTH/utils/Dimensions';

import type {ManualEncryptionDoc, Timestamp, Uid} from '@/models';
import {getCurrentUser} from '@/services/authService';
import {threadId} from '@/services/chatService';
import {subscribeManualThread} from '@/services/encryptionService';
import type {ManualEntry} from '@/services/encryptionService';

type Tab = 'inbox' | 'sent';

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

function preview(doc: ManualEncryptionDoc): string {
  const t = doc.text ?? '';
  return t.length > 64 ? `${t.slice(0, 64)}…` : t || '(empty)';
}

export default function EncryptionScreen() {
  const params = useLocalSearchParams<{id: string; name: string}>();
  const contactId = params.id;
  const contactName = params.name ?? 'CONTACT';

  const router = useRouter();
  const [myUid, setMyUid] = useState<Uid | null>(null);
  const [tab, setTab] = useState<Tab>('inbox');
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenError, setListenError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = getCurrentUser();
      if (current && mounted) setMyUid(current.uid);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!myUid || !contactId) return;
    const thread = tab === 'inbox' ? threadId(contactId, myUid) : threadId(myUid, contactId);
    const unsub = subscribeManualThread(
      thread,
      list => {
        setListenError(null);
        setEntries(list);
        setLoading(false);
      },
      error => {
        setLoading(false);
        setListenError(error.message);
      },
    );
    return unsub;
  }, [myUid, contactId, tab]);

  const openDecrypt = (entry: ManualEntry) => {
    if (tab !== 'inbox') return;
    router.push({
      pathname: '/decrypt-message',
      params: {
        encrypted: entry.data.text,
        aesKey: entry.data.metadata.keys[myUid ?? ''] ?? '',
        senderName: contactName,
        createdAt: toDate(entry.data.createdAt).toISOString(),
      },
    });
  };

  const Tabs = (
    <View style={styles.tabsBar}>
      <View style={styles.tabs}>
        {(['inbox', 'sent'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            testID={`tab-${t}`}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'inbox' ? 'Inbox' : 'Sent'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <CustomHeader
        title={`Manual · ${contactName}`}
        onClick={() => router.back()}
      />
      {Tabs}
      <Loader shown={loading} />
      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <TouchableOpacity
            onPress={() => openDecrypt(item)}
            disabled={tab !== 'inbox'}
            testID={`entry-${item.id}`}>
            <View style={[styles.item, tab !== 'inbox' && styles.itemLocked]}>
              <View style={styles.itemTop}>
                <Ionicons
                  name={tab === 'inbox' ? 'lock-open-outline' : 'lock-closed-outline'}
                  size={16}
                  color={COLORS.brand.teal}
                />
                <Text style={styles.preview} numberOfLines={2}>
                  {preview(item.data)}
                </Text>
              </View>
              <Text style={styles.date}>
                {toDate(item.data.createdAt).toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : listenError ? (
            <Text style={styles.empty}>
              Could not load messages: {listenError}
            </Text>
          ) : (
            <Text style={styles.empty}>
              {tab === 'inbox'
                ? 'No incoming encrypted messages. Sent ones live in the Sent tab.'
                : 'No outgoing encrypted messages yet. Use the profile → Users list to send one.'}
            </Text>
          )
        }
      />
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {tab === 'inbox'
            ? 'Inbox rows are decryptable — tap to run the manual decrypt flow. Sent rows cannot be re-decrypted (only the receiver holds the key).'
            : 'Messages you send are sealed for the receiver only.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.secondary.white,
  },
  tabsBar: {
    backgroundColor: COLORS.primary.blue,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.secondary.white,
  },
  tabText: {
    color: COLORS.secondary.white,
    ...FONTFAMILY.MONTSERRAT.sb.pt14,
  },
  tabTextActive: {
    color: COLORS.primary.blue,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    width: screen_width,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.brand.inputBack,
    gap: 4,
  },
  itemLocked: {
    opacity: 0.55,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preview: {
    color: COLORS.brand.ink,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
    flex: 1,
  },
  date: {
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 30,
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  hint: {
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt12,
    textAlign: 'center',
  },
});