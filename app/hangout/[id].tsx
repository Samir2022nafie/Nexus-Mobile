/**
 * Hangout Detail Screen — Matches Stitch screen_21_hangout_detail_open_not_joined
 * Backend: GET /hangouts/:id, POST /hangouts/:id/join|request|leave
 * Enforces: open vs request_based join logic, participant roster, bottom action bar
 * Fixes: eliminates mock fallback data and Android elevation/white rectangular outline artifacts.
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
import { hangoutsService } from '../../src/services/hangouts';
import { useAuth } from '../../src/context/AuthContext';

export default function HangoutDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [hangout, setHangout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(0);

  const fetchHangout = useCallback(async () => {
    if (!id) return;
    try {
      const data = await hangoutsService.getById(id).catch(() => null);
      if (data) {
        setHangout(data);
        setIsJoined(data.isParticipant || false);
        setIsBookmarked(data.isSaved || false);
        setParticipantsCount((data as any).participants?.length ?? (data.participantsCount || 0));
      } else {
        setHangout(null);
      }
    } catch {
      setHangout(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchHangout();
  }, [fetchHangout]);

  const handleJoin = async () => {
    if (!hangout) return;
    setActionLoading(true);
    const nextJoined = !isJoined;
    setIsJoined(nextJoined);
    setParticipantsCount((prev) => (nextJoined ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (isOpen) {
        if (!isJoined) {
          await hangoutsService.join(hangout.id).catch(() => {});
        } else {
          await hangoutsService.leave(hangout.id).catch(() => {});
        }
      } else {
        await hangoutsService.requestJoin(hangout.id).catch(() => {});
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleSave = async () => {
    setIsBookmarked(!isBookmarked);
    if (!hangout) return;
    try {
      await hangoutsService.toggleSave(hangout.id).catch(() => {});
    } catch {}
  };

  if (loading) return <LoadingSpinner fullScreen />;

  if (!hangout) {
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
        <Text style={styles.notFoundTitle}>Hangout not found</Text>
        <Text style={styles.notFoundSub}>
          This meetup may have ended or does not exist in the database.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <MaterialIcons name="arrow-back" size={18} color={Colors.onPrimaryContainer} />
          <Text style={styles.backButtonText}>Back to Hangouts</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOpen =
    hangout.join_type === 'open' ||
    hangout.joinType === 'OPEN' ||
    hangout.joinType === 'open';

  const maxSpots = hangout.max_participants || hangout.maxParticipants || 15;
  const spotsLeft = Math.max(0, maxSpots - participantsCount);

  // Formatted date and time from database timestamps
  const startDate = hangout.starts_at ? new Date(hangout.starts_at) : null;
  const endDate = hangout.ends_at ? new Date(hangout.ends_at) : null;
  const dateText = startDate
    ? startDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Flexible Date';
  const timeText = startDate
    ? `${startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${
        endDate
          ? ` – ${endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
          : ''
      }`
    : 'Time to be announced';

  const locationText =
    hangout.location?.place_name ||
    (typeof hangout.location === 'string' ? hangout.location : 'Location to be shared upon joining');
  const locationDistrict =
    hangout.community?.name ||
    (hangout.location?.place_name ? hangout.location.place_name.split(',')[0] : 'Local Meetup');

  const participantsList = hangout.participants || [];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 84 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Visual Cover Banner with Overlay Actions */}
        <View style={styles.coverContainer}>
          <Image
            source={{
              uri:
                hangout.cover_image_url ||
                hangout.coverImageUrl ||
                'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
            }}
            style={styles.coverImage}
          />
          <View style={styles.coverGradient} />

          {/* Floating Top Nav */}
          <View style={[styles.coverNavRow, { top: insets.top + Spacing.xs }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.navBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={20} color={Colors.onSurface} />
            </TouchableOpacity>

            <View style={styles.navRightGroup}>
              <View style={styles.meetupPill}>
                <View style={styles.beaconDot} />
                <Text style={styles.meetupText}>Meetup</Text>
              </View>
              <TouchableOpacity style={styles.navBtn} activeOpacity={0.8}>
                <MaterialIcons name="more-horiz" size={20} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Location Micro-chip */}
          <View style={styles.locationChip}>
            <MaterialIcons name="storefront" size={16} color={Colors.primaryFixedDim} />
            <Text style={styles.locationChipText}>{locationDistrict}</Text>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Header Block */}
          <View style={styles.headerBlock}>
            <Text style={styles.titleText}>{hangout.title}</Text>

            <View style={styles.creatorRow}>
              <View style={styles.creatorAvatarInitials}>
                <Text style={styles.initialsText}>
                  {(hangout.creator?.first_name || 'H')[0]}
                  {(hangout.creator?.last_name || 'O')[0]}
                </Text>
              </View>
              <View>
                <Text style={styles.creatorHandle}>
                  @{hangout.creator?.username || 'host'}
                </Text>
                <Text style={styles.creatorHostRole}>
                  {hangout.community?.name
                    ? `Community Host · ${hangout.community.name}`
                    : 'Hangout Host'}
                </Text>
              </View>
            </View>
          </View>

          {/* 4 Info Matrix Cards — free of white rectangular outline artifacts */}
          <View style={styles.infoMatrix}>
            {/* When */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="schedule" size={22} color={Colors.primaryContainer} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText}>{dateText}</Text>
                <Text style={styles.cardSecondaryText}>{timeText}</Text>
              </View>
            </View>

            {/* Where */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="pin-drop" size={22} color={Colors.primaryContainer} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText} numberOfLines={1}>
                  {locationText}
                </Text>
                <Text style={styles.cardSecondaryText} numberOfLines={1}>
                  {locationDistrict}
                </Text>
              </View>
              <TouchableOpacity style={styles.mapBtn} activeOpacity={0.7}>
                <MaterialIcons name="near-me" size={18} color={Colors.secondary} />
              </TouchableOpacity>
            </View>

            {/* Spots & Attendance Stack */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="group" size={22} color={Colors.primaryContainer} />
              </View>
              <View style={styles.cardTextCol}>
                <View style={styles.spotsRow}>
                  <Text style={styles.cardPrimaryText}>
                    {participantsCount} of {maxSpots} joined
                  </Text>
                  <View style={styles.spotsLeftBadge}>
                    <Text style={styles.spotsLeftText}>{spotsLeft} spots left</Text>
                  </View>
                </View>
                {participantsList.length > 0 ? (
                  <View style={styles.avatarStackRow}>
                    {participantsList.slice(0, 3).map((p: any, idx: number) => {
                      const initials = `${(p.user?.first_name || p.first_name || 'U')[0]}${
                        (p.user?.last_name || p.last_name || '')[0] || ''
                      }`;
                      const bgColors = [
                        Colors.secondaryContainer,
                        Colors.primaryFixedDim,
                        Colors.tertiaryContainer,
                      ];
                      return (
                        <View
                          key={p.id || idx}
                          style={[styles.miniAvatar, { backgroundColor: bgColors[idx % 3] }]}
                        >
                          <Text style={styles.miniAvatarText}>{initials}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.cardSecondaryText}>Be the first to join!</Text>
                )}
              </View>
            </View>

            {/* Join Type Card */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="lock-open" size={22} color={Colors.secondary} />
              </View>
              <View style={styles.joinTypeRow}>
                <View
                  style={[
                    styles.joinTypePill,
                    isOpen ? styles.pillOpen : styles.pillRequest,
                  ]}
                >
                  <Text
                    style={[
                      styles.joinTypePillText,
                      isOpen ? styles.textOpen : styles.textRequest,
                    ]}
                  >
                    {isOpen ? 'Open' : 'Request'}
                  </Text>
                </View>
                <Text style={styles.joinTypeSubtitle}>
                  {isOpen
                    ? 'Anyone can drop in without approval'
                    : 'Host approval required to join'}
                </Text>
              </View>
            </View>
          </View>

          {/* About Hangout Block */}
          <View style={styles.aboutCard}>
            <View style={styles.aboutHeaderRow}>
              <Text style={styles.aboutTitle}>About Hangout</Text>
            </View>
            <Text style={styles.aboutBody}>
              {hangout.description || 'No description provided for this hangout.'}
            </Text>
            {hangout.community?.name && (
              <View style={styles.topicTagsRow}>
                <View style={styles.topicPill}>
                  <Text style={styles.topicText}>#{hangout.community.slug || 'hangout'}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Participants Roster */}
          <View style={styles.rosterCard}>
            <View style={styles.rosterHeader}>
              <View style={styles.rosterTitleGroup}>
                <Text style={styles.rosterTitle}>Participants</Text>
                <View style={styles.rosterCountPill}>
                  <Text style={styles.rosterCountText}>{participantsCount}</Text>
                </View>
              </View>
              {participantsCount > 0 && (
                <Text style={styles.recentlyJoinedText}>Members</Text>
              )}
            </View>

            {participantsList.length > 0 ? (
              <View style={styles.rosterAvatarsRow}>
                {/* Host */}
                <View style={styles.rosterItem}>
                  <View style={styles.hostAvatarBox}>
                    <Text style={styles.hostAvatarInitials}>
                      {(hangout.creator?.first_name || 'H')[0]}
                      {(hangout.creator?.last_name || 'O')[0]}
                    </Text>
                    <View style={styles.starBadge}>
                      <MaterialIcons name="star" size={10} color={Colors.onPrimary} />
                    </View>
                  </View>
                  <Text style={styles.rosterItemName} numberOfLines={1}>
                    {hangout.creator?.first_name || 'Host'}
                  </Text>
                  <Text style={styles.rosterItemRole}>Host</Text>
                </View>

                {/* Other participants */}
                {participantsList.slice(0, 5).map((p: any, idx: number) => {
                  const firstName = p.user?.first_name || p.first_name || 'Member';
                  const lastName = p.user?.last_name || p.last_name || '';
                  const initials = `${firstName[0]}${lastName[0] || ''}`;
                  return (
                    <View key={p.id || idx} style={styles.rosterItem}>
                      <View
                        style={[
                          styles.hostAvatarBox,
                          {
                            backgroundColor:
                              idx % 2 === 0
                                ? Colors.primaryFixedDim
                                : Colors.tertiaryContainer,
                          },
                        ]}
                      >
                        <Text style={styles.hostAvatarInitials}>{initials}</Text>
                      </View>
                      <Text style={styles.rosterItemName} numberOfLines={1}>
                        {firstName}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyRosterBox}>
                <Text style={styles.emptyRosterText}>
                  No participants yet. Be the first to join!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Tray */}
      <View style={[styles.bottomTray, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity
          style={[
            styles.joinBtn,
            isJoined ? styles.btnJoinedState : styles.btnNotJoinedState,
          ]}
          onPress={handleJoin}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          <MaterialIcons
            name={isJoined ? 'check-circle' : 'groups'}
            size={20}
            color={isJoined ? Colors.onSurface : Colors.onPrimaryContainer}
          />
          <Text
            style={[
              styles.joinBtnText,
              isJoined ? styles.textJoinedState : styles.textNotJoinedState,
            ]}
          >
            {isJoined
              ? 'Joined'
              : isOpen
              ? 'Join Hangout'
              : 'Request to Join'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={handleSave}
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
  coverContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: Colors.surfaceContainerHighest,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  coverNavRow: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(252, 249, 248, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(252, 249, 248, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  meetupText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  locationChip: {
    position: 'absolute',
    bottom: 12,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 27, 27, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  locationChipText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '500',
  },
  body: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  headerBlock: {
    gap: 8,
  },
  titleText: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    fontWeight: '700',
    lineHeight: 30,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatorAvatarInitials: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onTertiaryContainer,
  },
  creatorHandle: {
    ...Typography.labelMd,
    color: Colors.secondary,
    fontWeight: '600',
  },
  creatorHostRole: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  infoMatrix: {
    gap: 8,
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
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
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
    color: Colors.tertiary,
    marginTop: 2,
  },
  mapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spotsLeftBadge: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  spotsLeftText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onPrimaryFixedVariant,
  },
  avatarStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
  },
  joinTypeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  pillOpen: {
    backgroundColor: Colors.secondaryFixed,
  },
  pillRequest: {
    backgroundColor: Colors.tertiaryContainer,
  },
  joinTypePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textOpen: {
    color: Colors.onSecondaryFixed,
  },
  textRequest: {
    color: Colors.onTertiaryContainer,
  },
  joinTypeSubtitle: {
    ...Typography.captionSm,
    color: Colors.onSurface,
    flex: 1,
  },
  aboutCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  aboutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  aboutBody: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    lineHeight: 22,
  },
  topicTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
  },
  topicPill: {
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  topicText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  rosterCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rosterTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rosterTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  rosterCountPill: {
    backgroundColor: Colors.secondaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  rosterCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSecondaryFixed,
  },
  recentlyJoinedText: {
    ...Typography.captionSm,
    color: Colors.tertiary,
  },
  rosterAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  rosterItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
  },
  hostAvatarBox: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSecondaryContainer,
  },
  starBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterItemName: {
    ...Typography.captionSm,
    color: Colors.onSurface,
    fontWeight: '600',
    maxWidth: 52,
  },
  rosterItemRole: {
    fontSize: 10,
    color: Colors.tertiary,
  },
  emptyRosterBox: {
    paddingVertical: Spacing.sm,
  },
  emptyRosterText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    fontStyle: 'italic',
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
  joinBtn: {
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
  joinBtnText: {
    ...Typography.labelLg,
    fontWeight: '700',
  },
  textNotJoinedState: {
    color: Colors.onPrimaryContainer,
  },
  textJoinedState: {
    color: Colors.onSurface,
  },
  bookmarkBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
