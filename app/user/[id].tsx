/**
 * Other User Profile Screen
 * Backend: GET /users/:id, POST /users/:id/follow, POST /users/:id/block
 * Enforces: can't follow/block self
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { usersService } from '../../src/services/users';
import { socialService } from '../../src/services/social';
import { reportsService } from '../../src/services/reports';
import { useAuth } from '../../src/context/AuthContext';
import { PublicProfile } from '../../src/types';

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isSelf = currentUser?.id === id;

  useEffect(() => {
    if (!id) return;
    usersService.getPublicProfile(id)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleFollow = async () => {
    if (!profile || isSelf) return;
    setActionLoading(true);
    try {
      if (profile.isFollowing) {
        await socialService.unfollowUser(profile.id);
        setProfile((prev) => prev ? { ...prev, isFollowing: false, stats: { ...prev.stats, followersCount: prev.stats.followersCount - 1 } } : prev);
      } else {
        await socialService.followUser(profile.id);
        setProfile((prev) => prev ? { ...prev, isFollowing: true, stats: { ...prev.stats, followersCount: prev.stats.followersCount + 1 } } : prev);
      }
    } catch {} finally { setActionLoading(false); }
  };

  const handleBlock = () => {
    if (!profile || isSelf) return;
    Alert.alert('Block User', `Block @${profile.username}? They won't be able to interact with you.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        try {
          await socialService.blockUser(profile.id);
          setProfile((prev) => prev ? { ...prev, isFollowing: false } : prev);
        } catch {}
      }},
    ]);
  };

  const handleReport = () => {
    if (!profile) return;
    Alert.alert('Report User', 'Report this user for inappropriate behavior?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', onPress: async () => {
        try {
          await reportsService.create({ reportedUserId: profile.id, reason: 'Inappropriate behavior' });
          Alert.alert('Reported', 'Thank you for your report. We will review it.');
        } catch {}
      }},
    ]);
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (!profile) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>User not found</Text></View>;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isSelf ? (
          <TouchableOpacity onPress={handleReport} style={styles.backButton}>
            <MaterialIcons name="more-vert" size={24} color={Colors.onSurface} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      <View style={styles.profileSection}>
        <Avatar uri={profile.profilePictureUrl} name={profile.name} size={88} showBorder />
        <Text style={styles.displayName}>{profile.name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.communitiesCount}</Text>
            <Text style={styles.statLabel}>Communities</Text>
          </View>
        </View>

        {/* Action buttons — hidden for self (can't follow/block self) */}
        {!isSelf && (
          <View style={styles.actionRow}>
            <Button
              title={profile.isFollowing ? 'Following' : 'Follow'}
              onPress={handleFollow}
              variant={profile.isFollowing ? 'outlined' : 'primary'}
              size="sm"
              loading={actionLoading}
              style={{ flex: 1 }}
            />
            <Button
              title="Block"
              onPress={handleBlock}
              variant="outlined"
              size="sm"
              style={{ borderColor: Colors.error }}
              textStyle={{ color: Colors.error }}
            />
          </View>
        )}
      </View>

      <View style={styles.joinedSection}>
        <Text style={styles.joinedLabel}>Member since</Text>
        <Text style={styles.joinedDate}>{new Date(profile.createdAt).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</Text>
      </View>

      <View style={{ height: Spacing.xxl * 2 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.titleMd, color: Colors.onSurface },
  profileSection: { alignItems: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.xs },
  displayName: { ...Typography.headlineSm, color: Colors.onSurface, marginTop: Spacing.md },
  username: { ...Typography.bodyMd, color: Colors.outline },
  bio: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: Spacing.sm, maxWidth: 300 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    marginTop: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.xl,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { ...Typography.headlineSm, color: Colors.onSurface },
  statLabel: { ...Typography.captionSm, color: Colors.outline, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.outlineVariant },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, width: '100%' },
  joinedSection: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.surfaceContainerHigh,
  },
  joinedLabel: { ...Typography.labelSm, color: Colors.outline },
  joinedDate: { ...Typography.bodyMd, color: Colors.onSurface, marginTop: 4 },
});
