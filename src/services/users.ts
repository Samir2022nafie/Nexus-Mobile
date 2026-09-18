/**
 * Users Service — Maps to /users/* endpoints
 */
import api from './api';
import { User, UpdateProfileDto, PublicProfile, ManagedCommunity } from '../types';

export const usersService = {
  /** GET /users/me */
  getMyProfile(): Promise<User> {
    return api.get<User>('/users/me');
  },

  /** PATCH /users/me */
  updateMyProfile(dto: UpdateProfileDto): Promise<User> {
    return api.patch<User>('/users/me', dto);
  },

  /** DELETE /users/me */
  deleteMyAccount(): Promise<{ success: true }> {
    return api.delete<{ success: true }>('/users/me');
  },

  /** GET /users/:id — Public profile */
  getPublicProfile(userId: string): Promise<PublicProfile> {
    return api.get<PublicProfile>(`/users/${userId}`);
  },

  /** GET /users/me/communities — Managed communities */
  getMyCommunities(): Promise<ManagedCommunity[]> {
    return api.get<ManagedCommunity[]>('/users/me/communities');
  },
};
