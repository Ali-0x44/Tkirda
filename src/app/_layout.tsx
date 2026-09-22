import {useFonts} from 'expo-font';
import {SplashScreen, Stack} from 'expo-router';
import {Component, useEffect, type ReactNode} from 'react';
import {StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import COLORS from '@/AUTH/styles/colors';

import {configureFirestore} from '@/services/firestore';

// NATIVE RINGING (DISABLED — re-enable after upgrading to the Blaze plan):
// Cloud Functions requires Blaze, so the FCM relay is not deployed yet.
//   import {initCallKeep} from '@/services/callKeepService';
//   import {attachBackgroundMessageHandler} from '@/services/pushService';

SplashScreen.preventAutoHideAsync();

// Must be registered at module scope so data-only FCM pushes wake the headless
// JS context even when the app is killed (native ringing for calls).
// attachBackgroundMessageHandler();

// In release builds React Native kills the whole app on any uncaught JS error
// (the dialog/permission flows can throw there). Trap errors at the JS root so
// a single rejected promise can never stop the app — log and stay alive.
function installGlobalErrorHandler() {
  const utils = (globalThis as any).ErrorUtils;
  if (!utils?.setGlobalHandler) return;
  try {
    const previous = utils.getGlobalHandler?.();
    utils.setGlobalHandler((error: unknown, isFatal: boolean) => {
      if (__DEV__) {
        previous?.apply?.(utils, [error, isFatal]);
        return;
      }
      console.error(`${isFatal ? 'Fatal' : ''} JS error (kept app alive):`, error);
    });
  } catch {
    // never throw during install
  }
}
installGlobalErrorHandler();

// Last-line guard for render-time failures (keeps the process running instead
// of stopping the app on a layout/component error).
class RootErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error) {
    console.error('Render error (kept app alive):', error);
  }

  render() {
    if (this.state.error) {
      // Visible + recoverable instead of a silent blank/black screen.
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => this.setState({error: null})}
            accessibilityLabel="Try again">
            <Text style={styles.errorButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: COLORS.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 24,
  },
  errorTitle: {
    color: COLORS.secondary.white,
    fontSize: 18,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  errorButtonText: {
    color: COLORS.secondary.white,
    fontSize: 16,
  },
});

const FONTS = {
  'Comfortaa-Bold': require('../assets/Fonts/Comfortaa-Bold.ttf'),
  'Comfortaa-Medium': require('../assets/Fonts/Comfortaa-Medium.ttf'),
  'Comfortaa-Regular': require('../assets/Fonts/Comfortaa-Regular.ttf'),
  'Comfortaa-SemiBold': require('../assets/Fonts/Comfortaa-SemiBold.ttf'),
  'Montserrat-Bold': require('../assets/Fonts/Montserrat-Bold.ttf'),
  'Montserrat-ExtraBold': require('../assets/Fonts/Montserrat-ExtraBold.ttf'),
  'Montserrat-Medium': require('../assets/Fonts/Montserrat-Medium.ttf'),
  'Montserrat-Regular': require('../assets/Fonts/Montserrat-Regular.ttf'),
  'Montserrat-SemiBold': require('../assets/Fonts/Montserrat-SemiBold.ttf'),
  'Poppins-Bold': require('../assets/Fonts/Poppins-Bold.ttf'),
  'Poppins-ExtraBold': require('../assets/Fonts/Poppins-ExtraBold.ttf'),
  'Poppins-Medium': require('../assets/Fonts/Poppins-Medium.ttf'),
  'Poppins-Regular': require('../assets/Fonts/Poppins-Regular.ttf'),
  'Poppins-SemiBold': require('../assets/Fonts/Poppins-SemiBold.ttf'),
};

export default function RootLayout() {
  const [loaded, error] = useFonts(FONTS);

  useEffect(() => {
    configureFirestore();
    // Initialize CallKeep early so native answer/end events that happened
    // while the app was dead get replayed once the tree mounts.
    // void initCallKeep(); // NATIVE RINGING (DISABLED — see top of file)
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <RootErrorBoundary>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Stack screenOptions={{headerShown: false}}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(chat)" />
      </Stack>
    </RootErrorBoundary>
  );
}