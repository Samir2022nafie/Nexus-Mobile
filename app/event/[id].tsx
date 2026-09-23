/**
 * Event Detail Screen — Matches Stitch screen_19_event_detail_not_joined
 * Backend: GET /communities/:slug/events/:eventId, POST /communities/:slug/events/:eventId/join|leave|save
 * Features:
 * - Cover hero with navigation & location chip
 * - Title, organizer, community badge
 * - 3 info matrix cards (Date/Time, Location, Attendees avatar stack)
 * - Public/Community status badge with green beacon
 * - Editorial description from backend
 * - Fixed bottom action bar: "Join Event" / "Joined" + Bookmark button
 * - Fixes: eliminates mock fallback data and Android elevation/white rectangular outline artifacts.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { useAuth } from '../../src/context/AuthContext';
import { eventsService } from '../../src/services/events';
import { communitiesService } from '../../src/services/communities';
import { formatCategoryName } from '../../src/utils/categories';

export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);
  const { user } = useAuth();
  const { id, slug } = useLocalSearchParams<{ id: string; slug?: string }>();

  const [event, setEvent] = useState<any>(null);
  const [communitySlug, setCommunitySlug] = useState<string>(slug || '');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(0);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      let targetSlug = communitySlug;

      // If slug was not provided in route params, look up the community
      if (!targetSlug) {
        const comms = await communitiesService.list({ limit: 20 }).catch(() => []);
        for (const c of comms) {
          const ev = await eventsService.getById(c.slug, id).catch(() => null);
          if (ev) {
            targetSlug = c.slug;
            setCommunitySlug(c.slug);
            setEvent(ev);
            setIsJoined(ev.isParticipant || false);
            setIsBookmarked(ev.isSaved || false);
            setParticipantsCount((ev as any).participants?.length ?? (ev.participantsCount || 0));
            return;
          }
        }
      }

      if (targetSlug) {
        const [data, comm] = await Promise.all([
          eventsService.getById(targetSlug, id).catch(() => null),
          communitiesService.getBySlug(targetSlug).catch(() => null),
        ]);
        if (data) {
          const merged = {
            ...comm,
            ...data,
            community: {
              ...(comm || {}),
              ...((data as any)?.community || {}),
              category: ((data as any)?.community?.category || comm?.category),
            },
          };
          setEvent(merged);
          setIsJoined(merged.isParticipant || false);
          setIsBookmarked(merged.isSaved || false);
          setParticipantsCount((merged as any).participants?.length ?? (merged.participantsCount || 0));
        } else {
          setEvent(null);
        }
      } else {
        setEvent(null);
      }
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id, communitySlug]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const isEventOrganizer = Boolean(
    user?.id &&
    (event?.creator_id === user.id ||
      event?.creatorId === user.id ||
      event?.creator?.id === user.id ||
      event?.organizer_id === user.id ||
      event?.organizerId === user.id ||
      event?.organizer?.id === user.id ||
      event?.author_id === user.id ||
      event?.authorId === user.id ||
      event?.author?.id === user.id)
  );

  const handleDeleteEvent = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await eventsService.delete(communitySlug, event.id);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete event.');
            }
          },
        },
      ]
    );
  };

  const handleToggleJoin = async () => {
    if (!event || !communitySlug) return;
    setActionLoading(true);
    const nextJoined = !isJoined;
    setIsJoined(nextJoined);
    setParticipantsCount((prev) => (nextJoined ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (!isJoined) {
        await eventsService.join(communitySlug, event.id).catch(() => {});
      } else {
        await eventsService.leave(communitySlug, event.id).catch(() => {});
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleToggleBookmark = async () => {
    setIsBookmarked(!isBookmarked);
    if (!event || !communitySlug) return;
    try {
      await eventsService.toggleSave(communitySlug, event.id).catch(() => {});
    } catch {}
  };

  if (loading) return <LoadingSpinner fullScreen />;

  if (!event) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingHorizontal: Spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <View style={styles.notFoundIconBox}>
          <MaterialIcons name="event-busy" size={40} color={colors.tertiary} />
        </View>
        <Text style={styles.notFoundTitle}>Event not found</Text>
        <Text style={styles.notFoundSub}>
          This event may have ended or does not exist in the database.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <MaterialIcons name="arrow-back" size={18} color={colors.onPrimaryContainer} />
          <Text style={styles.backButtonText}>Back to Events</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format real event dates from database (supporting both startsAt and starts_at)
  const rawStarts = event.startsAt || event.starts_at;
  const rawEnds = event.endsAt || event.ends_at;
  const startDate = rawStarts ? new Date(rawStarts) : null;
  const endDate = rawEnds ? new Date(rawEnds) : null;
  const now = new Date();
  const isToday =
    startDate &&
    startDate.getFullYear() === now.getFullYear() &&
    startDate.getMonth() === now.getMonth() &&
    startDate.getDate() === now.getDate();
  const isOngoing = startDate && startDate <= now && Boolean(endDate && endDate > now);
  const cutoff = endDate || (startDate ? new Date(startDate.getTime() + 3 * 3600 * 1000) : null);
  const isPassed = !isToday && !isOngoing && Boolean(cutoff && cutoff < now);

  const isSameDay =
    startDate &&
    endDate &&
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  const dateText = startDate
    ? isSameDay || !endDate
      ? startDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : `${startDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })} – ${endDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`
    : 'Date to be announced';

  const timeText = startDate
    ? endDate
      ? isSameDay
        ? `${startDate.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })} – ${endDate.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : `Starts ${startDate.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })} · Ends ${endDate.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}`
      : startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : 'Time to be announced';

  const locationName =
    event.location?.name ||
    event.location?.place_name ||
    event.location?.address ||
    (typeof event.location === 'string' ? event.location : '') ||
    (event.is_online ? 'Online Event' : 'Location to be announced');
  const locationDistrict =
    event.location?.city ||
    (event.location?.place_name ? event.location.place_name.split(',')[0] : '') ||
    event.community?.name ||
    'Community Event';

  const rawMax = event.max_participants || event.maxParticipants;
  const hasLimit = typeof rawMax === 'number' && rawMax > 0;
  const maxSpots = hasLimit ? rawMax : null;
  const isPublic = event.visibility !== 'community' && event.visibility !== 'subcommunity';
  const rawCategory =
    event.community?.category?.name ||
    event.community?.category ||
    (event as any).communityCategory ||
    (event as any).category ||
    'Community';
  const categoryLabel = formatCategoryName(rawCategory, true) || 'Community';

  const participantsList = (event.participants || []).filter(
    (p: any) => !p.status || p.status === 'approved' || p.status === 'active'
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 84 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Hero Banner */}
        <View style={styles.heroContainer}>
          <Image
            source={{
              uri:
                event.cover_image_url ||
                event.coverImageUrl ||
                'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
            }}
            style={styles.heroImage}
          />

          {/* Quick Nav Actions: Back Button & Author Controls */}
          <View style={[styles.heroNavRow, { top: insets.top + Spacing.xs }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.heroCircleBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>

            {isEventOrganizer && (
              <View style={styles.authorActionsRow}>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/new-event',
                      params: { eventId: event.id, slug: communitySlug },
                    } as any)
                  }
                  style={styles.heroCircleBtn}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="edit" size={20} color={colors.white} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeleteEvent}
                  style={styles.heroCircleBtn}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="delete-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Banner Category Pill (Bottom Right) */}
          <View style={styles.categoryChipBadge}>
            <Text style={styles.categoryChipText}>{categoryLabel}</Text>
          </View>
        </View>

        {/* Event Body */}
        <View style={styles.body}>
          {/* 1. Title */}
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* 2. Community Name Prominently */}
          <TouchableOpacity
            style={styles.communityRowProminent}
            onPress={() => communitySlug && router.push(`/community/${communitySlug}`)}
            activeOpacity={0.8}
          >
            <View style={styles.commIconProminent}>
              <MaterialIcons name="groups" size={20} color={colors.primary} />
            </View>
            <Text style={styles.communityNameProminent} numberOfLines={1}>
              {event.community?.name || 'Nexus Community'}
            </Text>
          </TouchableOpacity>

          {/* 3. Description alone in white rounded rectangle card */}
          {event.description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          ) : null}

          {/* 4. 2 Info Matrix Cards (Date & Time, Location) */}
          <View style={styles.infoMatrix}>
            {/* Card 1: Date & Time */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="calendar-month" size={22} color={colors.primary} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText}>{dateText}</Text>
                <Text style={styles.cardSecondaryText}>{timeText}</Text>
              </View>
            </View>

            {/* Card 2: Location */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="location-on" size={22} color={colors.secondary} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText} numberOfLines={1}>
                  {locationName}
                </Text>
                <Text style={styles.cardSecondaryText} numberOfLines={1}>
                  {locationDistrict}
                </Text>
              </View>
            </View>
          </View>

          {/* 5. Participants in a Unique Container */}
          <View style={styles.participantsUniqueBox}>
            <View style={styles.participantsHeaderRow}>
              <View style={styles.participantsTitleGroup}>
                <View style={styles.participantsIconBox}>
                  <MaterialIcons name="groups" size={20} color={colors.primary} />
                </View>
                <Text style={styles.participantsMainTitle}>
                  {participantsCount} {isPassed ? 'went' : hasLimit ? `of ${maxSpots} going` : 'going'}
                </Text>
              </View>
              <View style={[styles.spotsLeftBadge, !hasLimit && styles.noLimitBadge]}>
                <Text style={[styles.spotsLeftText, !hasLimit && styles.noLimitText]}>
                  {hasLimit ? `${Math.max(0, (maxSpots || 0) - participantsCount)} spots left` : 'No limit'}
                </Text>
              </View>
            </View>

            {participantsList.length > 0 ? (
              <View style={styles.participantAvatarsGrid}>
                {participantsList.map((p: any, idx: number) => {
                  const avatarUrl = p.profile_picture_url || p.user?.profile_picture_url;
                  const pName = p.user?.first_name || p.first_name || p.name || 'Member';
                  return (
                    <View key={p.id || idx} style={styles.participantItem}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.participantAvatarImg} />
                      ) : (
                        <View style={styles.participantAvatarFallback}>
                          <MaterialIcons name="person" size={16} color={colors.tertiary} />
                        </View>
                      )}
                      <Text style={styles.participantNameText} numberOfLines={1}>
                        {pName}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyParticipantsText}>Be the first to join this event!</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Tray */}
      <View style={[styles.bottomTray, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity
          style={[
            styles.joinButton,
            isPassed
              ? styles.btnPassedState
              : isJoined
              ? styles.btnJoinedState
              : styles.btnNotJoinedState,
          ]}
          onPress={handleToggleJoin}
          disabled={actionLoading || isPassed}
          activeOpacity={0.85}
        >
          {isPassed ? (
            isJoined ? (
              <>
                <MaterialIcons name="check-circle" size={20} color={colors.tertiary} />
                <Text style={[styles.joinButtonText, { color: colors.tertiary }]}>Attended</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="event-busy" size={20} color={colors.outline} />
                <Text style={[styles.joinButtonText, { color: colors.outline }]}>Event Ended</Text>
              </>
            )
          ) : (
            <>
              <MaterialIcons
                name={isJoined ? 'check-circle' : 'how-to-reg'}
                size={20}
                color={isJoined ? colors.onSurface : colors.onPrimaryContainer}
              />
              <Text
                style={[
                  styles.joinButtonText,
                  isJoined ? styles.textJoinedState : styles.textNotJoinedState,
                ]}
              >
                {isJoined ? 'Joined' : 'Join Event'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={handleToggleBookmark}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={isBookmarked ? 'bookmark' : 'bookmark-border'}
            size={24}
            color={isBookmarked ? colors.primaryContainer : colors.tertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
  },
  content: {},
  notFoundIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  notFoundTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  notFoundSub: {
    ...Typography.bodyMd,
    color: colors.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  heroContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    backgroundColor: colors.surfaceContainerHighest,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradientTop: {
    ...StyleSheet.absoluteFill as any,
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: isDark ? 'rgba(21, 19, 18, 0.6)' : 'rgba(252, 249, 248, 0.4)',
  },
  heroNavRow: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  authorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipBadge: {
    position: 'absolute',
    bottom: 12,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 27, 27, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainerHigh,
    ...Typography.bodyMd,
    color: colors.onSurface,
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainerHigh,
    ...Typography.bodyMd,
    color: colors.onSurface,
    height: 100,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  modalCancelText: {
    ...Typography.labelMd,
    color: colors.secondary,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.primaryContainer,
  },
  modalSubmitText: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  body: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  eventTitle: {
    ...Typography.headlineMd,
    color: colors.onSurface,
    fontWeight: '700',
    lineHeight: 30,
  },
  communityRowProminent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  commIconProminent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232, 167, 54, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityNameProminent: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  descriptionCard: {
    backgroundColor: colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  descriptionText: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
  infoMatrix: {
    gap: 8,
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardTextCol: {
    flex: 1,
  },
  cardPrimaryText: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  cardSecondaryText: {
    ...Typography.captionMd,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  participantsUniqueBox: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 167, 54, 0.35)',
    gap: 12,
    marginTop: 4,
  },
  participantsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantsIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232, 167, 54, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantsMainTitle: {
    ...Typography.labelMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  spotsLeftBadge: {
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  spotsLeftText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimaryFixedVariant,
  },
  noLimitBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  noLimitText: {
    color: '#059669',
  },
  participantAvatarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  participantItem: {
    alignItems: 'center',
    width: 52,
    gap: 4,
  },
  participantAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  participantAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantNameText: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyParticipantsText: {
    ...Typography.bodyMd,
    color: colors.tertiary,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  bottomTray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(21, 19, 18, 0.96)' : 'rgba(252, 249, 248, 0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  joinButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnNotJoinedState: {
    backgroundColor: colors.primaryContainer,
  },
  btnJoinedState: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  joinButtonText: {
    ...Typography.labelLg,
    fontWeight: '700',
  },
  textNotJoinedState: {
    color: colors.onPrimaryContainer,
  },
  textJoinedState: {
    color: colors.onSurface,
  },
  btnPassedState: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  bookmarkButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
