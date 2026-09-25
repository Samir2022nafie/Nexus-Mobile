/**
 * Followers Screen
 * Allows users to view and search their followers, follow/unfollow them back,
 * and remove followers by long-pressing on any follower.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeRouter } from '../src/hooks/useSafeRouter';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { usersService, FollowerItem } from '../src/services/users';

export default function FollowersScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [followers, setFollowers] = useState<FollowerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [actionLoadingIds, setActionLoadingIds] = useState<Record<string, boolean>>({});
  const [activeRemoveUserId, setActiveRemoveUserId] = useState<string | null>(null);

  const searchInputRef = useRef<TextInput | null>(null);

  const loadFollowers = useCallback(async () => {
    try {
      const data = await usersService.getMyFollowers();
      setFollowers(data || []);
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFollowers();
  }, [loadFollowers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFollowers();
  }, [loadFollowers]);

  const handleToggleFollow = async (item: FollowerItem) => {
    const isFollowing = !!item.isFollowing;
    setActionLoadingIds((prev) => ({ ...prev, [item.id]: true }));

    // Optimistic update
    setFollowers((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, isFollowing: !isFollowing } : f))
    );

    try {
      if (isFollowing) {
        await usersService.unfollow(item.id);
      } else {
        await usersService.follow(item.id);
      }
    } catch {
      // Revert on error
      setFollowers((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, isFollowing } : f))
      );
      Alert.alert('Error', 'Unable to update follow status. Please try again.');
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const confirmRemoveFollower = (item: FollowerItem) => {
    const followerName = item.name || `@${item.username}`;
    Alert.alert(
      'Remove Follower',
      `Remove ${followerName} as a follower? They won't be notified, and will no longer see your follower updates.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setActiveRemoveUserId(null) },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => handleRemoveFollower(item.id),
        },
      ]
    );
  };

  const handleRemoveFollower = async (followerId: string) => {
    // Optimistic removal from list
    setFollowers((prev) => prev.filter((f) => f.id !== followerId));
    setActiveRemoveUserId(null);

    try {
      await usersService.removeFollower(followerId);
    } catch {
      Alert.alert('Error', 'Failed to remove follower. Please try again.');
      loadFollowers();
    }
  };

  const filteredFollowers = useMemo(() => {
    if (!searchQuery.trim()) return followers;
    const q = searchQuery.toLowerCase().trim();
    return followers.filter((f) => {
      const u = (f.username || '').toLowerCase();
      const n = (f.name || '').toLowerCase();
      const fn = (f.firstName || '').toLowerCase();
      const ln = (f.lastName || '').toLowerCase();
      return u.includes(q) || n.includes(q) || fn.includes(q) || ln.includes(q);
    });
  }, [followers, searchQuery]);

  const toggleSearchHeader = () => {
    setSearchVisible((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchQuery('');
      }
      return next;
    });
  };

  const renderFollowerCard = ({ item }: { item: FollowerItem }) => {
    const displayName =
      item.name ||
      [item.firstName, item.lastName].filter(Boolean).join(' ') ||
      item.username ||
      'User';
    const isFollowing = !!item.isFollowing;
    const isLoadingAction = !!actionLoadingIds[item.id];
    const isRemoveActive = activeRemoveUserId === item.id;

    return (
      <TouchableOpacity
        style={[styles.card, isRemoveActive && styles.cardActiveHighlight]}
        onPress={() => {
          if (activeRemoveUserId) {
            setActiveRemoveUserId(null);
          } else {
            router.push(`/user/${item.id}`);
          }
        }}
        onLongPress={() => {
          setActiveRemoveUserId(item.id);
          confirmRemoveFollower(item);
        }}
        delayLongPress={300}
        activeOpacity={0.8}
      >
        <View style={styles.cardLeft}>
          {item.profilePictureUrl ? (
            <Image source={{ uri: item.profilePictureUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialIcons name="person" size={24} color={colors.tertiary} />
            </View>
          )}

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <Text style={styles.handleText} numberOfLines={1}>
              @{item.username}
            </Text>
            {item.bio ? (
              <Text style={styles.bioText} numberOfLines={1}>
                {item.bio}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.cardActions}>
          {/* Long press reveals Remove button */}
          {isRemoveActive ? (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => confirmRemoveFollower(item)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="person-remove" size={16} color={colors.error} />
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          ) : null}

          {/* Follow / Following Button */}
          <TouchableOpacity
            style={[
              styles.followBtn,
              isFollowing ? styles.followingBtn : styles.unfollowedBtn,
            ]}
            onPress={() => handleToggleFollow(item)}
            disabled={isLoadingAction}
            activeOpacity={0.7}
          >
            {isLoadingAction ? (
              <ActivityIndicator
                size="small"
                color={isFollowing ? colors.onSurface : '#FFFFFF'}
              />
            ) : (
              <View style={styles.btnContent}>
                <MaterialIcons
                  name={isFollowing ? 'check' : 'person-add'}
                  size={15}
                  color={isFollowing ? colors.primaryContainer : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.followBtnText,
                    isFollowing ? styles.followingBtnText : styles.unfollowedBtnText,
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Followers</Text>
          <Text style={styles.headerSubtitle}>
            {followers.length} {followers.length === 1 ? 'follower' : 'followers'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={toggleSearchHeader}
          style={[styles.searchButton, searchVisible && styles.searchButtonActive]}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={searchVisible ? 'close' : 'search'}
            size={22}
            color={searchVisible ? colors.primaryContainer : colors.onSurface}
          />
        </TouchableOpacity>
      </View>

      {/* Expandable Search Input Bar */}
      {searchVisible ? (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.tertiary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search followers..."
              placeholderTextColor={colors.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={18} color={colors.tertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Followers List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner message="Loading followers..." />
        </View>
      ) : (
        <FlatList
          data={filteredFollowers}
          keyExtractor={(item) => item.id}
          renderItem={renderFollowerCard}
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
              <MaterialIcons name="people-outline" size={54} color={colors.tertiary} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No followers match your search' : 'No Followers Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No followers found matching "${searchQuery}"`
                  : 'When other members follow your profile, they will appear here.'}
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
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      ...Typography.titleLg,
      color: colors.onSurface,
      fontWeight: '700',
    },
    headerSubtitle: {
      ...Typography.captionSm,
      color: colors.tertiary,
    },
    searchButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    searchButtonActive: {
      backgroundColor: colors.primaryContainer + '25',
    },
    searchBarContainer: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      height: 42,
      backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    searchInput: {
      flex: 1,
      ...Typography.bodyMd,
      color: colors.onSurface,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      backgroundColor: isDark ? colors.surfaceContainer : colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    cardActiveHighlight: {
      borderColor: colors.errorContainer,
      backgroundColor: colors.errorContainer + '15',
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      flex: 1,
      marginRight: Spacing.sm,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceContainerHigh,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceContainerHigh,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userInfo: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    displayName: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: '700',
    },
    handleText: {
      ...Typography.captionSm,
      color: colors.tertiary,
      marginTop: 1,
    },
    bioText: {
      ...Typography.captionSm,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    removeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      height: 34,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.errorContainer + '30',
      borderWidth: 1,
      borderColor: colors.error,
    },
    removeBtnText: {
      ...Typography.captionSm,
      color: colors.error,
      fontWeight: '700',
    },
    followBtn: {
      paddingHorizontal: 14,
      height: 34,
      borderRadius: BorderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    unfollowedBtn: {
      backgroundColor: colors.primary,
    },
    followingBtn: {
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    btnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    followBtnText: {
      ...Typography.labelSm,
      fontWeight: '700',
    },
    unfollowedBtnText: {
      color: '#FFFFFF',
    },
    followingBtnText: {
      color: colors.onSurface,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxl,
      paddingHorizontal: Spacing.xl,
    },
    emptyTitle: {
      ...Typography.titleMd,
      color: colors.onSurface,
      fontWeight: '700',
      marginTop: Spacing.md,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...Typography.bodySm,
      color: colors.tertiary,
      marginTop: Spacing.xs,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
