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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { eventsService } from '../../src/services/events';
import { communitiesService } from '../../src/services/communities';

export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        const data = await eventsService.getById(targetSlug, id).catch(() => null);
        if (data) {
          setEvent(data);
          setIsJoined(data.isParticipant || false);
          setIsBookmarked(data.isSaved || false);
          setParticipantsCount((data as any).participants?.length ?? (data.participantsCount || 0));
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
          <MaterialIcons name="event-busy" size={40} color={Colors.tertiary} />
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
          <MaterialIcons name="arrow-back" size={18} color={Colors.onPrimaryContainer} />
          <Text style={styles.backButtonText}>Back to Events</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format real event dates from database
  const startDate = event.starts_at ? new Date(event.starts_at) : null;
  const endDate = event.ends_at ? new Date(event.ends_at) : null;
  const dateText = startDate
    ? startDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Upcoming Event';
  const timeText = startDate
    ? `${startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${
        endDate
          ? ` – ${endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
          : ''
      }`
    : 'Time TBA';

  const locationName =
    event.location?.place_name ||
    (typeof event.location === 'string' ? event.location : 'Location to be announced');
  const locationDistrict =
    event.community?.name ||
    (event.location?.place_name ? event.location.place_name.split(',')[0] : 'Community Event');

  const maxSpots = event.max_participants || event.maxParticipants || 50;
  const isPublic = event.visibility !== 'community' && event.visibility !== 'subcommunity';
  const participantsList = event.participants || [];

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
          <View style={styles.heroGradientTop} />
          <View style={styles.heroGradientBottom} />

          {/* Quick Nav Actions */}
          <View style={[styles.heroNavRow, { top: insets.top + Spacing.xs }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.heroCircleBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroCircleBtn} activeOpacity={0.8}>
              <MaterialIcons name="more-horiz" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>

          {/* Location Chip Pill */}
          <View style={styles.locationChipBadge}>
            <MaterialIcons name="terrain" size={14} color={Colors.primaryContainer} />
            <Text style={styles.locationChipText}>{locationDistrict}</Text>
          </View>
        </View>

        {/* Event Body */}
        <View style={styles.body}>
          {/* Title & Affiliation */}
          <Text style={styles.eventTitle}>{event.title}</Text>

          <View style={styles.organizerRow}>
            <View style={styles.organizerGroup}>
              <View style={styles.hikingIcon}>
                <MaterialIcons name="person" size={18} color={Colors.onPrimaryFixed} />
              </View>
              <View>
                <Text style={styles.orgLabel}>Organized by</Text>
                <Text style={styles.orgName}>
                  @{event.creator?.username || event.organizer || 'organizer'}
                </Text>
              </View>
            </View>

            {event.community?.name && (
              <>
                <View style={styles.dotSeparator} />
                <TouchableOpacity
                  style={styles.communityBadge}
                  onPress={() => router.push(`/community/${communitySlug}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.commIconSmall}>
                    <MaterialIcons name="groups" size={14} color={Colors.secondary} />
                  </View>
                  <Text style={styles.commNameText} numberOfLines={1}>
                    {event.community.name}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 3 Info Matrix Cards — free of white rectangular outline artifacts */}
          <View style={styles.infoMatrix}>
            {/* Card 1: Date & Time */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="calendar-month" size={22} color={Colors.primary} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText}>{dateText}</Text>
                <Text style={styles.cardSecondaryText}>{timeText}</Text>
              </View>
            </View>

            {/* Card 2: Location */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="location-on" size={22} color={Colors.secondary} />
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

            {/* Card 3: Attendees stack */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="group" size={22} color={Colors.onSurface} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText}>
                  {participantsCount} {event.max_participants ? `of ${event.max_participants}` : ''} going
                </Text>
                {participantsList.length > 0 ? (
                  <View style={styles.avatarStackRow}>
                    {participantsList.slice(0, 4).map((p: any, idx: number) => {
                      const initials = `${(p.user?.first_name || p.first_name || 'U')[0]}${
                        (p.user?.last_name || p.last_name || '')[0] || ''
                      }`;
                      const bgColors = [
                        Colors.primaryContainer,
                        Colors.secondary,
                        Colors.tertiary,
                        Colors.secondaryContainer,
                      ];
                      return (
                        <View
                          key={p.id || idx}
                          style={[styles.stackAvatar, { backgroundColor: bgColors[idx % 4] }]}
                        >
                          <Text style={styles.stackAvatarText}>{initials}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.cardSecondaryText}>Be the first to join!</Text>
                )}
              </View>
            </View>
          </View>

          {/* Badges: Public / Community Access */}
          <View style={styles.badgesRow}>
            <View style={styles.publicBadge}>
              <View style={styles.beaconDot} />
              <Text style={styles.publicBadgeText}>
                {isPublic ? 'Public Event' : 'Community Members Only'}
              </Text>
            </View>
            {event.is_verified && (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={14} color={Colors.primaryContainer} />
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            )}
          </View>

          {/* About the Event */}
          <View style={styles.aboutSection}>
            <Text style={styles.sectionHeading}>About this Event</Text>
            <Text style={styles.bodyParagraph}>
              {event.description || 'No description provided for this event.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Tray */}
      <View style={[styles.bottomTray, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity
          style={[
            styles.joinButton,
            isJoined ? styles.btnJoinedState : styles.btnNotJoinedState,
          ]}
          onPress={handleToggleJoin}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          <MaterialIcons
            name={isJoined ? 'check-circle' : 'how-to-reg'}
            size={20}
            color={isJoined ? Colors.onSurface : Colors.onPrimaryContainer}
          />
          <Text
            style={[
              styles.joinButtonText,
              isJoined ? styles.textJoinedState : styles.textNotJoinedState,
            ]}
          >
            {isJoined ? 'Joined' : 'Join Event'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={handleToggleBookmark}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={isBookmarked ? 'bookmark' : 'bookmark-border'}
            size={24}
            color={isBookmarked ? Colors.primaryContainer : Colors.tertiary}
          />
        </TouchableOpacity>
      </View>
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
  content: {},
  notFoundIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  notFoundTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  notFoundSub: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  heroContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    backgroundColor: Colors.surfaceContainerHighest,
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
    backgroundColor: 'rgba(252, 249, 248, 0.4)',
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
  heroCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationChipBadge: {
    position: 'absolute',
    bottom: 12,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(28, 27, 27, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  locationChipText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '600',
  },
  body: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  eventTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    fontWeight: '700',
    lineHeight: 30,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  organizerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hikingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLabel: {
    fontSize: 11,
    color: Colors.tertiary,
  },
  orgName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.tertiary,
    marginHorizontal: 4,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 180,
  },
  commIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commNameText: {
    ...Typography.labelMd,
    color: Colors.secondary,
    fontWeight: '700',
  },
  infoMatrix: {
    gap: 8,
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tertiaryFixed,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardTextCol: {
    flex: 1,
  },
  cardPrimaryText: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  cardSecondaryText: {
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  avatarStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  stackAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(61, 168, 107, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  publicBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2e7d32',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onPrimaryFixedVariant,
  },
  aboutSection: {
    gap: 6,
  },
  sectionHeading: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  bodyParagraph: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    lineHeight: 22,
  },
  bottomTray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(252, 249, 248, 0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
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
    backgroundColor: Colors.primaryContainer,
  },
  btnJoinedState: {
    backgroundColor: Colors.surfaceContainerHighest,
  },
  joinButtonText: {
    ...Typography.labelLg,
    fontWeight: '700',
  },
  textNotJoinedState: {
    color: Colors.onPrimaryContainer,
  },
  textJoinedState: {
    color: Colors.onSurface,
  },
  bookmarkButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
