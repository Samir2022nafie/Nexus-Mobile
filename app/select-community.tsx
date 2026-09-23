/**
 * Select Community Screen — Dedicated screen for selecting a community to post to.
 * Features:
 * - Sticky top section with:
 *    Row 1: 'x' close button + 'Post to' title
 *    Row 2: 'Search communities...' search input
 * - Scrollable list of communities user belongs to with Explore page card styling
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../src/constants/theme';
import { useTheme, useThemedStyles } from '../src/context/ThemeContext';
import { communitiesService } from '../src/services/communities';
import { Community } from '../src/types';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { formatCategoryName } from '../src/utils/categories';
import { notifyCommunitySelected } from '../src/utils/communitySelectionStore';

export default function SelectCommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCommunities = async () => {
    try {
      const list = await communitiesService.list({ limit: 100 });
      // Filter to communities user is a member of; if none marked isMember, fallback to list
      const joined = (list || []).filter((c) => Boolean(c.isMember));
      setCommunities(joined.length > 0 ? joined : list || []);
    } catch (err) {
      console.error('Failed to load communities for selection:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadCommunities();
  };

  const filteredCommunities = useMemo(() => {
    if (!searchQuery.trim()) return communities;
    const q = searchQuery.toLowerCase().trim();
    return communities.filter((c) => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const descMatch = c.description?.toLowerCase().includes(q);
      const catName = typeof c.category === 'string' ? c.category : (c.category as any)?.name;
      const catMatch = catName?.toLowerCase().includes(q);
      return nameMatch || descMatch || catMatch;
    });
  }, [communities, searchQuery]);

  const handleSelect = (community: Community) => {
    notifyCommunitySelected(community);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* Sticky Header Section */}
      <View style={styles.stickyHeader}>
        {/* Row 1: [X] + "Post to" */}
        <View style={styles.headerRow1}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityLabel="Close"
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post to</Text>
        </View>

        {/* Row 2: Search communities input */}
        <View style={styles.headerRow2}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.tertiary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search communities..."
              placeholderTextColor={colors.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={18} color={colors.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Second Section: Scrollable List of Communities */}
      {loading ? (
        <LoadingSpinner message="Loading your communities..." />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryContainer}
              colors={[colors.primaryContainer]}
            />
          }
        >
          {filteredCommunities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="groups" size={48} color={colors.tertiary} />
              <Text style={styles.emptyTitle}>No communities found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim()
                  ? `No communities matching "${searchQuery}".`
                  : 'You have not joined any communities yet.'}
              </Text>
            </View>
          ) : (
            filteredCommunities.map((comm) => {
              const catDisplay = formatCategoryName(comm.category, true);
              const avatarUri =
                comm.profile_picture_url ||
                (comm as any).profilePictureUrl ||
                (comm as any).cover_image_url ||
                (comm as any).coverImageUrl ||
                comm.banner_url ||
                (comm as any).bannerUrl;

              return (
                <TouchableOpacity
                  key={comm.id}
                  style={styles.communityCard}
                  onPress={() => handleSelect(comm)}
                  activeOpacity={0.82}
                >
                  <View style={styles.commTopRow}>
                    <View style={styles.commMetaGroup}>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.commAvatar} />
                      ) : (
                        <View style={styles.commAvatarFallback}>
                          <MaterialIcons name="groups" size={24} color={colors.primary} />
                        </View>
                      )}
                      <View style={styles.commTextGroup}>
                        <Text style={styles.commName} numberOfLines={1}>
                          {comm.name}
                        </Text>
                        <View style={styles.commBadgeRow}>
                          <View style={styles.commCategoryPill}>
                            <Text style={styles.commCategoryText}>{catDisplay}</Text>
                          </View>
                          <Text style={styles.commMemberCount}>
                            {comm.memberCount || (comm as any).membersCount || 1} members
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.selectArrowWrap}>
                      <MaterialIcons name="chevron-right" size={22} color={colors.tertiary} />
                    </View>
                  </View>

                  {comm.description ? (
                    <Text style={styles.commDescription} numberOfLines={2}>
                      {comm.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    stickyHeader: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      zIndex: 10,
      elevation: 2,
    },
    headerRow1: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      height: 48,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: '700',
    },
    headerRow2: {
      marginTop: 6,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainer,
      height: 44,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    searchInput: {
      flex: 1,
      height: '100%',
      ...Typography.bodyMd,
      color: colors.onSurface,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      gap: 12,
    },
    // Community Card matching Explore page style
    communityCard: {
      backgroundColor: colors.cardBg,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...Shadows.sm,
    },
    commTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    commMetaGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    commAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceContainerHigh,
    },
    commAvatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(232, 167, 54, 0.2)' : '#fef3c7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    commTextGroup: {
      flex: 1,
    },
    commName: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: '700',
    },
    commBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    commCategoryPill: {
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    commCategoryText: {
      ...Typography.captionSm,
      color: colors.onSurface,
      fontWeight: '600',
    },
    commMemberCount: {
      ...Typography.captionSm,
      color: colors.tertiary,
    },
    selectArrowWrap: {
      paddingLeft: 8,
    },
    commDescription: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      lineHeight: 18,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxl,
      gap: 8,
    },
    emptyTitle: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: '700',
    },
    emptySubtitle: {
      ...Typography.bodyMd,
      color: colors.tertiary,
      textAlign: 'center',
      maxWidth: 260,
    },
  });
