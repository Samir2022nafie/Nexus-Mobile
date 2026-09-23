import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { usersService } from '../src/services/users';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your posts, events, and data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersService.deleteMyAccount();
              await logout();
              router.replace('/(auth)/welcome');
            } catch {
              router.replace('/(auth)/welcome');
            }
          },
        },
      ]
    );
  };

  const handleLinkedAccounts = () => {
    Alert.alert('Linked Accounts', 'Google account is currently linked.', [{ text: 'OK' }]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Sub-navigation App Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Account Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* LINKED ACCOUNTS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Connections</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.rowItem}
              onPress={handleLinkedAccounts}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="link" size={20} color={colors.primary} />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.rowTitle}>Linked Accounts</Text>
                  <Text style={styles.rowSubtitle}>Manage social logins & external providers</Text>
                </View>
              </View>
              <View style={styles.rowRightBadge}>
                <Text style={styles.connectedText}>1 connected</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* DANGER ZONE SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeading, { color: colors.error }]}>Danger Zone</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.rowItem}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(186, 26, 26, 0.15)' }]}>
                  <MaterialIcons name="delete-forever" size={20} color={colors.error} />
                </View>
                <View style={styles.textCol}>
                  <Text style={[styles.rowTitle, { color: colors.error, fontWeight: '700' }]}>
                    Delete Account
                  </Text>
                  <Text style={styles.rowSubtitle}>Permanently remove all your data</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surface,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: '700',
    },
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: 48,
      gap: Spacing.lg,
    },
    section: {
      gap: 6,
    },
    sectionHeading: {
      ...Typography.captionMd,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: colors.outline,
      paddingHorizontal: 4,
      fontWeight: '700',
    },
    sectionCard: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      ...Shadows.sm,
    },
    rowItem: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      flex: 1,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textCol: {
      flex: 1,
    },
    rowTitle: {
      ...Typography.bodyMd,
      color: colors.onSurface,
      fontWeight: '600',
    },
    rowSubtitle: {
      ...Typography.captionSm,
      color: colors.outline,
      marginTop: 2,
    },
    rowRightBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    connectedText: {
      ...Typography.captionMd,
      color: colors.primary,
      fontWeight: '600',
    },
  });
