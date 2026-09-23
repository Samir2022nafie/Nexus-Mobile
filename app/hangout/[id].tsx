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
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, ThemeColors } from '../../src/constants/theme';
import { useTheme, useThemedStyles } from '../../src/context/ThemeContext';
import { hangoutsService } from '../../src/services/hangouts';
import { HangoutItem } from '../../src/types';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { RaisingHandIcon } from '../../src/components/RaisingHandIcon';
import { useAuth } from '../../src/context/AuthContext';

export default function HangoutDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(getStyles);

  const [hangout, setHangout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [respondingUserId, setRespondingUserId] = useState<string | null>(null);
  const [participantsCount, setParticipantsCount] = useState<number>(0);

  const fetchHangout = useCallback(async () => {
    if (!id) return;
    try {
      const data = await hangoutsService.getById(id).catch(() => null);
      if (data) {
        setHangout(data);
        setIsJoined(Boolean(data.isParticipant));
        setIsRequested(
          Boolean(
            (data as any).hasRequested ||
              (data as any).isRequested ||
              (data as any).requestStatus === 'pending' ||
              (data as any).userRequestStatus === 'pending'
          )
        );
        setIsBookmarked(data.isSaved || false);
        setPendingRequests((data as any).joinRequests || []);

        // Strict approved-only participant counting
        const approved = ((data as any).participants || []).filter(
          (p: any) => !p.status || p.status === 'approved' || p.status === 'active'
        );
        const count =
          approved.length > 0
            ? approved.length
            : (data.participantsCount || (data.isParticipant ? 1 : 0));
        setParticipantsCount(count);
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

  const isHangoutHost = Boolean(
    user?.id && (
      hangout?.creator_id === user.id ||
      hangout?.creatorId === user.id ||
      hangout?.creator?.id === user.id
    )
  );

  const handleRespondRequest = async (targetUserId: string, status: 'approved' | 'rejected') => {
    if (!hangout) return;
    setRespondingUserId(targetUserId);
    try {
      await hangoutsService.respondToJoinRequest(hangout.id, targetUserId, status);
      const targetReq = pendingRequests.find((r) => r.userId === targetUserId);
      setPendingRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
      if (status === 'approved' && targetReq?.user) {
        setParticipantsCount((prev) => prev + 1);
        setHangout((prev: any) => ({
          ...prev,
          participants: [...(prev?.participants || []), targetReq.user],
        }));
      }
    } catch {
      Alert.alert('Error', `Failed to ${status === 'approved' ? 'approve' : 'decline'} join request.`);
    } finally {
      setRespondingUserId(null);
    }
  };

  const handleDeleteHangout = () => {
    Alert.alert(
      'Delete Hangout',
      'Are you sure you want to delete this hangout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await hangoutsService.delete(hangout.id);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete hangout.');
            }
          },
        },
      ]
    );
  };

  const handleJoin = async () => {
    if (!hangout) return;
    setActionLoading(true);

    const isDirectJoin = isOpen || isHangoutHost;

    if (isDirectJoin) {
      if (isJoined) {
        Alert.alert(
          'Leave Hangout',
          'Are you sure you want to leave this hangout?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setActionLoading(false) },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                setIsJoined(false);
                setIsRequested(false);
                setParticipantsCount((prev) => Math.max(0, prev - 1));
                try {
                  await hangoutsService.leave(hangout.id);
                } catch {} finally {
                  setActionLoading(false);
                }
              },
            },
          ]
        );
      } else {
        setIsJoined(true);
        setIsRequested(false);
        setParticipantsCount((prev) => prev + 1);
        try {
          await hangoutsService.join(hangout.id);
        } catch {
          setIsJoined(false);
          setParticipantsCount((prev) => Math.max(0, prev - 1));
        } finally {
          setActionLoading(false);
        }
      }
    } else {
      // Request-based meetup: Unjoined -> Pending -> Joined
      if (isJoined) {
        Alert.alert(
          'Leave Hangout',
          'Are you sure you want to leave this hangout? You will need to request approval again to rejoin.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setActionLoading(false) },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                setIsJoined(false);
                setIsRequested(false);
                setParticipantsCount((prev) => Math.max(0, prev - 1));
                try {
                  await hangoutsService.leave(hangout.id);
                } catch {} finally {
                  setActionLoading(false);
                }
              },
            },
          ]
        );
      } else if (isRequested) {
        Alert.alert(
          'Cancel Join Request',
          'Your request is currently waiting for approval from the host. Would you like to cancel it?',
          [
            { text: 'No', style: 'cancel', onPress: () => setActionLoading(false) },
            {
              text: 'Cancel Request',
              style: 'destructive',
              onPress: async () => {
                setIsRequested(false);
                try {
                  await hangoutsService.leave(hangout.id);
                } catch {} finally {
                  setActionLoading(false);
                }
              },
            },
          ]
        );
      } else {
        // Request to join
        setIsRequested(true);
        try {
          await hangoutsService.requestJoin(hangout.id);
        } catch {
          setIsRequested(false);
        } finally {
          setActionLoading(false);
        }
      }
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
          <MaterialIcons name="event-busy" size={40} color={colors.tertiary} />
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
          <MaterialIcons name="arrow-back" size={18} color={colors.onPrimaryContainer} />
          <Text style={styles.backButtonText}>Back to Hangouts</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOpen =
    hangout.join_type === 'open' ||
    hangout.joinType === 'OPEN' ||
    hangout.joinType === 'open';

  const isDirectJoin = isOpen || isHangoutHost;

  const rawMax = hangout.max_participants ?? hangout.maxParticipants;
  const hasLimit = typeof rawMax === 'number' && rawMax > 0;
  const maxSpots = hasLimit ? rawMax : null;
  const spotsLeft = maxSpots ? Math.max(0, maxSpots - participantsCount) : null;

  const rawStarts = hangout.startsAt || hangout.starts_at;
  const rawEnds = hangout.endsAt || hangout.ends_at;
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

  const dateText = startDate
    ? startDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Date to be announced';
  const timeText = startDate
    ? `${startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${
        endDate
          ? ` – ${endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
          : ''
      }`
    : 'Time to be announced';

  const locationText =
    hangout.location?.name ||
    hangout.location?.place_name ||
    hangout.location?.address ||
    (typeof hangout.location === 'string' ? hangout.location : '') ||
    'Location to be shared upon joining';
  const locationDistrict =
    hangout.location?.city ||
    (hangout.location?.place_name ? hangout.location.place_name.split(',')[0] : '') ||
    hangout.community?.name ||
    'Meetup Location';

  const approvedParticipants = (hangout.participants || []).filter(
    (p: any) => !p.status || p.status === 'approved' || p.status === 'active'
  );
  const participantsList = approvedParticipants;

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

          {/* Floating Top Nav: Back Button + Host Controls */}
          <View style={[styles.coverNavRow, { top: insets.top + Spacing.xs }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.navBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={20} color={colors.onSurface} />
            </TouchableOpacity>

            {isHangoutHost && (
              <View style={styles.authorActionsRow}>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/new-hangout',
                      params: { hangoutId: hangout.id },
                    } as any)
                  }
                  style={styles.navBtn}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="edit" size={20} color={colors.secondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeleteHangout}
                  style={styles.navBtn}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="delete-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Banner Status Pill (Bottom Right) with Distinct Colors */}
          <View
            style={[
              styles.bannerStatusPill,
              isOpen ? styles.bannerStatusPillOpen : styles.bannerStatusPillRequest,
            ]}
          >
            {isOpen && <View style={styles.openPillDot} />}
            {!isOpen && (
              <MaterialIcons
                name="lock-outline"
                size={13}
                color="#ffffff"
                style={{ marginRight: 2 }}
              />
            )}
            <Text style={styles.bannerStatusPillText}>
              {isOpen ? 'Open Meetup' : 'Request to Join'}
            </Text>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Header Block */}
          <View style={styles.headerBlock}>
            <Text style={styles.titleText}>{hangout.title}</Text>

            <View style={styles.creatorRow}>
              {hangout.creator?.profile_picture_url ? (
                <Image
                  source={{ uri: hangout.creator.profile_picture_url }}
                  style={styles.creatorAvatarImg}
                />
              ) : (
                <View style={styles.creatorAvatarFallback}>
                  <MaterialIcons name="person" size={22} color={colors.tertiary} />
                </View>
              )}
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

            {/* Description alone directly below host inside white rounded rectangle card */}
            {hangout.description ? (
              <View style={styles.descriptionCard}>
                <Text style={styles.directDescriptionText}>
                  {hangout.description}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Info Matrix Cards: When & Where */}
          <View style={styles.infoMatrix}>
            {/* When */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="schedule" size={22} color={colors.primaryContainer} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText}>{dateText}</Text>
                <Text style={styles.cardSecondaryText}>{timeText}</Text>
              </View>
            </View>

            {/* Where */}
            <View style={styles.infoCard}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="pin-drop" size={22} color={colors.primaryContainer} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardPrimaryText} numberOfLines={1}>
                  {locationText}
                </Text>
                <Text style={styles.cardSecondaryText} numberOfLines={1}>
                  {locationDistrict}
                </Text>
              </View>
            </View>
          </View>

          {/* Pending Join Requests for Host */}
          {isHangoutHost && (hangout.join_type === 'request_based' || hangout.joinType === 'request_based') && pendingRequests.length > 0 && (
            <View style={styles.requestsSectionCard}>
              <View style={styles.requestsHeaderRow}>
                <View style={styles.requestsTitleRow}>
                  <MaterialIcons name="person-add" size={18} color="#d97706" />
                  <Text style={styles.requestsTitle}>Pending Join Requests</Text>
                </View>
                <View style={styles.requestsCountBadge}>
                  <Text style={styles.requestsCountText}>{pendingRequests.length}</Text>
                </View>
              </View>

              <View style={styles.requestsList}>
                {pendingRequests.map((req) => {
                  const rUser = req.user;
                  const rName =
                    rUser?.first_name && rUser?.last_name
                      ? `${rUser.first_name} ${rUser.last_name}`
                      : rUser?.name || rUser?.first_name || rUser?.username || 'User';
                  const rAvatar = rUser?.profile_picture_url;
                  const isResponding = respondingUserId === req.userId;

                  return (
                    <View key={req.userId} style={styles.requestItemRow}>
                      <View style={styles.requestUserGroup}>
                        {rAvatar ? (
                          <Image source={{ uri: rAvatar }} style={styles.requestAvatar} />
                        ) : (
                          <View style={styles.requestAvatarFallback}>
                            <MaterialIcons name="person" size={18} color={colors.tertiary} />
                          </View>
                        )}
                        <View style={styles.requestUserInfo}>
                          <Text style={styles.requestUserName} numberOfLines={1}>
                            {rName}
                          </Text>
                          <Text style={styles.requestUserHandle} numberOfLines={1}>
                            @{rUser?.username || 'user'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.requestActionBtns}>
                        <TouchableOpacity
                          style={styles.requestDeclineBtn}
                          onPress={() => handleRespondRequest(req.userId, 'rejected')}
                          disabled={isResponding}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="close" size={16} color={colors.error} />
                          <Text style={styles.requestDeclineText}>Decline</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.requestApproveBtn}
                          onPress={() => handleRespondRequest(req.userId, 'approved')}
                          disabled={isResponding}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="check" size={16} color="#16a34a" />
                          <Text style={styles.requestApproveText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Unique Distinctive Container for Participants */}
          <View style={styles.participantsUniqueBox}>
            <View style={styles.participantsHeaderRow}>
              <View style={styles.participantsTitleGroup}>
                <View style={styles.participantsIconBox}>
                  <MaterialIcons name="groups" size={20} color={colors.primary} />
                </View>
                <Text style={styles.participantsMainTitle}>
                  {hasLimit
                    ? `${participantsCount} of ${maxSpots} joined`
                    : `${participantsCount} ${participantsCount === 1 ? 'is going' : 'are going'}`}
                </Text>
              </View>
              <View style={styles.spotsLeftBadge}>
                <Text style={styles.spotsLeftText}>
                  {hasLimit ? `${spotsLeft} spots left` : 'No limit'}
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
              <Text style={styles.emptyParticipantsText}>Be the first to join this hangout!</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Tray */}
      <View style={[styles.bottomTray, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity
          style={[
            styles.joinBtn,
            isPassed
              ? styles.btnPassedState
              : isJoined
              ? styles.btnJoinedState
              : isRequested
              ? styles.btnRequestedState
              : styles.btnNotJoinedState,
          ]}
          onPress={handleJoin}
          disabled={actionLoading || isPassed}
          activeOpacity={0.85}
        >
          {isPassed ? (
            isJoined ? (
              <>
                <MaterialIcons name="check-circle" size={20} color={colors.tertiary} />
                <Text style={[styles.joinBtnText, { color: colors.tertiary }]}>Attended</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="event-busy" size={20} color={colors.outline} />
                <Text style={[styles.joinBtnText, { color: colors.outline }]}>Hangout Ended</Text>
              </>
            )
          ) : isJoined ? (
            <>
              <MaterialIcons name="directions-walk" size={20} color={colors.onSurface} />
              <Text style={[styles.joinBtnText, styles.textJoinedState]}>Joined</Text>
            </>
          ) : isRequested ? (
            <>
              <MaterialIcons name="hourglass-empty" size={18} color="#92400e" />
              <Text style={[styles.joinBtnText, styles.textRequestedState]}>
                Waiting for approval
              </Text>
            </>
          ) : (
            <>
              <RaisingHandIcon size={20} color={colors.onPrimaryContainer} />
              <Text style={[styles.joinBtnText, styles.textNotJoinedState]}>
                {isOpen ? 'Join Hangout' : 'Request to Join'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={handleSave}
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
    coverContainer: {
      width: '100%',
      height: 200,
      position: 'relative',
      backgroundColor: colors.surfaceContainerHighest,
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
      backgroundColor: isDark ? 'rgba(34, 32, 30, 0.85)' : 'rgba(252, 249, 248, 0.85)',
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
      backgroundColor: isDark ? 'rgba(34, 32, 30, 0.9)' : 'rgba(252, 249, 248, 0.9)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
    },
    beaconDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#16a34a',
    },
    meetupText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
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
      color: '#ffffff',
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
      color: colors.onSurface,
      fontWeight: '700',
      lineHeight: 30,
    },
    creatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    creatorAvatarImg: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    creatorAvatarInitials: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.tertiaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialsText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onTertiaryContainer,
    },
    creatorHandle: {
      ...Typography.labelMd,
      color: colors.secondary,
      fontWeight: '600',
    },
    creatorHostRole: {
      ...Typography.captionSm,
      color: colors.tertiary,
    },
    directDescriptionText: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      lineHeight: 22,
      marginTop: 4,
    },
    infoMatrix: {
      gap: 8,
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
      width: 38,
      height: 38,
      borderRadius: BorderRadius.md,
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
      color: colors.tertiary,
      marginTop: 2,
    },
    mapBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    spotsLeftBadge: {
      backgroundColor: colors.primaryFixed,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    spotsLeftText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimaryFixedVariant,
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
      borderColor: colors.surface,
    },
    miniAvatarText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#ffffff',
    },
    descriptionCard: {
      backgroundColor: colors.surfaceContainerLow,
      padding: Spacing.md,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    creatorAvatarFallback: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    participantsUniqueBox: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      borderWidth: 1.5,
      borderColor: 'rgba(232, 167, 54, 0.35)',
      gap: 12,
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
    aboutCard: {
      backgroundColor: colors.surfaceContainerLow,
      padding: Spacing.md,
      borderRadius: BorderRadius.xl,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    aboutHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    aboutTitle: {
      ...Typography.headlineSm,
      fontSize: 18,
      color: colors.onSurface,
      fontWeight: '700',
    },
    aboutBody: {
      ...Typography.bodyMd,
      color: colors.onSurface,
      lineHeight: 22,
    },
    topicTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingTop: 4,
    },
    topicPill: {
      backgroundColor: colors.surfaceContainer,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
    },
    topicText: {
      ...Typography.captionSm,
      color: colors.tertiary,
      fontWeight: '600',
    },
    rosterCard: {
      backgroundColor: colors.surfaceContainerLow,
      padding: Spacing.md,
      borderRadius: BorderRadius.xl,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
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
      color: colors.onSurface,
      fontWeight: '700',
    },
    rosterCountPill: {
      backgroundColor: colors.secondaryFixed,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
    },
    rosterCountText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onSecondaryFixed,
    },
    recentlyJoinedText: {
      ...Typography.captionSm,
      color: colors.tertiary,
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
      backgroundColor: colors.secondaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hostAvatarInitials: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.onSecondaryContainer,
    },
    starBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rosterItemName: {
      ...Typography.captionSm,
      color: colors.onSurface,
      fontWeight: '600',
      maxWidth: 52,
    },
    rosterItemRole: {
      fontSize: 10,
      color: colors.tertiary,
    },
    emptyRosterBox: {
      paddingVertical: Spacing.sm,
    },
    emptyRosterText: {
      ...Typography.captionMd,
      color: colors.tertiary,
      fontStyle: 'italic',
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
      backgroundColor: colors.primaryContainer,
    },
    btnJoinedState: {
      backgroundColor: colors.surfaceContainerHighest,
    },
    joinBtnText: {
      ...Typography.labelLg,
      fontWeight: '700',
    },
    textNotJoinedState: {
      color: colors.onPrimaryContainer,
    },
    textJoinedState: {
      color: colors.onSurface,
    },
    bookmarkBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnRequestedState: {
      backgroundColor: isDark ? '#451a03' : '#fef3c7',
      borderWidth: 1,
      borderColor: '#f59e0b',
    },
    textRequestedState: {
      color: isDark ? '#fde68a' : '#92400e',
    },
    authorActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bannerStatusPill: {
      position: 'absolute',
      bottom: 12,
      right: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      zIndex: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    bannerStatusPillOpen: {
      backgroundColor: 'rgba(5, 150, 105, 0.9)',
    },
    bannerStatusPillRequest: {
      backgroundColor: 'rgba(217, 119, 6, 0.9)',
    },
    bannerStatusPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#ffffff',
      letterSpacing: 0.3,
    },
    openPillDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#ffffff',
    },
    btnPassedState: {
      backgroundColor: colors.surfaceContainerHigh,
    },
    requestsSectionCard: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
    },
    requestsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    requestsTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    requestsTitle: {
      ...Typography.titleMd,
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#fcd34d' : '#92400e',
    },
    requestsCountBadge: {
      backgroundColor: '#f59e0b',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
    },
    requestsCountText: {
      ...Typography.labelSm,
      color: '#ffffff',
      fontWeight: '700',
    },
    requestsList: {
      gap: Spacing.sm,
    },
    requestItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceContainerLow,
      padding: Spacing.sm,
      borderRadius: BorderRadius.lg,
    },
    requestUserGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8,
    },
    requestAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    requestAvatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceContainerHighest,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requestUserInfo: {
      flex: 1,
    },
    requestUserName: {
      ...Typography.labelMd,
      fontWeight: '700',
      color: colors.onSurface,
    },
    requestUserHandle: {
      ...Typography.bodySm,
      color: colors.tertiary,
    },
    requestActionBtns: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    requestDeclineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceContainerHighest,
    },
    requestDeclineText: {
      ...Typography.labelSm,
      color: colors.error,
      fontWeight: '600',
    },
    requestApproveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      backgroundColor: isDark ? 'rgba(22, 163, 74, 0.2)' : '#dcfce7',
    },
    requestApproveText: {
      ...Typography.labelSm,
      color: isDark ? '#4ade80' : '#16a34a',
      fontWeight: '700',
    },
  });
