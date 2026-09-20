/**
 * Join Requests Screen — Hangout creator manages pending join requests.
 * Backend: PATCH /hangouts/:id/requests/:userId
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import { Avatar } from '../../../src/components/ui/Avatar';
import { Button } from '../../../src/components/ui/Button';
import { LoadingSpinner } from '../../../src/components/ui/LoadingSpinner';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { hangoutsService } from '../../../src/services/hangouts';
import { HangoutJoinRequest } from '../../../src/types';

export default function JoinRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [requests, setRequests] = useState<HangoutJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    // For now, this would need a dedicated endpoint or be part of hangout detail
    // Using placeholder until the API provides a list-requests endpoint
    setLoading(false);
  }, [id]);

  const handleRespond = async (userId: string, status: 'approved' | 'rejected') => {
    if (!id) return;
    setProcessingId(userId);
    try {
      await hangoutsService.respondToJoinRequest(id, userId, status);
      setRequests((prev) => prev.map((r) =>
        r.userId === userId ? { ...r, status } : r
      ));
    } catch {} finally { setProcessingId(null); }
  };

  const renderRequest = ({ item }: { item: HangoutJoinRequest }) => (
    <View style={styles.requestRow}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => router.push(`/user/${item.userId}`)}
      >
        <Avatar uri={item.user.profile_picture_url} name={`${item.user.first_name} ${item.user.last_name}`} size={44} />
        <View>
          <Text style={styles.userName}>{item.user.first_name} {item.user.last_name}</Text>
          <Text style={styles.userHandle}>@{item.user.username}</Text>
          <Text style={styles.requestTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {item.status === 'pending' ? (
        <View style={styles.actionButtons}>
          <Button
            title="Accept"
            onPress={() => handleRespond(item.userId, 'approved')}
            size="sm"
            loading={processingId === item.userId}
          />
          <Button
            title="Decline"
            onPress={() => handleRespond(item.userId, 'rejected')}
            variant="outlined"
            size="sm"
          />
        </View>
      ) : (
        <View style={[styles.statusBadge, item.status === 'approved' ? styles.approvedBadge : styles.rejectedBadge]}>
          <MaterialIcons
            name={item.status === 'approved' ? 'check-circle' : 'cancel'}
            size={14}
            color={item.status === 'approved' ? Colors.success : Colors.error}
          />
          <Text style={[styles.statusText, item.status === 'approved' ? styles.approvedText : styles.rejectedText]}>
            {item.status === 'approved' ? 'Approved' : 'Declined'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <LoadingSpinner message="Loading requests..." />
      ) : requests.length === 0 ? (
        <EmptyState icon="group-add" title="No requests" subtitle="When someone requests to join, they'll appear here." />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.userId}
          renderItem={renderRequest}
          contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        />
      )}
    </View>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headlineSm, color: Colors.onSurface },
  requestRow: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainerHigh,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  userName: { ...Typography.labelMd, color: Colors.onSurface },
  userHandle: { ...Typography.captionSm, color: Colors.outline },
  requestTime: { ...Typography.captionSm, color: Colors.outline, marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full },
  approvedBadge: { backgroundColor: Colors.successContainer },
  rejectedBadge: { backgroundColor: Colors.errorContainer },
  statusText: { ...Typography.labelSm },
  approvedText: { color: '#166534' },
  rejectedText: { color: Colors.onErrorContainer },
});
