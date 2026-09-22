import {useEffect, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useRouter} from 'expo-router';

import BtnChat from '@/CHAT/components/BtnChat';
import CustomHeader from '@/CHAT/components/CustomHeader';
import Loader from '@/AUTH/components/Loader';
import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import {screen_width} from '@/AUTH/utils/Dimensions';
import {phoneRegex} from '@/AUTH/helpers/CONSTANTS';

import {getCurrentUser} from '@/services/authService';
import {cacheProfile, clearProfile, getCachedProfile} from '@/services/sessionService';
import type {SessionProfile} from '@/services/sessionService';
import {getUser, normalizePhone, updateUserProfile} from '@/services/userService';

const Field = ({
  label,
  value,
  onChange,
  editable = true,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      editable={editable}
      placeholderTextColor={COLORS.brand.sub}
    />
  </View>
);

export default function UpdateScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [original, setOriginal] = useState<SessionProfile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = getCurrentUser();
      if (!current) return;
      setUid(current.uid);
      const cached = await getCachedProfile();
      let session = cached;
      if (!session) {
        const user = await getUser(current.uid);
        if (user) {
          session = {
            uid: user.userId,
            name: user.name,
            email: user.email,
            phone: user.phone,
          };
        }
      }
      if (session && mounted) {
        setOriginal(session);
        setName(session.name);
        setEmail(session.email);
        setPhone(session.phone);
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!uid || !original) return;
    const trimmed = name.trim();
    const normalized = normalizePhone(phone.trim());

    if (!trimmed) {
      Alert.alert('Invalid name', 'Name cannot be empty.');
      return;
    }
    if (!phoneRegex.test(normalized)) {
      Alert.alert('Invalid phone', 'Enter a valid phone number.');
      return;
    }

    if (trimmed === original.name && normalized === normalizePhone(original.phone)) {
      Alert.alert('No changes', 'Your profile already matches what you entered.');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(uid, {name: trimmed, phone: normalized});
      const next: SessionProfile = {
        uid,
        name: trimmed,
        email: original.email,
        phone: normalized,
      };
      await clearProfile();
      await cacheProfile(next);
      setOriginal(next);
      Alert.alert('Saved', 'Your profile has been updated.', [
        {text: 'OK', onPress: () => router.back()},
      ]);
    } catch {
      Alert.alert('Error', 'Failed to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || saving || !original) {
    return (
      <View style={styles.loaderBox}>
        <Loader shown />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Update Info" onClick={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Email" value={email} editable={false} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <BtnChat title="Save" handler={save} />
        <Text style={styles.hint}>
          Email is your sign-in identity and cannot be changed here.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.secondary.white,
  },
  loaderBox: {
    flex: 1,
    backgroundColor: COLORS.secondary.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 28,
    gap: 6,
  },
  field: {
    gap: 6,
    paddingBottom: 14,
  },
  label: {
    ...FONTFAMILY.MONTSERRAT.sb.pt13,
    color: COLORS.brand.sub,
    textTransform: 'capitalize',
  },
  input: {
    width: screen_width * 0.9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.brand.inputBack,
    paddingVertical: 8,
    color: COLORS.brand.ink,
    ...FONTFAMILY.MONTSERRAT.reg.pt16,
  },
  hint: {
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt12,
    textAlign: 'center',
  },
});