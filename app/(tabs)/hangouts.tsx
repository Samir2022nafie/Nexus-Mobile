/**
 * Hangouts Hub Screen — Matches Stitch screen_11_explore_hangouts_tab
 * Features:
 * - AppHeader (/ Hangouts)
 * - Live Beacon: "5 Hangouts Near You" with pulsing emerald beacon + filter toggle
 * - Tactile warm cards with host avatar, distance, title, description, schedule, spots counter, and pill Join/Request button
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { hangoutsService } from '../../src/services/hangouts';
import { HangoutItem } from '../../src/types';

export default function HangoutsScreen() {
  const router = useRouter();
  const [hangouts, setHangouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHangouts = useCallback(async () => {
    try {
      const data = await hangoutsService.list({ limit: 30 });
      setHangouts(data || []);
    } catch {
      setHangouts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHangouts();
  }, [fetchHangouts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHangouts();
  };

  return (
    <View style={styles.screen}>
      <AppHeader breadcrumb="Hangouts" />

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
        {/* Status Banner */}
        <View style={styles.statusBar}>
          <View style={styles.beaconGroup}>
            <View style={styles.beaconRing}>
              <View style={styles.beaconDot} />
            </View>
            <Text style={styles.beaconText}>
              {hangouts.length} {hangouts.length === 1 ? 'Hangout' : 'Hangouts'} Near You
            </Text>
          </View>
          <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
            <MaterialIcons name="tune" size={16} color={Colors.secondary} />
            <Text style={styles.filterText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <LoadingSpinner message="Loading hangouts..." />
        ) : hangouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="explore" size={56} color={Colors.tertiary} />
            <Text style={styles.emptyTitle}>No Hangouts Nearby</Text>
            <Text style={styles.emptySubtitle}>
              Nobody has organized a hangout nearby right now. Host a casual meetup, coffee chat, or study session!
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push('/new-hangout')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={20} color={Colors.onPrimaryContainer} />
              <Text style={styles.emptyActionText}>Host a Hangout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {hangouts.map((h) => {
              const isOpen = h.isOpen ?? (h.joinType === 'OPEN' || h.join_type === 'OPEN' || h.joinType === 'open' || h.join_type === 'open');
              return (
                <TouchableOpacity
                  key={h.id}
                  style={styles.card}
                  activeOpacity={0.88}
                  onPress={() => router.push(`/hangout/${h.id}`)}
                >
                  {/* Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.hostGroup}>
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
                        <Text style={styles.hostRole}>created this</Text>
                      </View>
                    </View>
                    <View style={styles.distanceBadge}>
                      <MaterialIcons name="near-me" size={14} color={Colors.tertiary} />
                      <Text style={styles.distanceText}>{h.distanceText || (h.location?.place_name ? h.location.place_name.slice(0, 15) : 'Nearby')}</Text>
                    </View>
                  </View>

                  {/* Title & Description */}
                  <Text style={styles.cardTitle}>{h.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {h.description || "Let's hang out and connect!"}
                  </Text>

                  {/* Schedule */}
                  <View style={styles.scheduleRow}>
                    <MaterialIcons name="schedule" size={16} color={Colors.onSurfaceVariant} />
                    <Text style={styles.scheduleText}>{h.timeText || (h.starts_at ? new Date(h.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today')}</Text>
                  </View>

                  {/* Footer with spots and CTA */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.spotsText}>
                      {h.spotsText || `${h.participantsCount || 1}/${h.maxParticipants || 10} spots`}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isOpen ? styles.actionBtnOpen : styles.actionBtnRequest,
                      ]}
                      onPress={() => router.push(`/hangout/${h.id}`)}
                    >
                      <Text
                        style={[
                          styles.actionBtnText,
                          isOpen ? styles.actionBtnTextOpen : styles.actionBtnTextRequest,
                        ]}
                      >
                        {isOpen ? 'Join' : 'Request'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 48,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  beaconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beaconRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(61, 168, 107, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  beaconText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterText: {
    ...Typography.captionMd,
    color: Colors.secondary,
    fontWeight: '600',
  },
  list: {
    gap: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hostGroup: {
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
  hostRole: {
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
  cardTitle: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  cardDesc: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    lineHeight: 20,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  scheduleText: {
    ...Typography.captionMd,
    color: Colors.onSurfaceVariant,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(105, 92, 80, 0.15)',
  },
  spotsText: {
    ...Typography.captionMd,
    color: Colors.tertiary,
    fontWeight: '600',
  },
  actionBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOpen: {
    backgroundColor: Colors.primaryContainer,
  },
  actionBtnRequest: {
    backgroundColor: Colors.secondary,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnTextOpen: {
    color: Colors.onPrimaryContainer,
  },
  actionBtnTextRequest: {
    color: Colors.surface,
  },
  emptyContainer: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: Spacing.md,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    fontSize: 20,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: Colors.tertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
  },
});
