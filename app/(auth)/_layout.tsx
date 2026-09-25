/**
 * Auth Stack Layout — Welcome → Register → Verify Phone → Login
 * Redirects to main tabs if user is already authenticated.
 * Dynamically themed for dark mode support.
 */
import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();

  // If authenticated, redirect out of auth stack to main tabs
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
