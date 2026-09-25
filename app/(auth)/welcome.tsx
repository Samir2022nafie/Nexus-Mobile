/**
 * Welcome Screen — Matches Stitch screen_1_welcome picture-perfect.
 * Tactile hero image with presence tag, goldenrod Nexus brand emblem,
 * editorial tagline, pill CTAs, and tonal social auth buttons.
 * Fully themed for dark mode support.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';

const WELCOME_HERO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA0ZLL5dwN_CPiowRNA0XWW94Z1vWxKaW7eWHKrXQ2YbAp_t7UZ0cs-zO_t1m-i4iLdjA2NMc7Fsu7u2OA72VxobCD57aMw4HzhF6GwdgNcxkd6CXsxoOviZ-apLXjbpYLE0uoAqDINhHbgOKfjbRz4Cgb9_SKMfq8xvjlR0_Y9HWhw1a5q1VMKSYIXeJmKydbjIiJ-1O4w31up59n3AeDqqAsI2dElSSLXLpkVz8NhIuEzE1uYzoU3BQ';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Visual Hero Container with rounded corners & presence tag */}
      <View style={styles.heroWrapper}>
        <View style={styles.heroContainer}>
          <Image source={{ uri: WELCOME_HERO }} style={styles.heroImage} />
          {/* Ambient gradient mask at bottom */}
          <View
            style={[
              styles.heroGradient,
              { backgroundColor: isDark ? 'rgba(20,19,18,0.45)' : 'rgba(252,249,248,0.35)' },
            ]}
          />

        </View>
      </View>

      {/* App Identity & Editorial Copy */}
      <View style={styles.brandSection}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <MaterialIcons name="groups" size={20} color={colors.onPrimaryContainer} />
          </View>
          <Text style={styles.brandTitle}>Nexus</Text>
        </View>
        <Text style={styles.tagline}>
          Discover communities. Join conversations. Meet your people.
        </Text>
      </View>

      {/* CTA Action Stack */}
      <View style={styles.actionsSection}>
        <Button
          title="Create Account"
          onPress={() => router.push('/(auth)/register')}
          variant="primary"
          size="lg"
          fullWidth
        />

        <Button
          title="Log In"
          onPress={() => router.push('/(auth)/login')}
          variant="tonal"
          size="lg"
          fullWidth
        />
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      paddingHorizontal: Spacing.margin,
      paddingTop: Spacing.xs,
    },
    heroWrapper: {
      marginBottom: Spacing.md,
    },
    heroContainer: {
      height: 360,
      borderRadius: BorderRadius.xxl,
      overflow: 'hidden',
      backgroundColor: colors.surfaceContainerLow,
      position: 'relative',
      ...Shadows.sm,
    },
    heroImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    heroGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 56,
    },

    brandSection: {
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      marginTop: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs + 2,
      marginBottom: Spacing.xs,
    },
    logoBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    brandTitle: {
      ...Typography.headlineLg,
      color: colors.primaryContainer,
      fontWeight: '700',
      letterSpacing: -0.6,
    },
    tagline: {
      ...Typography.bodyLg,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      maxWidth: 290,
      lineHeight: 24,
    },
    actionsSection: {
      gap: Spacing.sm + 4,
      width: '100%',
    },
  });
