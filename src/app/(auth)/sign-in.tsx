import { useState } from 'react';

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
import { useRouter } from 'expo-router';

import BtnSimple from '@/AUTH/components/BtnSimple';
import CustomStatusBar from '@/AUTH/components/CustomStatusBar';
import LabelledInput from '@/AUTH/components/LabelledInput';
import Loader from '@/AUTH/components/Loader';
import Logo from '@/AUTH/components/Logo';
import ScreenWrapper from '@/AUTH/components/ScreenWrapper';

import { emailRegex } from '@/AUTH/helpers/CONSTANTS';
import COLORS from '@/AUTH/styles/colors';
import FLEX from '@/AUTH/styles/flex';
import FONTFAMILY from '@/AUTH/styles/fonts';
import { screen_width } from '@/AUTH/utils/Dimensions';

import { authErrorMessage, signIn } from '@/services/authService';

const { MONTSERRAT: mon } = FONTFAMILY;
const { brand: b, secondary: s } = COLORS;

export default function SignInScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submitForm = () => {
    if (email.length === 0 || password.length === 0) {
      Alert.alert('Error', 'Email and Password cannot be empty');
      return;
    }

    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Not a valid email');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password is less than 6 characters');
      return;
    }

    signInUser();
  };

  const signInUser = async () => {
    try {
      setBusy(true);
      await signIn(email, password);
    } catch (error) {
      Alert.alert('Error', authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.root}>
        <Loader shown={busy} />
        <CustomStatusBar />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.logoContainer}>
                <Logo />
              </View>

              <View style={styles.sheet}>
                <Text style={styles.formHeading}>Sign In</Text>

                <LabelledInput
                  label="Email"
                  data={email}
                  onChange={setEmail}
                />

                <LabelledInput
                  label="Password"
                  data={password}
                  onChange={setPassword}
                />

                <BtnSimple
                  text="Sign In"
                  back={b.green}
                  color={s.white}
                  onClick={submitForm}
                />

                <View style={[FLEX.row, styles.footer]}>
                  <Text style={styles.footerText}>
                    Don&apos;t have an account yet?
                  </Text>

                  <TouchableOpacity onPress={() => router.push('/sign-up')}>
                    <Text style={styles.link}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
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

  kav: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  sheet: {
    backgroundColor: s.white,
    width: screen_width,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 34,
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