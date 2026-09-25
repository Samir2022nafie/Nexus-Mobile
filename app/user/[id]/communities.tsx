/**
 * Public User Communities Screen
 * Allows visitors to view all communities a specific user is a member of,
 * scroll through them, inspect details, and follow/join those communities.
 * Full dark mode support tailored with system tokens.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../../../src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../../src/context/ThemeContext';
import { LoadingSpinner } from '../../../src/components/ui/LoadingSpinner';
import { usersService } from '../../../src/services/users';
import { communitiesService } from '../../../src/services/communities';
import { formatCategoryName } from '../../../src/utils/categories';
import { useAuth } from '../../../src/context/AuthContext';

interface UserCommunityItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  banner_url?: string;
  profilePictureUrl?: string;
  profile_picture_url?: string;
  isPrivate?: boolean;
  is_private?: boolean;
  category?: string;
  memberCount?: number;
  postCount?: number;
  eventCount?: number;
  userRole?: string;
  joinedAt?: string;
  isMember?: boolean;
  viewerRole?: string | null;
}

export default function PublicUserCommunitiesScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { id, username, name } = useLocalSearchParams<{ id: string; username?: string; name?: string }>();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const { user: currentUser } = useAuth();
  const isSelf = Boolean(currentUser?.id && id && currentUser.id === id);

  const [communities, setCommunities] = useState<UserCommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingSlugs, setActionLoadingSlugs] = useState<Record<string, boolean>>({});

  const loadCommunities = useCallback(async () => {
    if (!id) return;
    try {
      const data = await usersService.getUserCommunities(id);
      setCommunities(data || []);
    } catch {
      // Non-blocking error handling
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCommunities();
  };

  const handleToggleJoin = async (item: UserCommunityItem) => {
    if (!item.slug || actionLoadingSlugs[item.slug]) return;

    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to join communities.');
      return;
    }

    const currentIsMember = !!item.isMember;
    const currentMemberCount = item.memberCount ?? 0;
    const nextIsMember = !currentIsMember;
    const nextMemberCount = nextIsMember ? currentMemberCount + 1 : Math.max(0, currentMemberCount - 1);

    // Optimistic update
    setCommunities((prev) =>
      prev.map((c) =>
        c.slug === item.slug
          ? { ...c, isMember: nextIsMember, memberCount: nextMemberCount }
          : c
      )
    );

    setActionLoadingSlugs((prev) => ({ ...prev, [item.slug]: true }));

    try {
      if (nextIsMember) {
        await communitiesService.join(item.slug);
      } else {
        await communitiesService.leave(item.slug);
      }
    } catch (err: any) {
      // Revert optimistic update on failure
      setCommunities((prev) =>
        prev.map((c) =>
          c.slug === item.slug
            ? { ...c, isMember: currentIsMember, memberCount: currentMemberCount }
            : c
        )
      );
      Alert.alert('Action Failed', err?.message || 'Unable to update community membership.');
    } finally {
      setActionLoadingSlugs((prev) => ({ ...prev, [item.slug]: false }));
    }
  };

  const filteredCommunities = useMemo(() => {
    if (!searchQuery.trim()) return communities;
    const q = searchQuery.toLowerCase().trim();
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q)
    );
  }, [communities, searchQuery]);

  const renderCommunityCard = ({ item }: { item: UserCommunityItem }) => {
    const avatarUri = item.profilePictureUrl || item.profile_picture_url || item.bannerUrl || item.banner_url;
    const isMember = !!item.isMember;
    const isActionLoading = !!actionLoadingSlugs[item.slug];
    const categoryName = formatCategoryName(item.category || 'general', true);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/community/${item.slug}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.communityAvatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialIcons name="groups" size={26} color={colors.primaryContainer} />
            </View>
          )}

          <View style={styles.cardInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.communityName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.isPrivate || item.is_private ? (
                <MaterialIcons
                  name="lock"
                  size={14}
                  color={colors.tertiary}
                  style={styles.lockIcon}
                />
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{categoryName}</Text>
              </View>
              <Text style={styles.metaDot}>·</Text>
              <View style={styles.memberCountRow}>
                <MaterialIcons name="person" size={13} color={colors.secondary} />
                <Text style={styles.memberCountText}>
                  {item.memberCount ?? 0} {item.memberCount === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>
          </View>

          {/* Follow / Join Button */}
          <TouchableOpacity
            style={[
              styles.joinButton,
              isMember ? styles.joinedButton : styles.unjoinedButton,
            ]}
            onPress={() => handleToggleJoin(item)}
            activeOpacity={0.8}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <ActivityIndicator
                size="small"
                color={isMember ? colors.onSurface : colors.onPrimaryContainer}
              />
            ) : isMember ? (
              <View style={styles.buttonContentRow}>
                <MaterialIcons name="check" size={15} color={colors.onSurface} />
                <Text style={styles.joinedButtonText}>Joined</Text>
              </View>
            ) : (
              <View style={styles.buttonContentRow}>
                <MaterialIcons name="add" size={16} color={colors.onPrimaryContainer} />
                <Text style={styles.unjoinedButtonText}>Join</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {item.description ? (
          <Text style={styles.descriptionText} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {item.userRole && item.userRole !== 'member' ? (
          <View style={styles.roleRow}>
            <MaterialIcons name="verified-user" size={12} color={colors.primaryContainer} />
            <Text style={styles.roleText}>
              User is {item.userRole.charAt(0).toUpperCase() + item.userRole.slice(1)}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.screenTitle}>Communities</Text>
          <Text style={styles.screenSubtitle} numberOfLines={1}>
            {isSelf ? 'Your Communities' : (name ? `${name} (@${username || 'user'})` : `@${username || 'user'}`)}
          </Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color={colors.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search communities..."
            placeholderTextColor={colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color={colors.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner message="Loading communities..." />
        </View>
      ) : (
        <FlatList
          data={filteredCommunities}
          keyExtractor={(item) => item.id || item.slug}
          renderItem={renderCommunityCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryContainer}
              colors={[colors.primaryContainer]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="group-off" size={54} color={colors.tertiary} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No Matching Communities' : 'No Communities Found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No communities match "${searchQuery}"`
                  : isSelf
                  ? "You haven't joined any communities yet."
                  : `@${username || 'This user'} hasn't joined any public communities yet.`}
              </Text>
            </View>
          }
        />
      )}
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    headerTitleCol: {
      flex: 1,
      alignItems: 'center',
      marginHorizontal: Spacing.sm,
    },
    screenTitle: {
      ...Typography.titleMd,
      fontSize: 17,
      fontWeight: '700',
      color: colors.onSurface,
    },
    screenSubtitle: {
      ...Typography.bodySm,
      fontSize: 12,
      color: colors.tertiary,
      marginTop: 1,
    },
    headerRightPlaceholder: {
      width: 40,
    },
    searchSection: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.surface,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      height: 44,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    searchIcon: {
      marginRight: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...Typography.bodyMd,
      color: colors.onSurface,
      height: '100%',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      gap: Spacing.sm,
    },
    card: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    communityAvatar: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surfaceContainerHighest,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surfaceContainerHighest,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardInfo: {
      flex: 1,
      marginLeft: Spacing.md,
      marginRight: Spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    communityName: {
      ...Typography.titleMd,
      fontSize: 15,
      fontWeight: '700',
      color: colors.onSurface,
      flexShrink: 1,
    },
    lockIcon: {
      marginLeft: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      flexWrap: 'wrap',
    },
    categoryBadge: {
      backgroundColor: colors.surfaceContainerHighest,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    categoryText: {
      ...Typography.labelSm,
      fontSize: 11,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    metaDot: {
      color: colors.tertiary,
      marginHorizontal: 5,
      fontSize: 12,
    },
    memberCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    memberCountText: {
      ...Typography.bodySm,
      fontSize: 12,
      color: colors.secondary,
    },
    joinButton: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: BorderRadius.full,
      minWidth: 78,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unjoinedButton: {
      backgroundColor: colors.primaryContainer,
    },
    joinedButton: {
      backgroundColor: colors.surfaceContainerHighest,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    buttonContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    unjoinedButtonText: {
      ...Typography.labelSm,
      fontWeight: '700',
      color: colors.onPrimaryContainer,
      fontSize: 13,
    },
    joinedButtonText: {
      ...Typography.labelSm,
      fontWeight: '600',
      color: colors.onSurface,
      fontSize: 13,
    },
    descriptionText: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
      marginTop: Spacing.sm,
    },
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      gap: 4,
    },
    roleText: {
      ...Typography.labelSm,
      fontSize: 11,
      color: colors.primaryContainer,
      fontWeight: '600',
    },
    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyTitle: {
      ...Typography.titleMd,
      fontWeight: '700',
      color: colors.onSurface,
    },
    emptySubtitle: {
      ...Typography.bodyMd,
      color: colors.tertiary,
      textAlign: 'center',
      maxWidth: 280,
    },
  });
