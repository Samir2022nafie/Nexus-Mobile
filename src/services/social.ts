/**
 * Social Service — Maps to /users/:id/follow, /users/:id/block, /users/:id/trust-score
 */
import api from './api';

export const socialService = {
  /** POST /users/:id/follow */
  followUser(userId: string): Promise<{ following: boolean }> {
    return api.post<{ following: boolean }>(`/users/${userId}/follow`);
  },

  /** DELETE /users/:id/follow */
  unfollowUser(userId: string): Promise<{ following: boolean }> {
    return api.delete<{ following: boolean }>(`/users/${userId}/follow`);
  },

  /** POST /users/:id/block */
  blockUser(userId: string): Promise<{ blocked: boolean }> {
    return api.post<{ blocked: boolean }>(`/users/${userId}/block`);
  },

  /** DELETE /users/:id/block */
  unblockUser(userId: string): Promise<{ blocked: boolean }> {
    return api.delete<{ blocked: boolean }>(`/users/${userId}/block`);
  },

  /** GET /users/:id/trust-score */
  getTrustScore(userId: string): Promise<{ trustScore: number; tier: string }> {
    return api.get<{ trustScore: number; tier: string }>(`/users/${userId}/trust-score`);
  },
};
