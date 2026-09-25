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
  deleteMyAccount(ticket?: string): Promise<{ success: true }> {
    const path = ticket ? `/users/me?ticket=${encodeURIComponent(ticket)}` : '/users/me';
    return api.delete<{ success: true }>(path);
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

  /** GET /users/:id/communities — Communities a user is member of */
  async getUserCommunities(userId: string): Promise<any[]> {
    const res = await api.get<any>(`/users/${userId}/communities`);
    return Array.isArray(res) ? res : (res?.data || []);
  },

  /** GET /users/me/communities — Managed communities */
  getMyCommunities(): Promise<ManagedCommunity[]> {
    return api.get<ManagedCommunity[]>('/users/me/communities');
  },

  /** GET /users/me/followers */
  getMyFollowers(search?: string): Promise<FollowerItem[]> {
    const q = search ? `?q=${encodeURIComponent(search)}` : '';
    return api.get<FollowerItem[]>(`/users/me/followers${q}`);
  },

  /** DELETE /users/me/followers/:followerId */
  removeFollower(followerId: string): Promise<{ success: boolean; removed: boolean }> {
    return api.delete<{ success: boolean; removed: boolean }>(`/users/me/followers/${followerId}`);
  },
};

export interface FollowerItem {
  id: string;
  username: string;
  name: string;
  firstName: string;
  lastName: string;
  bio?: string | null;
  profilePictureUrl?: string | null;
  trustScore: number;
  isFollowing: boolean;
}
