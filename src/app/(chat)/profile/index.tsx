import {useEffect, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useRouter} from 'expo-router';

import Avatar from '@/CHAT/components/Avatar';
import Cards from '@/CHAT/components/Cards';
import Logout from '@/CHAT/components/Logout';
import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';

import {getCurrentUser, logout} from '@/services/authService';
// NATIVE RINGING (DISABLED — re-enable after upgrading to the Blaze plan):
//   import {unregisterPush} from '@/services/pushService';
import type {SessionProfile} from '@/services/sessionService';
import {cacheProfile, getCachedProfile} from '@/services/sessionService';
import {getUser} from '@/services/userService';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<SessionProfile | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await getCachedProfile();
      if (cached) {
        if (mounted) setProfile(cached);
        return;
      }
      const current = getCurrentUser();
      if (!current) return;
      const user = await getUser(current.uid);
      if (user && mounted) {
        const session = {
          uid: user.userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
        };
        setProfile(session);
        cacheProfile(session);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onLogout = async () => {
    try {
      // NATIVE RINGING (DISABLED): stop this device from ringing for the
      // signed-out user's calls — `await unregisterPush();`
      await logout();
    } catch {
      Alert.alert('Error', 'Unable to log out right now. Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.body}>
          {profile ? (
            <View style={styles.profileCard}>
              <Avatar name={profile.name} size={80} />
              <View style={styles.identity}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {profile.email}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.group}>
            <Cards
              label="Encryption/Decryption"
              icon="key-outline"
              onClick={() => router.push('/users')}
            />
            <View style={styles.hairline} />
            <Cards
              label="Security Keys"
              icon="shield-checkmark-outline"
              onClick={() => router.push('/security-keys')}
            />
            <View style={styles.hairline} />
            <Cards
              label="Update Info"
              icon="create-outline"
              onClick={() => router.push('/update')}
            />
            <View style={styles.hairline} />
            <Cards
              label="Contact Us"
              icon="mail-outline"
              onClick={() => router.push('/contact-us')}
            />
          </View>

          <View style={styles.logoutGroup}>
            <Logout onClick={onLogout} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.brand.inputBack,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 18,
    paddingTop: 36,
    gap: 16,
  },
  body: {
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.secondary.white,
  },
  identity: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: COLORS.brand.ink,
    ...FONTFAMILY.MONTSERRAT.sb.pt20,
    textTransform: 'capitalize',
  },
  email: {
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
  },
  group: {
    backgroundColor: COLORS.secondary.white,
    borderRadius: 16,
    paddingVertical: 6,
  },
  logoutGroup: {
    backgroundColor: COLORS.secondary.white,
    borderRadius: 16,
    paddingVertical: 4,
  },
  hairline: {
    height: 1,
    marginLeft: 51,
    backgroundColor: COLORS.brand.inputBack,
  },
});