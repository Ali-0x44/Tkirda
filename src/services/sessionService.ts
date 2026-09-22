import AsyncStorage from '@react-native-async-storage/async-storage';

export type SessionProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
};

const SESSION_KEY = 'SESSION_PROFILE';

export async function cacheProfile(profile: SessionProfile): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

export async function getCachedProfile(): Promise<SessionProfile | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionProfile;
  } catch {
    return null;
  }
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}