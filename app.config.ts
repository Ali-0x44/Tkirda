import type {ConfigContext, ExpoConfig} from 'expo/config';

const FONTS = [
  'src/assets/Fonts/Comfortaa-Bold.ttf',
  'src/assets/Fonts/Comfortaa-Medium.ttf',
  'src/assets/Fonts/Comfortaa-Regular.ttf',
  'src/assets/Fonts/Comfortaa-SemiBold.ttf',
  'src/assets/Fonts/Montserrat-Bold.ttf',
  'src/assets/Fonts/Montserrat-ExtraBold.ttf',
  'src/assets/Fonts/Montserrat-Medium.ttf',
  'src/assets/Fonts/Montserrat-Regular.ttf',
  'src/assets/Fonts/Montserrat-SemiBold.ttf',
  'src/assets/Fonts/Poppins-Bold.ttf',
  'src/assets/Fonts/Poppins-ExtraBold.ttf',
  'src/assets/Fonts/Poppins-Medium.ttf',
  'src/assets/Fonts/Poppins-Regular.ttf',
  'src/assets/Fonts/Poppins-SemiBold.ttf',
];

export default ({config}: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tkirda',
  slug: 'tkirda',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'tkirda',
  ios: {
    icon: './assets/images/icon.png',
    infoPlist: {
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    package: 'com.ali0x44.chatapp',
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_ADMIN',
    ],
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './splash.png',
        resizeMode: 'cover',
      },
    ],
    [
      'expo-font',
      {
        fonts: FONTS,
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission:
          'Allow Tkirda to access your microphone to record voice messages and make calls.',
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    'expo-secure-store',
    [
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission: 'Tkirda does not use the camera.',
        microphonePermission:
          'Allow Tkirda to access your microphone for voice calls.',
      },
    ],
    // NATIVE RINGING (DISABLED — re-enable after upgrading to the Blaze plan):
    // '@config-plugins/react-native-callkeep',
    'expo-sqlite',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Tkirda to access your photos to send images.',
        cameraPermission: 'Tkirda does not use the camera.',
      },
    ],
    'expo-sharing',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    turnUrl: process.env.EXPO_PUBLIC_TURN_URL ?? '',
    turnUsername: process.env.EXPO_PUBLIC_TURN_USERNAME ?? '',
    turnCredential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL ?? '',
    stunServer: process.env.EXPO_PUBLIC_STUN_SERVER ?? 'stun:stun.l.google.com:19302',
  },
});