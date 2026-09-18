/**
 * Communities Service — Maps to /communities/* endpoints
 */
import api from './api';
import {
  Community,
  CreateCommunityDto,
  UpdateCommunityDto,
  CommunityMember,
  CommunityRole,
  CommunityListParams,
  PaginationParams,
} from '../types';

export const communitiesService = {
  /** GET /communities */
  list(params?: CommunityListParams): Promise<Community[]> {
    return api.get<Community[]>('/communities', params as Record<string, any>);
  },

  /** GET /communities/:slug */
  getBySlug(slug: string): Promise<Community> {
    return api.get<Community>(`/communities/${slug}`);
  },

  /** POST /communities */
  create(dto: CreateCommunityDto): Promise<Community> {
    return api.post<Community>('/communities', dto);
  },

  /** PATCH /communities/:slug */
  update(slug: string, dto: UpdateCommunityDto): Promise<Community> {
    return api.patch<Community>(`/communities/${slug}`, dto);
  },

  /** POST /communities/:slug/join */
  join(slug: string): Promise<CommunityMember> {
    return api.post<CommunityMember>(`/communities/${slug}/join`);
  },

  /** POST /communities/:slug/leave */
  leave(slug: string): Promise<{ success: true }> {
    return api.post<{ success: true }>(`/communities/${slug}/leave`);
  },

  /** DELETE /communities/:slug (soft delete) */
  delete(slug: string): Promise<{ success: true }> {
    return api.delete<{ success: true }>(`/communities/${slug}`);
  },

  /** GET /communities/:slug/members */
  listMembers(slug: string, params?: PaginationParams & { role?: CommunityRole }): Promise<CommunityMember[]> {
    return api.get<CommunityMember[]>(`/communities/${slug}/members`, params as Record<string, any>);
  },

  /** PATCH /communities/:slug/members/:userId */
  updateMemberRole(slug: string, userId: string, role: CommunityRole): Promise<CommunityMember> {
    return api.patch<CommunityMember>(`/communities/${slug}/members/${userId}`, { role });
  },

  /** DELETE /communities/:slug/members/:userId/kick */
  kickMember(slug: string, userId: string): Promise<{ success: true }> {
    return api.delete<{ success: true }>(`/communities/${slug}/members/${userId}/kick`);
  },
};
