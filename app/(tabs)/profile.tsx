/**
 * Profile Screen (Self) — Matches Stitch screen_24_own_profile_posts_tab
 * Overhauled with:
 * - Clean top bar with settings gear button only (no "Profile" text or yellow dot)
 * - Profile header pushed higher up, card box removed
 * - 96x96 enlarged avatar
 * - Edit profile button removed from header
 * - 4 scrollable main tabs: Posts, Bookmarks, Hangouts, Events
 * - Posts sub-tabs: Posts / Comments (with edit/delete)
 * - Bookmarks sub-tabs: Posts / Events / Hangouts (with unsave)
 * - Hangouts tab: created by user (with edit/delete)
 * - Events tab: proposed/created by user (with edit/delete)
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Modal,
  TextInput,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { usersService } from '../../src/services/users';
import { postsService } from '../../src/services/posts';
import { commentsService } from '../../src/services/comments';
import { hangoutsService } from '../../src/services/hangouts';
import { eventsService } from '../../src/services/events';
import { communitiesService } from '../../src/services/communities';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { categorizeItemByDate } from '../../src/utils/dateUtils';
import { formatCategoryName } from '../../src/utils/categories';
import { useTabBarVisibility } from '../../src/context/TabBarVisibilityContext';
import { usePostState } from '../../src/context/PostStateContext';
import { FeedDiscussionCard } from '../../src/components/FeedDiscussionCard';

function formatPostDate(rawDate?: string) {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

const MAIN_TABS = [
  { id: 'Posts', icon: 'schedule', label: 'Activity' },
  { id: 'Bookmarks', icon: 'bookmark', label: 'Saved' },
  { id: 'Hangouts', icon: 'local-cafe', label: 'Hangouts' },
  { id: 'Events', icon: 'event', label: 'Events' },
] as const;
type MainTab = typeof MAIN_TABS[number]['id'];

const POSTS_SUB_TABS = ['Posts', 'Comments'] as const;
type PostsSubTab = typeof POSTS_SUB_TABS[number];

const BOOKMARKS_SUB_TABS = ['Posts', 'Events', 'Hangouts'] as const;
type BookmarksSubTab = typeof BOOKMARKS_SUB_TABS[number];

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const scrollViewRef = useRef<ScrollView>(null);
  const horizontalRef = useRef<any>(null);
  const profileScrollX = useRef(new Animated.Value(0)).current;

  // Geometry for animated tabs (4 tabs)
  const profileTrackWidth = screenWidth - Spacing.md * 2;
  const profileTabWidth = (profileTrackWidth - 8) / 4;
  const profileIndicatorWidth = profileTabWidth * 0.7;
  const profileIndicatorOffset = (profileTabWidth - profileIndicatorWidth) / 2;

  const profileIndicatorTranslateX = profileScrollX.interpolate({
    inputRange: [0, screenWidth, 2 * screenWidth, 3 * screenWidth],
    outputRange: [
      4 + profileIndicatorOffset,
      4 + profileTabWidth + profileIndicatorOffset,
      4 + 2 * profileTabWidth + profileIndicatorOffset,
      4 + 3 * profileTabWidth + profileIndicatorOffset,
    ],
    extrapolate: 'clamp',
  });

  const profilePillTranslateX = profileScrollX.interpolate({
    inputRange: [0, screenWidth, 2 * screenWidth, 3 * screenWidth],
    outputRange: [
      4,
      4 + profileTabWidth,
      4 + 2 * profileTabWidth,
      4 + 3 * profileTabWidth,
    ],
    extrapolate: 'clamp',
  });

  const handleSelectMainTab = (tabId: MainTab) => {
    setActiveTab(tabId);
    const index = MAIN_TABS.findIndex((t) => t.id === tabId);
    if (index !== -1) {
      horizontalRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    }
  };

  const {
    likedPosts: globalLiked,
    savedPosts: globalSaved,
    setPostLiked,
    setPostSaved,
    toggleLike,
    toggleSave,
  } = usePostState();

  const [activeTab, setActiveTab] = useState<MainTab>('Posts');
  const [postsSubTab, setPostsSubTab] = useState<PostsSubTab>('Posts');
  const [bookmarksSubTab, setBookmarksSubTab] = useState<BookmarksSubTab>('Posts');
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPostMap, setSavedPostMap] = useState<Record<string, boolean>>({});

  // Dynamic header hide/reveal on scroll & scroll-triggered name reveal
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerNameOpacity = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const headerVisible = useRef(true);
  const nameVisible = useRef(false);

  const { handleTabBarScroll } = useTabBarVisibility();

  const [userStats, setUserStats] = useState<{
    followersCount: number;
    followingCount: number;
    communitiesCount: number;
  } | null>(null);

  // Scroll to top when active profile tab is clicked
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      if (navigation.isFocused()) {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  // User items
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myComments, setMyComments] = useState<any[]>([]);
  const [myHangouts, setMyHangouts] = useState<any[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);

  // Bookmarks
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [savedEvents, setSavedEvents] = useState<any[]>([]);
  const [savedHangouts, setSavedHangouts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal State
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    type: 'post' | 'comment' | 'hangout' | 'event';
    id: string;
    slug?: string;
    title: string;
    content: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [comms, pubProfile, hangouts] = await Promise.all([
        communitiesService.list({ limit: 50 }).catch(() => []),
        user?.id ? usersService.getPublicProfile(user.id).catch(() => null) : null,
        hangoutsService.list({ limit: 50 }).catch(() => []),
      ]);

      if (pubProfile?.stats) {
        setUserStats(pubProfile.stats);
      }

      // Filter hangouts
      const allHangouts = hangouts || [];
      const userHangouts = allHangouts.filter(
        (h: any) => h.creator_id === user?.id || h.creator?.id === user?.id
      );
      const bookmarkedHangouts = allHangouts.filter((h: any) => h.isSaved);
      setMyHangouts(userHangouts);
      setSavedHangouts(bookmarkedHangouts);

      // Fetch posts and events from communities
      const allComms = comms || [];
      if (allComms.length > 0) {
        const topComms = allComms.slice(0, 15);
        const postPromises = topComms.map(async (c) => {
          try {
            const res = await postsService.listByCommmunity(c.slug, { limit: 25 });
            const arr = Array.isArray(res) ? res : ((res as any)?.data || []);
            return arr.map((item: any) => ({
              ...item,
              community: item.community || c,
              communityName: item.community?.name || c.name,
              communityCategory: item.community?.category || c.category,
              communitySlug: item.community?.slug || c.slug,
            }));
          } catch {
            return [];
          }
        });

        const eventPromises = topComms.map(async (c) => {
          try {
            const res = await eventsService.listByCommunity(c.slug, { limit: 25 });
            const arr = Array.isArray(res) ? res : ((res as any)?.data || []);
            return arr.map((item: any) => ({
              ...item,
              community: item.community || c,
              communityName: item.community?.name || c.name,
              communityCategory: item.community?.category || c.category,
              communitySlug: item.community?.slug || c.slug,
            }));
          } catch {
            return [];
          }
        });

        const [postArrays, eventArrays] = await Promise.all([
          Promise.all(postPromises),
          Promise.all(eventPromises),
        ]);

        const flatPosts = postArrays.flat();
        const flatEvents = eventArrays.flat();

        const userP = flatPosts.filter(
          (p: any) => p.author_id === user?.id || p.author?.id === user?.id
        );
        const savedP = flatPosts.filter((p: any) => p.isSaved || p.hasSaved);
        setMyPosts(userP);
        setSavedPosts(savedP);

        const initialMap: Record<string, boolean> = {};
        savedP.forEach((p: any) => {
          initialMap[p.id] = true;
        });
        setSavedPostMap(initialMap);

        // User Events & Bookmarked Events
        const userE = flatEvents.filter(
          (e: any) => e.creator_id === user?.id || e.creator?.id === user?.id
        );
        const savedE = flatEvents.filter((e: any) => e.isSaved);
        setMyEvents(userE);
        setSavedEvents(savedE);

        // User comments: fetch from posts and map postId
        try {
          const commentPromises = flatPosts.slice(0, 15).map(async (p: any) => {
            try {
              const res = await commentsService.listByPost(p.id);
              const arr = Array.isArray(res) ? res : ((res as any)?.data || []);
              return arr.map((c: any) => ({
                ...c,
                postId: p.id,
                postTitle: p.title || 'Discussion',
              }));
            } catch {
              return [];
            }
          });
          const commentArrays = await Promise.all(commentPromises);
          const flatComments = commentArrays.flat();
          const userC = flatComments.filter(
            (c: any) => c.author_id === user?.id || c.author?.id === user?.id
          );
          setMyComments(userC);
        } catch {
          setMyComments([]);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshUser();
    fetchData();
  };

  const displayName =
    user?.name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username ||
    'Explorer';

  // Delete handlers
  const handleDeletePost = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postsService.delete(postId);
            setMyPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch {
            Alert.alert('Error', 'Failed to delete post.');
          }
        },
      },
    ]);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await commentsService.delete(commentId);
            setMyComments((prev) => prev.filter((c) => c.id !== commentId));
          } catch {
            Alert.alert('Error', 'Failed to delete comment.');
          }
        },
      },
    ]);
  };

  const handleDeleteHangout = (hangoutId: string) => {
    Alert.alert('Delete Hangout', 'Are you sure you want to cancel this hangout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await hangoutsService.delete(hangoutId);
            setMyHangouts((prev) => prev.filter((h) => h.id !== hangoutId));
          } catch {
            Alert.alert('Error', 'Failed to delete hangout.');
          }
        },
      },
    ]);
  };

  const handleDeleteEvent = (slug: string, eventId: string) => {
    Alert.alert('Delete Event', 'Are you sure you want to cancel this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await eventsService.delete(slug, eventId);
            setMyEvents((prev) => prev.filter((e) => e.id !== eventId));
          } catch {
            Alert.alert('Error', 'Failed to delete event.');
          }
        },
      },
    ]);
  };

  const handleToggleLike = async (postId: string) => {
    const postObj = myPosts.find((p) => p.id === postId) || savedPosts.find((p) => p.id === postId);
    const initial = Boolean(postObj?.hasReacted || postObj?.isLiked);
    const currentlyLiked = globalLiked[postId] ?? likedPosts[postId] ?? initial;
    const baseLikes = postObj?.likesCount ?? postObj?.reactionCount ?? 0;
    const nextLiked = !currentlyLiked;

    setLikedPosts((prev) => ({ ...prev, [postId]: nextLiked }));

    const updateLikes = (p: any) => {
      if (p.id !== postId) return p;
      const base = p.likesCount || p.reactionCount || 0;
      const newCount = Math.max(0, base + (nextLiked ? 1 : -1));
      return {
        ...p,
        likesCount: newCount,
        reactionCount: newCount,
        hasReacted: nextLiked,
      };
    };

    setMyPosts((prev) => prev.map(updateLikes));
    setSavedPosts((prev) => prev.map(updateLikes));

    try {
      await toggleLike(postId, currentlyLiked, baseLikes);
    } catch {
      setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
    }
  };

  const handleToggleSavePost = async (postId: string) => {
    const postObj = myPosts.find((p) => p.id === postId) || savedPosts.find((p) => p.id === postId);
    const initial = Boolean(postObj?.isSaved || postObj?.hasSaved);
    const currentlySaved =
      globalSaved[postId] ??
      savedPostMap[postId] ??
      (savedPosts.some((p) => p.id === postId) || initial);
    const nextSaved = !currentlySaved;

    setSavedPostMap((prev) => ({ ...prev, [postId]: nextSaved }));

    if (!nextSaved && activeTab === 'Bookmarks' && bookmarksSubTab === 'Posts') {
      setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
    }

    try {
      await toggleSave(postId, currentlySaved);
      if (!nextSaved) {
        setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      setSavedPostMap((prev) => ({ ...prev, [postId]: currentlySaved }));
    }
  };

  const handleUnsavePost = async (postId: string) => {
    handleToggleSavePost(postId);
  };

  const handleUnsaveEvent = async (slug: string, eventId: string) => {
    setSavedEvents((prev) => prev.filter((e) => e.id !== eventId));
    try {
      await eventsService.toggleSave(slug, eventId);
    } catch {
      fetchData();
    }
  };

  const handleUnsaveHangout = async (hangoutId: string) => {
    setSavedHangouts((prev) => prev.filter((h) => h.id !== hangoutId));
    try {
      await hangoutsService.toggleSave(hangoutId);
    } catch {
      fetchData();
    }
  };

  // Edit Save Handler
  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSavingEdit(true);
    try {
      if (editModal.type === 'post') {
        await postsService.update(editModal.id, {
          title: editModal.title,
          content: editModal.content,
        });
        setMyPosts((prev) =>
          prev.map((p) =>
            p.id === editModal.id
              ? { ...p, title: editModal.title, content: editModal.content }
              : p
          )
        );
      } else if (editModal.type === 'comment') {
        await commentsService.update(editModal.id, {
          content: editModal.content,
        });
        setMyComments((prev) =>
          prev.map((c) =>
            c.id === editModal.id ? { ...c, content: editModal.content } : c
          )
        );
      } else if (editModal.type === 'hangout') {
        await hangoutsService.update(editModal.id, {
          title: editModal.title,
          description: editModal.content,
        });
        setMyHangouts((prev) =>
          prev.map((h) =>
            h.id === editModal.id
              ? { ...h, title: editModal.title, description: editModal.content }
              : h
          )
        );
      } else if (editModal.type === 'event' && editModal.slug) {
        await eventsService.update(editModal.slug, editModal.id, {
          title: editModal.title,
          description: editModal.content,
        });
        setMyEvents((prev) =>
          prev.map((e) =>
            e.id === editModal.id
              ? { ...e, title: editModal.title, description: editModal.content }
              : e
          )
        );
      }
      setEditModal(null);
    } catch {
      Alert.alert('Error', 'Failed to save edits.');
    } finally {
      setSavingEdit(false);
    }
  };


  const handleProfileScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const dy = currentY - lastScrollY.current;
    const dt = Math.max(1, currentTime - lastScrollTime.current);
    const velocityY = dy / dt;

    lastScrollY.current = currentY;
    lastScrollTime.current = currentTime;

    // Sync bottom navigation bar hide/reveal
    handleTabBarScroll(dy, velocityY, currentY);

    // Special rule: Name displayed in header only when scrolled past pfp, name, and username (> 190px)
    if (currentY > 190 && !nameVisible.current) {
      nameVisible.current = true;
      Animated.timing(headerNameOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else if (currentY <= 190 && nameVisible.current) {
      nameVisible.current = false;
      Animated.timing(headerNameOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }

    if (currentY <= 15) {
      if (!headerVisible.current) {
        headerVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    } else if (dy > 2 && currentY > 30) {
      // Hide on downward scroll
      if (headerVisible.current) {
        headerVisible.current = false;
        Animated.timing(headerTranslateY, {
          toValue: -110,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } else if (dy < -4 && velocityY < -0.6) {
      // Reveal on quick swipe up
      if (!headerVisible.current) {
        headerVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
  }

  return (
    <View style={styles.screen}>
      {/* Persistent Status Bar Spacer */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: colors.surface,
          zIndex: 9999,
        }}
      />

      {/* Dynamic Sliding Header with Centered User Name & Settings */}
      <Animated.View
        style={[
          styles.slidingHeader,
          {
            top: insets.top,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.slidingHeaderInner}>
          {/* Tappable header area to scroll back to top */}
          <TouchableOpacity
            style={styles.headerPressableArea}
            onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
            activeOpacity={0.9}
          >
            {/* Left balance spacer matching right settings icon */}
            <View style={styles.leftSpacer} />

            {/* Center: User's name */}
            <Animated.View style={styles.headerCenterTitleWrap}>
              <Animated.View style={{ opacity: headerNameOpacity }}>
                <Text style={styles.headerUserNameText} numberOfLines={1}>
                  {displayName}
                </Text>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
            activeOpacity={0.7}
            accessibilityLabel="Settings"
          >
            <MaterialIcons name="settings" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 10) + 48 },
        ]}
        onScroll={handleProfileScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryContainer}
            progressViewOffset={Math.max(insets.top, 10) + 40}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header — Compact, pushed higher up */}
        <View style={styles.profileHeader}>
          {/* 96x96 Avatar */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
          >
            {user?.profile_picture_url ? (
              <Image
                source={{ uri: user.profile_picture_url }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatarImage, styles.avatarFallback]}>
                <MaterialIcons name="person" size={54} color={colors.tertiary} />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <MaterialIcons name="photo-camera" size={16} color={colors.onPrimary} />
            </View>
          </TouchableOpacity>

          {/* User Identity */}
          <Text style={styles.displayNameText}>{displayName}</Text>
          <Text style={styles.usernameText}>@{user?.username || 'user'}</Text>

          {/* Stats Row — Placed directly below username and above bio */}
          <View style={styles.statsMatrix}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{userStats?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{userStats?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{userStats?.communitiesCount ?? 0}</Text>
              <Text style={styles.statLabel}>Communities</Text>
            </View>
          </View>

          {/* Bio Statement */}
          {user?.bio ? (
            <Text style={styles.bioText}>{user.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/edit-profile')}>
              <Text style={styles.addBioPrompt}>+ Add bio</Text>
            </TouchableOpacity>
          )}

          {/* Compact Trust Badge */}
          <View style={styles.trustBadge}>
            <MaterialIcons name="verified" size={14} color={colors.primaryContainer} />
            <Text style={styles.trustBadgeText}>
              Trust Score: {user?.trust_score ?? 50}
            </Text>
          </View>
        </View>

        {/* 4 Main Tabs with Animated Underline and Tab Color Highlight */}
        <View style={styles.tabsWrapper}>
          <View style={styles.tabsContainer}>
            {/* Animated Active Pill Backdrop */}
            <Animated.View
              style={[
                styles.animatedActivePill,
                {
                  width: profileTabWidth,
                  transform: [{ translateX: profilePillTranslateX }],
                },
              ]}
            />

            {/* Animated Underline Bar */}
            <Animated.View
              style={[
                styles.animatedIndicatorBar,
                {
                  width: profileIndicatorWidth,
                  transform: [{ translateX: profileIndicatorTranslateX }],
                },
              ]}
            />

            {MAIN_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.tabIconBtn}
                  onPress={() => handleSelectMainTab(tab.id)}
                  activeOpacity={0.75}
                >
                  <MaterialIcons
                    name={tab.icon as any}
                    size={19}
                    color={isActive ? (isDark ? '#feba48' : colors.primaryContainer) : colors.tertiary}
                  />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Horizontal Swiping Pager across 4 Profile Tabs */}
        <Animated.ScrollView
          ref={horizontalRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: profileScrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            if (MAIN_TABS[idx] && MAIN_TABS[idx].id !== activeTab) {
              setActiveTab(MAIN_TABS[idx].id);
            }
          }}
        >
          {/* Page 0: Activity (Posts & Comments) */}
          <View style={{ width: screenWidth, paddingHorizontal: Spacing.md }}>
            <View style={styles.tabContentArea}>
            {/* Sub-tabs: Posts | Comments */}
            <View style={styles.subTabsRow}>
              {POSTS_SUB_TABS.map((sub) => {
                const isActive = postsSubTab === sub;
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subTabBtn, isActive && styles.subTabBtnActive]}
                    onPress={() => setPostsSubTab(sub)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subTabTxt, isActive && styles.subTabTxtActive]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {postsSubTab === 'Posts' ? (
              myPosts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="dynamic-feed" size={36} color={colors.tertiary} />
                  <Text style={styles.emptyTitle}>No Posts Published</Text>
                  <Text style={styles.emptyDesc}>
                    Discussions and updates you share will appear here.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/new-post')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyActionBtnText}>Create Post</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                myPosts.map((post: any) => (
                  <FeedDiscussionCard
                    key={post.id}
                    post={post}
                    isLiked={globalLiked[post.id] ?? likedPosts[post.id] ?? post.hasReacted}
                    isSaved={globalSaved[post.id] ?? savedPostMap[post.id] ?? post.isSaved}
                    onToggleLike={handleToggleLike}
                    onToggleSave={handleToggleSavePost}
                    onPressPost={(id) => router.push(`/post/${id}`)}
                    onPressCommunity={(slug) => router.push(`/community/${slug}`)}
                    style={{ marginBottom: 12 }}
                  />
                ))
              )
            ) : myComments.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="chat-bubble-outline" size={36} color={colors.tertiary} />
                <Text style={styles.emptyTitle}>No Comments Yet</Text>
                <Text style={styles.emptyDesc}>
                  Comments you add to community discussions will appear here.
                </Text>
              </View>
            ) : (
              myComments.map((comment) => {
                const targetPostId = comment.postId || comment.post_id || comment.post?.id;
                return (
                  <TouchableOpacity
                    key={comment.id}
                    style={styles.profileCommentCard}
                    onPress={() => {
                      if (targetPostId) {
                        router.push({
                          pathname: '/post/[id]',
                          params: { id: targetPostId, highlightCommentId: comment.id },
                        } as any);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    {/* Comment Header with discussion context */}
                    <View style={styles.profileCommentHeader}>
                      <View style={styles.profileCommentContextRow}>
                        <MaterialIcons name="chat-bubble-outline" size={15} color={colors.primary} />
                        <Text style={styles.profileCommentContextText} numberOfLines={1}>
                          {comment.postTitle ? `In: ${comment.postTitle}` : 'In discussion'}
                        </Text>
                      </View>
                      <Text style={styles.profileCommentTime}>
                        {formatPostDate(comment.createdAt || comment.created_at)}
                      </Text>
                    </View>

                    {/* Comment Body Quote */}
                    <View style={styles.profileCommentQuoteBox}>
                      <Text style={styles.profileCommentBody} numberOfLines={3}>
                        "{comment.content}"
                      </Text>
                    </View>

                    {/* Tap prompt */}
                    <View style={styles.profileCommentFooter}>
                      <Text style={styles.profileCommentTapHint}>View discussion</Text>
                      <MaterialIcons name="arrow-forward" size={13} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            </View>
          </View>

          {/* Page 1: Bookmarks (Saved) */}
          <View style={{ width: screenWidth, paddingHorizontal: Spacing.md }}>
            <View style={styles.tabContentArea}>
            {/* Sub-tabs: Posts | Events | Hangouts */}
            <View style={styles.subTabsRow}>
              {BOOKMARKS_SUB_TABS.map((sub) => {
                const isActive = bookmarksSubTab === sub;
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subTabBtn, isActive && styles.subTabBtnActive]}
                    onPress={() => setBookmarksSubTab(sub)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subTabTxt, isActive && styles.subTabTxtActive]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {bookmarksSubTab === 'Posts' ? (
              savedPosts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="bookmark-border" size={36} color={colors.tertiary} />
                  <Text style={styles.emptyTitle}>No Saved Posts</Text>
                  <Text style={styles.emptyDesc}>Bookmark posts you want to revisit later.</Text>
                </View>
              ) : (
                savedPosts.map((post) => (
                  <FeedDiscussionCard
                    key={post.id}
                    post={post}
                    isLiked={globalLiked[post.id] ?? likedPosts[post.id] ?? post.hasReacted}
                    isSaved={globalSaved[post.id] ?? savedPostMap[post.id] ?? true}
                    onToggleLike={handleToggleLike}
                    onToggleSave={handleToggleSavePost}
                    onPressPost={(id) => router.push(`/post/${id}`)}
                    onPressCommunity={(slug) => router.push(`/community/${slug}`)}
                    style={{ marginBottom: 12 }}
                  />
                ))
              )
            ) : bookmarksSubTab === 'Events' ? (
              savedEvents.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="event" size={36} color={colors.tertiary} />
                  <Text style={styles.emptyTitle}>No Saved Events</Text>
                  <Text style={styles.emptyDesc}>Bookmark events you plan to attend.</Text>
                </View>
              ) : (
                savedEvents.map((ev) => {
                  const cat = categorizeItemByDate(ev);
                  const categoryBadge = ev.category || ev.community?.category || 'Community';
                  const commName = ev.communityName || ev.community?.name || 'Nexus Community';

                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.savedEventCardFull, cat.isPassed && styles.itemCardPassed]}
                      onPress={() => {
                        router.push({
                          pathname: '/event/[id]',
                          params: { id: ev.id, slug: ev.communitySlug || ev.community?.slug },
                        } as any);
                      }}
                      activeOpacity={cat.isPassed ? 0.38 : 0.85}
                    >
                      <View style={styles.savedEventCoverWrapper}>
                        <Image
                          source={{
                            uri:
                              ev.cover_image_url ||
                              ev.coverImageUrl ||
                              'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600',
                          }}
                          style={styles.savedEventCover}
                        />
                        <View style={styles.eventCategoryBadge}>
                          <Text style={styles.eventCategoryBadgeText} numberOfLines={1}>
                            {formatCategoryName(categoryBadge, true)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.eventUnsaveTopBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleUnsaveEvent(ev.communitySlug || ev.community?.slug, ev.id);
                          }}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="bookmark" size={18} color={colors.primaryContainer} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.eventBody}>
                        <View>
                          <Text style={styles.eventTitle} numberOfLines={1}>
                            {ev.title}
                          </Text>
                          <Text style={styles.eventCommunityNameText} numberOfLines={1}>
                            {commName}
                          </Text>
                        </View>
                        <View style={styles.eventMetaRow}>
                          <View style={styles.metaItem}>
                            <MaterialIcons
                              name="calendar-today"
                              size={13}
                              color={cat.isPassed ? colors.tertiary : colors.primary}
                            />
                            <Text
                              style={[
                                styles.metaText,
                                cat.status === 'today' && { color: colors.primary, fontWeight: '700' },
                              ]}
                            >
                              {cat.dateText}
                            </Text>
                          </View>
                          <View style={styles.metaItem}>
                            <MaterialIcons name="group" size={13} color={colors.secondary} />
                            <Text style={styles.metaTextSec}>
                              {`${ev.participantsCount ?? ev.participantCount ?? 0} ${cat.isPassed ? 'went' : 'going'}`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )
            ) : savedHangouts.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="groups" size={36} color={colors.tertiary} />
                <Text style={styles.emptyTitle}>No Saved Hangouts</Text>
                <Text style={styles.emptyDesc}>Bookmark meetups and co-working sessions.</Text>
              </View>
            ) : (
              <View style={styles.savedHangoutsGrid}>
                {savedHangouts.map((h) => {
                  const cat = categorizeItemByDate(h);
                  const isOpen =
                    h.joinType === 'OPEN' ||
                    h.join_type === 'OPEN' ||
                    h.joinType === 'open' ||
                    h.join_type === 'open';

                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.savedHangoutCard, cat.isPassed && styles.itemCardPassed]}
                      onPress={() => {
                        router.push(`/hangout/${h.id}`);
                      }}
                      activeOpacity={cat.isPassed ? 0.38 : 0.85}
                    >
                      <View>
                        <View style={styles.hangoutHeader}>
                          <View style={styles.hangoutCreatorRow}>
                            {h.creatorAvatar || h.creator?.profile_picture_url ? (
                              <Image
                                source={{
                                  uri: h.creatorAvatar || h.creator?.profile_picture_url,
                                }}
                                style={styles.hangoutCreatorAvatar}
                              />
                            ) : (
                              <View style={styles.hangoutAvatarFallback}>
                                <MaterialIcons name="person" size={15} color={colors.tertiary} />
                              </View>
                            )}
                            <Text style={styles.hangoutCreatorName} numberOfLines={1}>
                              {h.creatorName || h.creator?.first_name || 'Host'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.hangoutPill,
                              isOpen ? styles.hangoutPillOpen : styles.hangoutPillRequest,
                            ]}
                          >
                            {isOpen && <View style={styles.openDot} />}
                            <Text
                              style={[
                                styles.hangoutPillText,
                                isOpen ? styles.hangoutPillOpenText : styles.hangoutPillRequestText,
                              ]}
                            >
                              {isOpen ? 'Open' : 'Request'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.hangoutTitle} numberOfLines={2}>
                          {h.title}
                        </Text>

                        <View style={styles.hangoutScheduleRow}>
                          <MaterialIcons
                            name="schedule"
                            size={13}
                            color={cat.status === 'today' ? colors.primary : colors.onSurfaceVariant}
                          />
                          <Text
                            style={[
                              styles.hangoutScheduleText,
                              cat.status === 'today' && { color: colors.primary, fontWeight: '700' },
                            ]}
                          >
                            {cat.dateText}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.hangoutFooter}>
                        {(() => {
                          const pCount = h.participantsCount ?? h.participantCount ?? 0;
                          const rawMax = h.maxParticipants ?? h.max_participants;
                          const hasLimit = typeof rawMax === 'number' && rawMax > 0;
                          return (
                            <Text style={styles.hangoutSpotsText} numberOfLines={1}>
                              {h.spotsText || (hasLimit ? `${pCount}/${rawMax} spots` : `${pCount} going`)}
                            </Text>
                          );
                        })()}
                        <TouchableOpacity
                          style={styles.savedCardUnsaveIcon}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleUnsaveHangout(h.id);
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons name="bookmark" size={18} color={colors.primaryContainer} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            </View>
          </View>

          {/* Page 2: Hangouts */}
          <View style={{ width: screenWidth, paddingHorizontal: Spacing.md }}>
            <View style={styles.tabContentArea}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Hosted by You</Text>
            </View>

            {myHangouts.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="groups" size={36} color={colors.tertiary} />
                <Text style={styles.emptyTitle}>No Hangouts Hosted</Text>
                <Text style={styles.emptyDesc}>
                  Host a spontaneous hangout, study session, or coffee meetup!
                </Text>
              </View>
            ) : (
              <View style={styles.savedHangoutsGrid}>
                {myHangouts.map((h) => {
                  const cat = categorizeItemByDate(h);
                  const isOpen =
                    h.joinType === 'OPEN' ||
                    h.join_type === 'OPEN' ||
                    h.joinType === 'open' ||
                    h.join_type === 'open';
                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.savedHangoutCard, cat.isPassed && styles.itemCardPassed]}
                      onPress={() => {
                        router.push(`/hangout/${h.id}`);
                      }}
                      activeOpacity={cat.isPassed ? 0.38 : 0.85}
                    >
                      <View>
                        <View style={styles.hangoutHeader}>
                          <View style={styles.hangoutCreatorRow}>
                            {h.creatorAvatar || h.creator?.profile_picture_url ? (
                              <Image
                                source={{
                                  uri: h.creatorAvatar || h.creator?.profile_picture_url,
                                }}
                                style={styles.hangoutCreatorAvatar}
                              />
                            ) : (
                              <View style={styles.hangoutAvatarFallback}>
                                <MaterialIcons name="person" size={15} color={colors.tertiary} />
                              </View>
                            )}
                            <Text style={styles.hangoutCreatorName} numberOfLines={1}>
                              {h.creatorName || h.creator?.first_name || 'Host'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.hangoutPill,
                              isOpen ? styles.hangoutPillOpen : styles.hangoutPillRequest,
                            ]}
                          >
                            {isOpen && <View style={styles.openDot} />}
                            <Text
                              style={[
                                styles.hangoutPillText,
                                isOpen ? styles.hangoutPillOpenText : styles.hangoutPillRequestText,
                              ]}
                            >
                              {isOpen ? 'Open' : 'Request'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.hangoutTitle} numberOfLines={2}>
                          {h.title}
                        </Text>

                        <View style={styles.hangoutScheduleRow}>
                          <MaterialIcons
                            name="schedule"
                            size={13}
                            color={cat.status === 'today' ? colors.primary : colors.onSurfaceVariant}
                          />
                          <Text
                            style={[
                              styles.hangoutScheduleText,
                              cat.status === 'today' && { color: colors.primary, fontWeight: '700' },
                            ]}
                          >
                            {cat.dateText}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.hangoutFooter}>
                        {(() => {
                          const pCount = h.participantsCount ?? h.participantCount ?? 0;
                          const rawMax = h.maxParticipants ?? h.max_participants;
                          const hasLimit = typeof rawMax === 'number' && rawMax > 0;
                          return (
                            <Text style={styles.hangoutSpotsText}>
                              {h.spotsText || (hasLimit ? `${pCount}/${rawMax} spots` : `${pCount} going`)}
                            </Text>
                          );
                        })()}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            </View>
          </View>

          {/* Page 3: Events */}
          <View style={{ width: screenWidth, paddingHorizontal: Spacing.md }}>
            <View style={styles.tabContentArea}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Organized by You</Text>
            </View>

            {myEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="event" size={36} color={colors.tertiary} />
                <Text style={styles.emptyTitle}>No Events Organized</Text>
                <Text style={styles.emptyDesc}>
                  Propose or host workshops, meetups, and community gatherings.
                </Text>
              </View>
            ) : (
              myEvents.map((ev) => {
                const cat = categorizeItemByDate(ev);
                const categoryBadge = ev.category || ev.community?.category || 'Community';
                const commName = ev.communityName || ev.community?.name || 'Nexus Community';

                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[styles.savedEventCardFull, cat.isPassed && styles.itemCardPassed]}
                    onPress={() => {
                      router.push({
                        pathname: '/event/[id]',
                        params: { id: ev.id, slug: ev.communitySlug || ev.community?.slug },
                      } as any);
                    }}
                    activeOpacity={cat.isPassed ? 0.38 : 0.85}
                  >
                    <View style={styles.savedEventCoverWrapper}>
                      <Image
                        source={{
                          uri:
                            ev.cover_image_url ||
                            ev.coverImageUrl ||
                            'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600',
                        }}
                        style={styles.savedEventCover}
                      />
                      <View style={styles.eventCategoryBadge}>
                        <Text style={styles.eventCategoryBadgeText} numberOfLines={1}>
                          {formatCategoryName(categoryBadge, true)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.eventBody}>
                      <View>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={styles.eventCommunityNameText} numberOfLines={1}>
                          {commName}
                        </Text>
                      </View>
                      <View style={styles.eventMetaRow}>
                        <View style={styles.metaItem}>
                          <MaterialIcons
                            name="calendar-today"
                            size={13}
                            color={cat.isPassed ? colors.tertiary : colors.primary}
                          />
                          <Text
                            style={[
                              styles.metaText,
                              cat.status === 'today' && { color: colors.primary, fontWeight: '700' },
                            ]}
                          >
                            {cat.dateText}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <MaterialIcons name="group" size={13} color={colors.secondary} />
                          <Text style={styles.metaTextSec}>
                            {`${ev.participantsCount ?? ev.participantCount ?? 0} ${cat.isPassed ? 'went' : 'going'}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            </View>
          </View>
        </Animated.ScrollView>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={Boolean(editModal?.visible)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {editModal?.type === 'post' ? 'Post' : editModal?.type === 'comment' ? 'Comment' : editModal?.type === 'hangout' ? 'Hangout' : 'Event'}
              </Text>
              <TouchableOpacity onPress={() => setEditModal(null)}>
                <MaterialIcons name="close" size={22} color={colors.tertiary} />
              </TouchableOpacity>
            </View>

            {editModal?.type !== 'comment' && (
              <TextInput
                style={styles.modalInput}
                placeholder="Title"
                placeholderTextColor={colors.tertiary}
                value={editModal?.title}
                onChangeText={(text) =>
                  setEditModal((prev) => (prev ? { ...prev, title: text } : null))
                }
              />
            )}

            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder={editModal?.type === 'comment' ? 'Your comment...' : 'Description / content...'}
              placeholderTextColor={colors.tertiary}
              value={editModal?.content}
              onChangeText={(text) =>
                setEditModal((prev) => (prev ? { ...prev, content: text } : null))
              }
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingEdit && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                <Text style={styles.modalSaveText}>
                  {savingEdit ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  slidingHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: colors.surface,
    zIndex: 9998,
    borderBottomWidth: 0,
  },
  slidingHeaderInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  headerPressableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSpacer: {
    width: 36,
    height: 36,
  },
  headerCenterTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerUserNameText: {
    ...Typography.headlineSm,
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },

  // Profile Header — Pushed higher up
  profileHeader: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.surfaceContainerHigh,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  displayNameText: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
    marginTop: 2,
  },
  usernameText: {
    ...Typography.captionMd,
    color: colors.tertiary,
    marginTop: 1,
  },
  statsMatrix: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: colors.onSurface,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.captionSm,
    color: colors.tertiary,
    marginTop: 2,
  },
  bioText: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 300,
    lineHeight: 18,
  },
  addBioPrompt: {
    ...Typography.captionMd,
    color: colors.secondary,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  trustBadgeText: {
    ...Typography.captionSm,
    color: colors.secondary,
    fontWeight: '600',
  },

  // 4 Main Tabs with Animated Underline and Color Highlight
  tabsWrapper: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.surfaceContainerLow : '#F0ECE8',
    borderRadius: BorderRadius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
    height: 46,
  },
  animatedActivePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: BorderRadius.lg,
    backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
    ...Shadows.sm,
  },
  animatedIndicatorBar: {
    position: 'absolute',
    bottom: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primaryContainer,
    zIndex: 2,
  },
  tabIconBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: '100%',
    zIndex: 3,
  },
  tabLabel: {
    fontSize: 12,
    color: colors.tertiary,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: isDark ? '#feba48' : colors.primaryContainer,
    fontWeight: '700',
  },

  // Sub-tabs
  tabContentArea: {
    gap: 12,
  },
  subTabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  subTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surfaceContainerLow,
  },
  subTabBtnActive: {
    backgroundColor: colors.secondaryFixed,
  },
  subTabTxt: {
    ...Typography.captionMd,
    color: colors.tertiary,
    fontWeight: '500',
  },
  subTabTxtActive: {
    color: colors.onSecondaryFixed,
    fontWeight: '700',
  },

  // Cards
  itemCard: {
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  commBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  hangoutBadge: {
    backgroundColor: colors.secondaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  hangoutBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSecondaryFixed,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
  },
  unsaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surface,
  },
  unsaveText: {
    ...Typography.captionSm,
    color: colors.primaryContainer,
    fontWeight: '700',
  },
  itemTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  itemContent: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  commentMetaText: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  metaFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaFooterText: {
    ...Typography.captionSm,
    color: colors.tertiary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  createSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  createSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },

  // Empty state
  emptyCard: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyDesc: {
    ...Typography.captionMd,
    color: colors.tertiary,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    ...Typography.bodyMd,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalTextArea: {
    minHeight: 90,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  modalCancelText: {
    ...Typography.labelMd,
    color: colors.tertiary,
  },
  modalSaveBtn: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  modalSaveText: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },

  // Saved / Bookmarks Overhaul
  savedHangoutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  savedHangoutCard: {
    width: '48.5%',
    minHeight: 185,
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...Shadows.sm,
  },
  savedCardUnsaveIcon: {
    padding: 2,
  },
  savedEventCardFull: {
    width: '100%',
    backgroundColor: isDark ? colors.surfaceContainerLow : '#ffffff',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    ...Shadows.sm,
  },
  savedEventCoverWrapper: {
    height: 120,
    width: '100%',
    position: 'relative',
  },
  savedEventCover: {
    width: '100%',
    height: '100%',
  },
  eventCategoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(252, 249, 248, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  eventCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  eventUnsaveTopBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    padding: 6,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  eventBody: {
    padding: Spacing.sm,
    gap: 8,
  },
  eventTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  eventCommunityNameText: {
    ...Typography.captionSm,
    color: colors.tertiary,
    marginTop: 1,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.captionMd,
    color: colors.onSurfaceVariant,
  },
  metaTextSec: {
    ...Typography.captionMd,
    color: colors.secondary,
    fontWeight: '600',
  },

  hangoutPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hangoutPillOpen: {
    backgroundColor: colors.surface,
    ...Shadows.sm,
  },
  hangoutPillRequest: {
    backgroundColor: colors.secondaryFixed,
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  hangoutPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  hangoutPillOpenText: {
    color: colors.onSurface,
  },
  hangoutPillRequestText: {
    color: colors.secondary,
  },
  hangoutTitle: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  hangoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hangoutCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  hangoutCreatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  hangoutAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangoutCreatorName: {
    ...Typography.captionSm,
    color: colors.tertiary,
    fontWeight: '600',
    flex: 1,
  },
  hangoutScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  hangoutScheduleText: {
    ...Typography.captionSm,
    color: colors.onSurfaceVariant,
  },
  hangoutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  hangoutSpotsText: {
    ...Typography.captionSm,
    color: colors.tertiary,
    fontWeight: '600',
  },
  itemCardPassed: {
    opacity: 0.48,
  },

  // Discussion / Post card styles (exact match to home feed)
  discussionCard: {
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    ...Shadows.sm,
  },
  postCommunityHeader: {
    ...Typography.captionSm,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  authorAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '600',
  },
  postTagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '52%',
    maxHeight: 46,
    gap: 4,
    overflow: 'hidden',
  },
  postTagBadge: {
    backgroundColor: 'rgba(232, 167, 54, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  postTagBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  postTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  postContent: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginTop: 2,
  },
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  postActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  counterText: {
    ...Typography.captionMd,
    color: colors.tertiary,
  },
  iconOnly: {
    padding: 2,
  },
  postTimestampBelow: {
    fontSize: 11,
    color: colors.tertiary,
    marginTop: 2,
  },
  avatarFallback: {
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCommentCard: {
    backgroundColor: colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...Shadows.sm,
  },
  profileCommentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileCommentContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  profileCommentContextText: {
    ...Typography.captionSm,
    color: colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  profileCommentTime: {
    fontSize: 11,
    color: colors.tertiary,
  },
  profileCommentQuoteBox: {
    backgroundColor: colors.surface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  profileCommentBody: {
    ...Typography.bodyMd,
    color: colors.onSurface,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  profileCommentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  profileCommentTapHint: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
});
