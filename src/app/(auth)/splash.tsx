import {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {useRouter} from 'expo-router';

import CustomStatusBar from '@/AUTH/components/CustomStatusBar';
import Logo from '@/AUTH/components/Logo';
import COLORS from '@/AUTH/styles/colors';
import FLEX from '@/AUTH/styles/flex';
import FONTFAMILY from '@/AUTH/styles/fonts';

import {watchAuthState} from '@/services/authService';

const {COMFORTAA: com} = FONTFAMILY;

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    return watchAuthState(user => {
      if (user) {
        router.replace('/contacts');
      } else {
        router.replace('/sign-in');
      }
    });
  }, [router]);

  return (
    <View style={[FLEX.centeredFill, styles.root]}>
      <CustomStatusBar />
      <Logo />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLORS.primary.blue,
  },
  baseText: {
    textAlignVertical: 'bottom',
    color: 'rgba(255,255,255,0.85)',
    position: 'absolute',
    bottom: 48,
    ...com.sb.pt14,
  },
});