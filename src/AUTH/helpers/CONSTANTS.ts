const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9\s-]{7,15}$/;
const SPLASH_TIMEOUT = 3000;

const signUpData = {
  name: '',
  phone: '',
  email: '',
  password: '',
  birthday: '',
};

const VOICE = {
  MAX_DURATION_SECONDS: 60,
  MIN_DURATION_SECONDS: 1,
  BITRATE_KBPS: 32,
  MIME: 'audio/m4a',
  EXTENSION: 'm4a',
  MAX_RELAY_BYTES: 700000, // Firestore doc limit safety (~1 MiB / < 700 KB)
  TTL_DAYS: 7,
};

const CALL = {
  RING_TIMEOUT_SECONDS: 45,
  EXPIRY_DAYS: 1,
  STALE_INCOMING_SECONDS: 60,
} as const;

const ModalMessage = {
  forgotPass: 'Email found. Now you can reset your password successfully!',
  resetPass: 'Your password has been reset successfully!',
  signUpPin: 'Yay! Your PIN code has been created. Continue to B-Wallet!',
} as const;

export {emailRegex, phoneRegex, SPLASH_TIMEOUT, signUpData, VOICE, CALL, ModalMessage};