import {useState} from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useRouter} from 'expo-router';

import BtnSimple from '@/AUTH/components/BtnSimple';
import CustomStatusBar from '@/AUTH/components/CustomStatusBar';
import LabelledInput from '@/AUTH/components/LabelledInput';
import Loader from '@/AUTH/components/Loader';
import Logo from '@/AUTH/components/Logo';
import ScreenWrapper from '@/AUTH/components/ScreenWrapper';

import {emailRegex} from '@/AUTH/helpers/CONSTANTS';
import COLORS from '@/AUTH/styles/colors';
import FLEX from '@/AUTH/styles/flex';
import FONTFAMILY from '@/AUTH/styles/fonts';
import {screen_height, screen_width} from '@/AUTH/utils/Dimensions';

import {authErrorMessage, signUp} from '@/services/authService';

const {MONTSERRAT: mon} = FONTFAMILY;
const {brand: b, secondary: s} = COLORS;

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submitForm = () => {
    if (
      name.length === 0 ||
      email.length === 0 ||
      password.length === 0 ||
      confirm.length === 0
    ) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Not a valid email');
      return;
    }
    if (phone.length <= 9) {
      Alert.alert('Error', 'Invalid phone number. Must be longer than 9 characters');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password is less than 6 characters');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    signUpUser();
  };

  const signUpUser = async () => {
    try {
      setBusy(true);
      await signUp(name, email, phone, password);
    } catch (error) {
      Alert.alert('Error', authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.root}>
        <CustomStatusBar />
        <Loader shown={busy} />
        <View style={styles.top}>
          <Logo />
        </View>
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.formHeading}>Sign Up</Text>
            <LabelledInput label="Name" data={name} onChange={setName} />
            <LabelledInput label="Email" data={email} onChange={setEmail} />
            <LabelledInput label="Phone" data={phone} onChange={setPhone} />
            <LabelledInput label="Password" data={password} onChange={setPassword} />
            <LabelledInput label="Confirm Password" data={confirm} onChange={setConfirm} />
            <BtnSimple text="Sign Up" back={b.green} color={s.white} onClick={submitForm} />
            <View style={[FLEX.row, styles.footer]}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/sign-in')}>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.primary.blue,
  },
  top: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: s.white,
    width: screen_width,
    minHeight: screen_height * 0.66,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 26,
    paddingTop: 24,
  },
  form: {
    paddingBottom: 28,
  },
  formHeading: {
    ...mon.b.pt24,
    marginBottom: 14,
    color: b.ink,
  },
  footer: {
    gap: 5,
    marginTop: 18,
    justifyContent: 'center',
  },
  footerText: {
    color: b.sub,
    ...mon.reg.pt14,
  },
  link: {
    color: b.teal,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
  },
});