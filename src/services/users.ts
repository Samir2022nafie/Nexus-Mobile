/**
 * Users Service — Maps to /users/* endpoints
 */
import api from './api';
import { User, UpdateProfileDto, PublicProfile, ManagedCommunity, Post } from '../types';

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

  /** POST /users/:id/follow */
  follow(userId: string): Promise<{ following: boolean }> {
    return api.post<{ following: boolean }>(`/users/${userId}/follow`);
  },

  /** DELETE /users/:id/follow */
  unfollow(userId: string): Promise<{ following: boolean }> {
    return api.delete<{ following: boolean }>(`/users/${userId}/follow`);
  },

  /** GET /users/:id/posts */
  async getUserPosts(userId: string): Promise<Post[]> {
    const res = await api.get<any>(`/users/${userId}/posts`);
    return Array.isArray(res) ? res : (res?.data || []);
  },

  /** GET /users/me/communities — Managed communities */
  getMyCommunities(): Promise<ManagedCommunity[]> {
    return api.get<ManagedCommunity[]>('/users/me/communities');
  },
};
