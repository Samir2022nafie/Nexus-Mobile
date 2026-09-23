/**
 * Settings Screen — Matches Stitch screen_29_settings
 * Backend: POST /auth/logout, DELETE /users/me
 * Features:
 * - Account section (Edit Profile, Phone Verification, Linked Accounts)
 * - Notifications section with tactile toggle switch
 * - About section (About Nexus, Terms, Privacy Policy)
 * - Danger Zone (Log Out, Delete Account)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { usersService } from '../src/services/users';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode, isDark, colors } = useTheme();
  const styles = useThemedStyles(getStyles);
  const [pushEnabled, setPushEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Nexus?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(auth)/welcome');
          } catch {
            router.replace('/(auth)/welcome');
          }
        },
      },
    ]);
  };

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

  const displayName =
    user?.name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username ||
    'Sarah Martinez';

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
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ACCOUNT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Account</Text>
          <View style={styles.sectionCard}>
            {/* Edit Profile */}
            <TouchableOpacity
              style={styles.rowItem}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Image
                  source={{
                    uri:
                      user?.profile_picture_url ||
                      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
                  }}
                  style={styles.userRowAvatar}
                />
                <View style={styles.textCol}>
                  <Text style={styles.rowTitle}>Edit Profile</Text>
                  <Text style={styles.rowSubtitle}>{displayName}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
            </TouchableOpacity>

            <View style={styles.hairline} />

            {/* Phone Verification */}
            <TouchableOpacity
              style={styles.rowItem}
              onPress={() =>
                router.push({
                  pathname: '/(auth)/verify-phone',
                  params: { phone: user?.phone_number || '+251911234567' },
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="phone-iphone" size={18} color={colors.outline} />
                </View>
                <Text style={styles.rowTitle}>Phone Verification</Text>
              </View>
              <View style={styles.rowRightBadge}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>Verified ✓</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </View>
            </TouchableOpacity>

            <View style={styles.hairline} />

            {/* Linked Accounts */}
            <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="link" size={18} color={colors.outline} />
                </View>
                <Text style={styles.rowTitle}>Linked Accounts</Text>
              </View>
              <View style={styles.rowRightBadge}>
                <Text style={styles.connectedText}>1 connected</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Notifications</Text>
          <View style={styles.sectionCard}>
            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="notifications" size={18} color={colors.outline} />
                </View>
                <Text style={styles.rowTitle}>Push Notifications</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>

        {/* APPEARANCE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Appearance</Text>
          <View style={styles.sectionCard}>
            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons
                    name={isDark ? 'dark-mode' : 'light-mode'}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.rowTitle}>Dark Mode</Text>
                  <Text style={styles.rowSubtitle}>
                    {themeMode === 'system'
                      ? 'System mode'
                      : isDark
                      ? 'Dark theme active'
                      : 'Light theme active'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>

        {/* ABOUT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>About</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="info" size={18} color={colors.outline} />
                </View>
                <Text style={styles.rowTitle}>About Nexus</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
            </TouchableOpacity>

            <View style={styles.hairline} />

            <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="description" size={18} color={colors.outline} />
                </View>
                <Text style={styles.rowTitle}>Terms of Service</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
            </TouchableOpacity>

            <View style={styles.hairline} />

            <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="shield" size={18} color={colors.outline} />
                </View>
                <Text style={styles.rowTitle}>Privacy Policy</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* DANGER ZONE SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeading, { color: colors.error }]}>Danger Zone</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.rowItem}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(186, 26, 26, 0.15)' }]}>
                  <MaterialIcons name="logout" size={18} color={colors.error} />
                </View>
                <Text style={[styles.rowTitle, { color: colors.error, fontWeight: '700' }]}>
                  Log Out
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.hairline} />

            <TouchableOpacity
              style={styles.rowItem}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(186, 26, 26, 0.15)' }]}>
                  <MaterialIcons name="delete-forever" size={18} color={colors.error} />
                </View>
                <View style={styles.textCol}>
                  <Text style={[styles.rowTitle, { color: colors.error, fontWeight: '700' }]}>
                    Delete Account
                  </Text>
                  <Text style={styles.rowSubtitle}>Permanently remove all your data</Text>
                </View>
              </View>
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
    },
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: Spacing.md,
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
      minHeight: 56,
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
    userRowAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
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
    verifiedBadge: {
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      ...Shadows.sm,
    },
    verifiedBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    connectedText: {
      ...Typography.captionMd,
      color: colors.outline,
    },
    hairline: {
      height: 1,
      backgroundColor: colors.surfaceVariant,
      marginHorizontal: Spacing.md,
    },
  });
