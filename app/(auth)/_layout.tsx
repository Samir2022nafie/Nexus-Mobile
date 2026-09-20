/**
 * Auth Stack Layout — Welcome → Register → Verify Phone → Login
 * Redirects to main tabs if user is already authenticated.
 */
import { Stack, Redirect } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  // If authenticated, redirect out of auth stack to main tabs
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.surface },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="login" />
    </Stack>
  );
}

