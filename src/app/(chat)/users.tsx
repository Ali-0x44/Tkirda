import {useEffect, useState} from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useRouter} from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import Loader from '@/AUTH/components/Loader';
import Avatar from '@/CHAT/components/Avatar';
import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import CustomHeader from '@/CHAT/components/CustomHeader';

import type {User} from '@/models';
import {getCurrentUser} from '@/services/authService';
import {listOtherUsers} from '@/services/userService';

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = getCurrentUser();
        const list = await listOtherUsers(me?.uid ?? '');
        if (mounted) setUsers(list);
      } catch {
        if (mounted) Alert.alert('Error', 'Failed to fetch users.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openManual = (user: User) => {
    router.push({
      pathname: '/encryption',
      params: {id: user.userId, name: user.name},
    });
  };

  const Row = ({item}: {item: User}) => (
    <TouchableOpacity onPress={() => openManual(item)} testID={`user-${item.userId}`}>
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
        <Ionicons name="key-outline" size={20} color={COLORS.brand.teal} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <CustomHeader title="Users" onClick={() => router.back()} />
      <Loader shown={loading} />
      <FlatList
        data={users}
        keyExtractor={item => item.userId}
        renderItem={({item}) => <Row item={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>
              No users yet — how did you even open this screen?
            </Text>
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
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
  },
});