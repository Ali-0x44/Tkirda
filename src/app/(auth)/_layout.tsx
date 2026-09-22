import {Redirect, Stack} from 'expo-router';
import {useEffect, useState} from 'react';

import type {AuthUser} from '@/services/authService';
import {watchAuthState} from '@/services/authService';

export default function AuthLayout() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => watchAuthState(setUser), []);

  if (user === undefined) {
    return null;
  }

  if (user) {
    return <Redirect href="/contacts" />;
  }

  return (
    <Stack screenOptions={{headerShown: false}}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}