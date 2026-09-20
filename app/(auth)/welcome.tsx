/**
 * Welcome Screen — Matches Stitch screen_1_welcome picture-perfect.
 * Tactile hero image with presence tag, goldenrod Nexus brand emblem,
 * editorial tagline, pill CTAs, and tonal social auth buttons.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/ui/Button';

const WELCOME_HERO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA0ZLL5dwN_CPiowRNA0XWW94Z1vWxKaW7eWHKrXQ2YbAp_t7UZ0cs-zO_t1m-i4iLdjA2NMc7Fsu7u2OA72VxobCD57aMw4HzhF6GwdgNcxkd6CXsxoOviZ-apLXjbpYLE0uoAqDINhHbgOKfjbRz4Cgb9_SKMfq8xvjlR0_Y9HWhw1a5q1VMKSYIXeJmKydbjIiJ-1O4w31up59n3AeDqqAsI2dElSSLXLpkVz8NhIuEzE1uYzoU3BQ';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
          {/* Gentle ambient gradient mask at bottom */}
          <View style={styles.heroGradient} />

          {/* Presence tag overlay */}
          <View style={styles.presenceTag}>
            <View style={styles.presenceDot} />
            <Text style={styles.presenceText}>340+ local meetups</Text>
          </View>
        </View>
      </View>

      {/* App Identity & Editorial Copy */}
      <View style={styles.brandSection}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <MaterialIcons name="groups" size={20} color={Colors.onPrimaryContainer} />
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

        {/* Social Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Authentication Tonal Buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialButton}
            activeOpacity={0.8}
            accessibilityLabel="Continue with Google"
          >
            <FontAwesome5 name="google" size={18} color="#EA4335" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            activeOpacity={0.8}
            accessibilityLabel="Continue with Apple"
          >
            <FontAwesome5 name="apple" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surfaceContainerLow,
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
    backgroundColor: 'rgba(252,249,248,0.3)',
  },
  presenceTag: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...Shadows.sm,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryContainer,
  },
  presenceText: {
    ...Typography.captionSm,
    fontWeight: '700',
    color: Colors.onSurface,
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
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  brandTitle: {
    ...Typography.headlineLg,
    color: Colors.primaryContainer,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  tagline: {
    ...Typography.bodyLg,
    color: Colors.tertiary,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 24,
  },
  actionsSection: {
    gap: Spacing.sm + 4,
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  dividerText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
});

