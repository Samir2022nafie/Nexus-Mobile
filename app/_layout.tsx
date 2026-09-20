/**
 * Root Layout — Wraps the entire app in AuthProvider and routes
 * between auth stack and main tabs based on authentication state.
 *
 * IMPORTANT: Expo Router v57 does NOT support conditional rendering of
 * Stack.Screen children. All screens must be declared statically.
 * Auth gating is handled via <Redirect /> in (auth)/_layout and (tabs)/_layout.
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { Colors } from '../src/constants/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading Nexus..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.surface } }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="community/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="hangout/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="new-post" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="new-hangout" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="new-event" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="new-community" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="hangout/[id]/requests" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
