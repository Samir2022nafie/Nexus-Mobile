/**
 * Explore Screen — Matches Stitch screen_9, screen_10, screen_11
 * Sub-tabs: Communities | Events | Hangouts
 * Features:
 * - AppHeader (/ Explore)
 * - Sub-tab selector with active gold indicator
 * - Tactile search bar with magnifying glass
 * - Horizontal category chips (All, Outdoor, Sports, Art, Tech, Music, Food)
 * - 3 distinct feed designs for Communities, Events, and Hangouts
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { communitiesService } from '../../src/services/communities';
import { hangoutsService } from '../../src/services/hangouts';
import { eventsService } from '../../src/services/events';
import { Community, HangoutItem } from '../../src/types';
import { BACKEND_CATEGORIES, formatCategoryName } from '../../src/utils/categories';

const SUB_TABS = ['Communities', 'Events', 'Hangouts'] as const;
type SubTab = typeof SUB_TABS[number];

const CATEGORIES = ['All', ...BACKEND_CATEGORIES.map((c) => c.label)];

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<SubTab>(
    params.tab === 'events' ? 'Events' : params.tab === 'hangouts' ? 'Hangouts' : 'Communities'
  );
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [communities, setCommunities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [hangouts, setHangouts] = useState<any[]>([]);
  const [savedEvents, setSavedEvents] = useState<Record<string, boolean>>({});
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.tab === 'events') setActiveTab('Events');
    else if (params.tab === 'hangouts') setActiveTab('Hangouts');
  }, [params.tab]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [commData, hangData] = await Promise.all([
        communitiesService.list({ q: search || undefined, limit: 30 }).catch(() => []),
        hangoutsService.list({ limit: 30 }).catch(() => []),
      ]);

      const realComms = commData || [];
      const realHangs = hangData || [];
      setCommunities(realComms);
      setHangouts(realHangs);

      if (realComms.length > 0) {
        try {
          const evPromises = realComms.slice(0, 5).map((c) =>
            eventsService.listByCommunity(c.slug, { limit: 10 }).catch(() => [])
          );
          const evResults = await Promise.all(evPromises);
          setEvents(evResults.flat());
        } catch {
          setEvents([]);
        }
      } else {
        setEvents([]);
      }
    } catch {
      setCommunities([]);
      setEvents([]);
      setHangouts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleCommunityJoin = (commId: string) => {
    setJoinedCommunities((prev) => ({ ...prev, [commId]: !prev[commId] }));
  };

  const toggleEventSave = (eventId: string) => {
    setSavedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  // Filter items by category
  const filteredCommunities = communities.filter((comm) => {
    if (selectedCategory === 'All') return true;
    const shortCat = formatCategoryName(comm.category, true);
    return shortCat.toLowerCase() === selectedCategory.toLowerCase();
  });

  const filteredEvents = events.filter((ev) => {
    if (selectedCategory === 'All') return true;
    const cat = ev.community?.category || ev.category;
    const shortCat = formatCategoryName(cat, true);
    return shortCat.toLowerCase() === selectedCategory.toLowerCase();
  });

  const filteredHangouts = hangouts.filter((h) => {
    if (selectedCategory === 'All') return true;
    if (!h.community?.category) return true;
    const shortCat = formatCategoryName(h.community.category, true);
    return shortCat.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <View style={styles.screen}>
      <AppHeader breadcrumb="Explore" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Sub-tab Navigation Row */}
        <View style={styles.subTabRow}>
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={styles.subTabButton}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                  {tab}
                </Text>
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={Colors.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            placeholderTextColor={Colors.tertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={fetchData}
            underlineColorAndroid="transparent"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={Colors.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isCatActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isCatActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isCatActive && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <LoadingSpinner message="Discovering..." />
        ) : activeTab === 'Communities' ? (
          /* Communities Feed */
          <View style={styles.cardsFeed}>
            {filteredCommunities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="groups" size={48} color={Colors.tertiary} />
                <Text style={styles.emptyTitle}>No communities found</Text>
                <Text style={styles.emptySubtitle}>
                  {selectedCategory !== 'All'
                    ? `No communities created under "${selectedCategory}" yet.`
                    : 'No communities found in the database.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/new-community')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyActionBtnText}>Create Community</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredCommunities.map((comm) => {
                const isJoined = joinedCommunities[comm.id] || comm.isMember;
                const catDisplay = formatCategoryName(comm.category, true);
                return (
                  <TouchableOpacity
                    key={comm.id}
                    style={styles.communityCard}
                    onPress={() => router.push(`/community/${comm.slug}`)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.commTopRow}>
                      <View style={styles.commMetaGroup}>
                        <Image
                          source={{
                            uri:
                              comm.profile_picture_url ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
                          }}
                          style={styles.commAvatar}
                        />
                        <View style={styles.commTextGroup}>
                          <Text style={styles.commName} numberOfLines={1}>
                            {comm.name}
                          </Text>
                          <View style={styles.commBadgeRow}>
                            <View style={styles.commCategoryPill}>
                              <Text style={styles.commCategoryText} numberOfLines={1}>
                                {catDisplay}
                              </Text>
                            </View>
                            <Text style={styles.commMemberCount}>
                              {comm.memberCount || 0} members
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Joined / Join Button */}
                      <TouchableOpacity
                        style={[styles.joinToggleBtn, isJoined ? styles.btnJoined : styles.btnNotJoined]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          toggleCommunityJoin(comm.id);
                        }}
                        activeOpacity={0.7}
                      >
                        {isJoined && (
                          <MaterialIcons
                            name="check-circle"
                            size={15}
                            color={Colors.primaryContainer}
                          />
                        )}
                        <Text
                          style={[
                            styles.joinToggleText,
                            isJoined ? styles.btnJoinedText : styles.btnNotJoinedText,
                          ]}
                        >
                          {isJoined ? 'Joined' : 'Join'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.commDescription} numberOfLines={2}>
                      {comm.description || 'Welcome to this community! Join to engage in discussions.'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : activeTab === 'Events' ? (
          /* Events Feed */
          <View style={styles.cardsFeed}>
            {filteredEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="event" size={48} color={Colors.tertiary} />
                <Text style={styles.emptyTitle}>No events scheduled</Text>
                <Text style={styles.emptySubtitle}>
                  {selectedCategory !== 'All'
                    ? `No events scheduled under "${selectedCategory}".`
                    : 'No upcoming events found in the database.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/new-event')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyActionBtnText}>Plan an Event</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredEvents.map((event) => {
                const isSaved = savedEvents[event.id] || event.isSaved;
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id, slug: event.community?.slug || event.communitySlug } } as any)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.eventCoverWrapper}>
                      <Image
                        source={{
                          uri:
                            event.cover_image_url ||
                            event.coverImageUrl ||
                            'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600',
                        }}
                        style={styles.eventCover}
                      />
                      <View style={styles.eventAccessBadge}>
                        <View
                          style={[
                            styles.accessDot,
                            { backgroundColor: event.isPublic !== false ? Colors.success : Colors.secondary },
                          ]}
                        />
                        <Text
                          style={[
                            styles.accessText,
                            { color: event.isPublic !== false ? Colors.success : Colors.secondary },
                          ]}
                        >
                          {event.isPublic !== false ? 'Public' : 'Community'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.eventContent}>
                      <View style={styles.eventCommunityRow}>
                        <View style={styles.commMiniIcon}>
                          <Text style={styles.commMiniIconText}>
                            {(event.community?.name || event.communityName || 'N')[0]}
                          </Text>
                        </View>
                        <Text style={styles.eventCommunityName}>
                          {event.community?.name || event.communityName || 'Nexus Community'}
                        </Text>
                      </View>

                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventDateTime}>{event.dateText || (event.starts_at ? new Date(event.starts_at).toLocaleDateString() : 'Upcoming')}</Text>

                      {(event.location?.place_name || event.location) && (
                        <View style={styles.locationRow}>
                          <MaterialIcons name="location-on" size={16} color={Colors.secondary} />
                          <Text style={styles.locationText} numberOfLines={1}>
                            {event.location?.place_name || event.location}
                          </Text>
                        </View>
                      )}

                      <View style={styles.eventBottomRow}>
                        <View style={styles.goingRow}>
                          <MaterialIcons name="group" size={18} color={Colors.onSurfaceVariant} />
                          <Text style={styles.goingText}>{event.participantsCount ? `${event.participantsCount} going` : 'Upcoming'}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.bookmarkBtn}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            toggleEventSave(event.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name={isSaved ? 'bookmark' : 'bookmark-border'}
                            size={22}
                            color={isSaved ? Colors.primaryContainer : Colors.tertiary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          /* Hangouts Feed */
          <View style={styles.cardsFeed}>
            <View style={styles.hangoutStatusBanner}>
              <View style={styles.beaconRow}>
                <View style={styles.pingDot} />
                <Text style={styles.beaconTitle}>
                  {filteredHangouts.length} {filteredHangouts.length === 1 ? 'Hangout' : 'Hangouts'} Near You
                </Text>
              </View>
            </View>

            {filteredHangouts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="explore" size={48} color={Colors.tertiary} />
                <Text style={styles.emptyTitle}>No hangouts active right now</Text>
                <Text style={styles.emptySubtitle}>
                  {selectedCategory !== 'All'
                    ? `No hangouts active in the "${selectedCategory}" category.`
                    : 'Be the first to host a hangout in your area!'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/new-hangout')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyActionBtnText}>Host a Hangout</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredHangouts.map((h) => {
                const isOpen = h.isOpen ?? (h.joinType === 'OPEN' || h.join_type === 'OPEN' || h.joinType === 'open' || h.join_type === 'open');
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={styles.hangoutFeedCard}
                    onPress={() => router.push(`/hangout/${h.id}`)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.hangoutTopRow}>
                      <View style={styles.hangoutHostInfo}>
                        <Image
                          source={{
                            uri:
                              h.creatorAvatar ||
                              h.creator?.profile_picture_url ||
                              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
                          }}
                          style={styles.hostAvatar}
                        />
                        <View>
                          <Text style={styles.hostName}>
                            {h.creatorName || h.creator?.first_name || 'Host'}
                          </Text>
                          <Text style={styles.hostSub}>created this</Text>
                        </View>
                      </View>
                      <View style={styles.distanceBadge}>
                        <MaterialIcons name="near-me" size={14} color={Colors.tertiary} />
                        <Text style={styles.distanceText}>{h.distanceText || (h.location?.place_name ? h.location.place_name.slice(0, 15) : 'Nearby')}</Text>
                      </View>
                    </View>

                    <Text style={styles.hangoutFeedTitle}>{h.title}</Text>
                    <Text style={styles.hangoutFeedDesc} numberOfLines={2}>
                      {h.description || "Let's hang out and connect!"}
                    </Text>

                    <View style={styles.hangoutScheduleTag}>
                      <MaterialIcons name="schedule" size={14} color={Colors.tertiary} />
                      <Text style={styles.hangoutScheduleText}>{h.timeText || (h.starts_at ? new Date(h.starts_at).toLocaleDateString() : 'Today')}</Text>
                    </View>

                    <View style={styles.hangoutFooterRow}>
                      <Text style={styles.hangoutSpotsText}>
                        {h.spotsText || `${h.participantsCount || 1}/${h.maxParticipants || 10} spots`}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.hangoutJoinBtn,
                          isOpen ? styles.hangoutBtnGold : styles.hangoutBtnBlue,
                        ]}
                        onPress={() => router.push(`/hangout/${h.id}`)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.hangoutJoinBtnText,
                            isOpen ? styles.hangoutTextGold : styles.hangoutTextBlue,
                          ]}
                        >
                          {isOpen ? 'Join' : 'Request'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  subTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0ECE8',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  subTabText: {
    ...Typography.labelMd,
    color: Colors.tertiary,
  },
  subTabTextActive: {
    color: Colors.primaryContainer,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primaryContainer,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tertiaryFixed,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: Spacing.sm,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  categoryChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  categoryChipActive: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primaryContainer,
  },
  categoryChipText: {
    ...Typography.captionMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  cardsFeed: {
    paddingHorizontal: Spacing.md,
    gap: 12,
    marginTop: 6,
  },

  // Communities
  communityCard: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  commTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    backgroundColor: Colors.surfaceContainerHigh,
  },
  commTextGroup: {
    flex: 1,
  },
  commName: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  commBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  commCategoryPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  commCategoryText: {
    ...Typography.captionSm,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  commMemberCount: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  joinToggleBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnJoined: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  btnNotJoined: {
    backgroundColor: Colors.primaryContainer,
  },
  joinToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnJoinedText: {
    color: Colors.primaryContainer,
  },
  btnNotJoinedText: {
    color: Colors.onPrimaryContainer,
  },
  commDescription: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },

  // Events
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  eventCoverWrapper: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  eventCover: {
    width: '100%',
    height: '100%',
  },
  eventAccessBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  accessDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accessText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventContent: {
    padding: 14,
  },
  eventCommunityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  commMiniIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.secondaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commMiniIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
  },
  eventCommunityName: {
    ...Typography.labelMd,
    color: Colors.secondary,
  },
  eventTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventDateTime: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    ...Typography.captionMd,
    color: Colors.secondary,
  },
  eventBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  goingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goingText: {
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  bookmarkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hangouts
  hangoutStatusBanner: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  beaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  beaconTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hangoutFeedCard: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  hangoutTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hangoutHostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  hostName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  hostSub: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  hangoutFeedTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  hangoutFeedDesc: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    lineHeight: 20,
  },
  hangoutScheduleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hangoutScheduleText: {
    ...Typography.captionSm,
    color: Colors.onSurfaceVariant,
  },
  hangoutFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  hangoutSpotsText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  hangoutJoinBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangoutBtnGold: {
    backgroundColor: Colors.primaryContainer,
  },
  hangoutBtnBlue: {
    backgroundColor: Colors.secondary,
  },
  hangoutJoinBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hangoutTextGold: {
    color: Colors.onPrimaryContainer,
  },
  hangoutTextBlue: {
    color: Colors.surface,
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
});
