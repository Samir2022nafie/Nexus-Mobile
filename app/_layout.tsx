import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { PostStateProvider } from '../src/context/PostStateContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { TabBarVisibilityProvider } from '../src/context/TabBarVisibilityContext';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading Nexus..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: 'slide_from_right',
          animationDuration: 250,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />

        {/* Detail Screens — Zoom effect transition (fade_from_bottom) */}
        <Stack.Screen name="community/[slug]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="hangout/[id]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="hangout/[id]/requests" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />

        {/* Creation & Modal Screens — Slide up from bottom like cards, slide down on exit */}
        <Stack.Screen name="new-post" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="select-community" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="new-hangout" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="new-event" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="new-community" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false, animation: 'slide_from_bottom' }} />

        {/* Sub-pages — Slide from right to left, slide out left to right */}
        <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="followers" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="user/[id]/communities" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PostStateProvider>
            <TabBarVisibilityProvider>
              <RootNavigator />
            </TabBarVisibilityProvider>
          </PostStateProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

