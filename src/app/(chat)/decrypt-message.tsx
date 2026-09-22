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
import {useLocalSearchParams, useRouter} from 'expo-router';

import BtnChat from '@/CHAT/components/BtnChat';
import CustomHeader from '@/CHAT/components/CustomHeader';
import TextBox from '@/CHAT/components/TextBox';
import Loader from '@/AUTH/components/Loader';
import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import {screen_height} from '@/AUTH/utils/Dimensions';

import * as AES from '@/Security/AES';
import {unwrapKey} from '@/Security';
import {loadKeys} from '@/Security/keyStore';
import {sha256} from '@/Security/SHA';
import {getCurrentUser} from '@/services/authService';

function mask(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export default function DecryptMessageScreen() {
  const params = useLocalSearchParams<{
    encrypted: string;
    aesKey: string;
    senderName: string;
    createdAt: string;
  }>();

  const router = useRouter();
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [revealPrivate, setRevealPrivate] = useState(false);
  const [rawAesKey, setRawAesKey] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [integrityOk, setIntegrityOk] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = getCurrentUser();
      if (!current) return;
      const stored = await loadKeys(current.uid);
      if (mounted) setPrivateKey(stored?.private ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const unwrapAesKey = async () => {
    if (!privateKey || !params.aesKey) return;
    setWorking(true);
    try {
      const raw = await unwrapKey(privateKey, params.aesKey);
      setRawAesKey(raw);
    } catch {
      Alert.alert('Unable to unwrap', 'This AES key was not wrapped for this private key.');
    } finally {
      setWorking(false);
    }
  };

  const decryptPayload = async () => {
    if (!rawAesKey || !params.encrypted) return;
    setWorking(true);
    try {
      const payload = JSON.parse(AES.decrypt(params.encrypted, rawAesKey)) as {
        t?: unknown;
        h?: unknown;
      };
      const text = typeof payload.t === 'string' ? payload.t : '';
      const claimed = typeof payload.h === 'string' ? payload.h : '';
      const actual = await sha256(text);
      const ok = claimed !== '' && actual === claimed;
      setPlaintext(text);
      setIntegrityOk(ok);
      if (!ok) Alert.alert('Integrity check failed', 'The message hash does not match.');
    } catch {
      Alert.alert('Unable to decrypt', 'The payload could not be decrypted with this key.');
    } finally {
      setWorking(false);
    }
  };

  if (privateKey === null || working) {
    return (
      <View style={styles.loaderBox}>
        <Loader shown />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Decrypt Message" onClick={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.meta}>
          From {params.senderName} · {params.createdAt}
        </Text>
        <TextBox heading="Encrypted Message" text={params.encrypted} />
        <TextBox heading="Wrapped AES Key" text={params.aesKey} />

        <View style={styles.keyRow}>
          <View style={styles.keyLabelWrap}>
            <Text style={styles.keyLabel}>My Private Key</Text>
            <TouchableOpacity onPress={() => setRevealPrivate(!revealPrivate)}>
              <Ionicons
                name={revealPrivate ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={COLORS.brand.teal}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.keyValue}>
            {privateKey ? (revealPrivate ? privateKey : mask(privateKey)) : '—'}
          </Text>
        </View>

        <BtnChat title="1. Decrypt AES Key" handler={unwrapAesKey} disabled={!privateKey} />
        {rawAesKey ? <TextBox heading="Decrypted AES Key" text={rawAesKey} /> : null}

        <BtnChat title="2. Decrypt Message" handler={decryptPayload} disabled={!rawAesKey} />
        {plaintext !== null ? (
          <TextBox
            heading={integrityOk ? 'Decrypted Message (valid)' : 'Decrypted Message (integrity failed)'}
            text={plaintext}
            icon={integrityOk ? 'checkmark-circle-outline' : 'warning-outline'}
          />
        ) : null}
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
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: screen_height * 0.6,
  },
  meta: {
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt12,
    marginBottom: 12,
    textAlign: 'center',
  },
  keyRow: {
    backgroundColor: COLORS.secondary.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.brand.inputBack,
    gap: 10,
  },
  keyLabelWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyLabel: {
    ...FONTFAMILY.MONTSERRAT.sb.pt14,
    color: COLORS.brand.sub,
    textTransform: 'capitalize',
  },
  keyValue: {
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
    color: COLORS.brand.ink,
    flexWrap: 'wrap',
  },
});