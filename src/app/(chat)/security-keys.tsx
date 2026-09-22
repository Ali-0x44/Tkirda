import {useEffect, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';

import CustomHeader from '@/CHAT/components/CustomHeader';
import TextBox from '@/CHAT/components/TextBox';
import Loader from '@/AUTH/components/Loader';
import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';

import {clearKeys, loadKeys} from '@/Security/keyStore';
import type {RSAPair} from '@/Security/RSA';
import {getCurrentUser, logout} from '@/services/authService';
// NATIVE RINGING (DISABLED — re-enable after upgrading to the Blaze plan):
//   import {unregisterPush} from '@/services/pushService';
import {clearProfile} from '@/services/sessionService';

function mask(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

const KeyBox = ({
  title,
  value,
  reveal = false,
  onToggle,
}: {
  title: string;
  value: string | null;
  reveal?: boolean;
  onToggle?: () => void;
}) => (
  <View style={styles.keyBox}>
    <View style={styles.keyHeading}>
      <Text style={styles.keyTitle}>{title}</Text>
      {onToggle ? (
        <TouchableOpacity onPress={onToggle} testID="toggle-private">
          <Ionicons
            name={reveal ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={COLORS.brand.teal}
          />
        </TouchableOpacity>
      ) : null}
    </View>
    <Text style={styles.keyValue} selectable>
      {value ? (title === 'Private Key' && !reveal ? mask(value) : value) : 'No keys on this device.'}
    </Text>
  </View>
);

export default function SecurityKeysScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [keys, setKeys] = useState<RSAPair | null>(null);
  const [reveal, setReveal] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = getCurrentUser();
      if (!current) return;
      setUid(current.uid);
      const stored = await loadKeys(current.uid);
      if (mounted) setKeys(stored);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const removeLocalData = () => {
    if (!uid) return;
    Alert.alert(
      'Remove local data?',
      'This permanently deletes your private key and profile from this device. Encrypted '
        + 'messages can never be decrypted again. You will be signed out.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              // NATIVE RINGING (DISABLED): `await unregisterPush();`
              await clearKeys(uid);
              await clearProfile();
              await logout();
            } catch {
              setRemoving(false);
              Alert.alert('Error', 'Unable to remove local data.');
            }
          },
        },
      ],
    );
  };

  if (uid === null || removing) {
    return (
      <View style={styles.loaderBox}>
        <Loader shown />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Security Keys" onClick={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionIcon}>
          <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.brand.teal} />
        </View>
        <KeyBox title="Public Key" value={keys?.public ?? null} />
        <KeyBox
          title="Private Key"
          value={keys?.private ?? null}
          reveal={reveal}
          onToggle={() => setReveal(!reveal)}
        />
        <TextBox
          heading="How this works"
          text={
            'Your RSA key pair was generated once on this device. The private key never leaves '
            + 'it — it is stored in the secure enclave. Share your public key so people can seal '
            + 'messages that only you can open.'
          }
        />
        <TouchableOpacity
          style={styles.danger}
          onPress={removeLocalData}
          testID="remove-local-data">
          <Ionicons name="trash-outline" size={20} color={COLORS.brand.danger} />
          <Text style={styles.dangerText}>Remove Local Data</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.brand.inputBack,
  },
  loaderBox: {
    flex: 1,
    backgroundColor: COLORS.brand.inputBack,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionIcon: {
    alignItems: 'center',
    paddingBottom: 14,
  },
  keyBox: {
    backgroundColor: COLORS.secondary.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.brand.inputBack,
  },
  keyHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyTitle: {
    ...FONTFAMILY.MONTSERRAT.sb.pt14,
    color: COLORS.brand.sub,
    textTransform: 'uppercase',
  },
  keyValue: {
    ...FONTFAMILY.POPPINS.reg.pt14,
    color: COLORS.brand.ink,
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  danger: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.secondary.white,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.brand.inputBack,
  },
  dangerText: {
    color: COLORS.brand.danger,
    ...FONTFAMILY.MONTSERRAT.sb.pt16,
  },
});