import { collection, getDocs, getFirestore } from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Loader from '@/AUTH/components/Loader';
import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import Avatar from '@/CHAT/components/Avatar';
import CustomHeader from '@/CHAT/components/CustomHeader';

import type { User } from '@/models';
import { getCurrentUser } from '@/services/authService';
import {
  subscribeMessages,
  subscribeMyReceipts,
  threadId,
  type ThreadEntry,
} from '@/services/chatService';

type UnreadCounts = Record<string, number>;

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUid] = useState<string | null>(() => getCurrentUser()?.uid ?? null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [entriesByContact, setEntriesByContact] = useState<Record<string, ThreadEntry[]>>({});
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = getCurrentUser();
        const snap = await getDocs(collection(getFirestore(), 'users'));
        const list = snap.docs
          .map(d => d.data() as User)
          .filter(u => u.userId !== me?.uid);
        if (mounted) setContacts(list);
      } catch {
        if (mounted) Alert.alert('Error', 'Failed to fetch your contacts.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!myUid) return;
    const unsub = subscribeMyReceipts(myUid, entries => {
      setReadIds(new Set(entries.map(e => e.id)));
    });
    return unsub;
  }, [myUid]);

  useEffect(() => {
    if (!myUid) return;
    const unsubs = contacts.map(contact =>
      subscribeMessages(threadId(myUid, contact.userId), entries => {
        setEntriesByContact(prev => ({ ...prev, [contact.userId]: entries }));
      }),
    );
    return () => unsubs.forEach(u => u());
  }, [myUid, contacts]);

  const unread = useMemo<UnreadCounts>(() => {
    const acc: UnreadCounts = {};
    for (const [contactId, entries] of Object.entries(entriesByContact)) {
      const count = entries.filter(
        e => e.data.user?._id === contactId && !readIds.has(e.id),
      ).length;
      if (count > 0) acc[contactId] = count;
    }
    return acc;
  }, [entriesByContact, readIds]);

  const openChat = useCallback(
    (contact: User) => {
      router.push({
        pathname: '/message/[id]',
        params: {
          id: contact.userId,
          name: contact.name,
          publicKey: contact.publicKey,
        },
      });
    },
    [router],
  );

  const ContactRow = ({ item }: { item: User }) => {
    const count = unread[item.userId] ?? 0;
    return (
      <TouchableOpacity onPress={() => openChat(item)} testID={`contact-${item.userId}`}>
        <View style={styles.item}>
          <Avatar name={item.name} size={48} />
          <View style={styles.details}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
          {count > 0 && (
            <View style={styles.badge} testID={`unread-${item.userId}`}>
              <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <CustomHeader
        title="Contacts"
        leftIconName="person-circle-outline"
        onClick={() => router.push('/profile')}
      />
      <Loader shown={loading} />
      <FlatList
        data={contacts}
        keyExtractor={item => item.userId}
        renderItem={({ item }) => <ContactRow item={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>No contacts yet — share your app with friends!</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.secondary.white,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: COLORS.secondary.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  details: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.brand.inputBack,
    paddingVertical: 10,
  },
  name: {
    color: COLORS.brand.ink,
    ...FONTFAMILY.MONTSERRAT.sb.pt16,
  },
  sub: {
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
    marginTop: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: COLORS.brand.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  badgeText: {
    color: COLORS.secondary.white,
    ...FONTFAMILY.MONTSERRAT.sb.pt12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
  },
});