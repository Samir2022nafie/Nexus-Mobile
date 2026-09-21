/**
 * Posts Service — Maps to /communities/:slug/posts/* and /posts/* endpoints
 */
import api from './api';
import { Post, CreatePostDto, UpdatePostDto, PostListParams } from '../types';

export const postsService = {
  async listByCommmunity(slug: string, params?: PostListParams): Promise<Post[]> {
    const res = await api.get<any>(`/communities/${slug}/posts`, params as Record<string, any>);
    return Array.isArray(res) ? res : (res?.data || []);
  },

  /** GET /posts/:id */
  getById(postId: string): Promise<Post> {
    return api.get<Post>(`/posts/${postId}`);
  },

  /** POST /communities/:slug/posts */
  create(slug: string, dto: CreatePostDto): Promise<Post> {
    return api.post<Post>(`/communities/${slug}/posts`, dto);
  },

  /** PATCH /posts/:id */
  update(postId: string, dto: UpdatePostDto): Promise<Post> {
    return api.patch<Post>(`/posts/${postId}`, dto);
  },

  /** DELETE /posts/:id */
  delete(postId: string): Promise<{ success: true }> {
    return api.delete<{ success: true }>(`/posts/${postId}`);
  },

  /** POST /posts/:id/react — Toggle reaction */
  toggleReaction(postId: string): Promise<{ reacted: boolean; reactionCount: number }> {
    return api.post<{ reacted: boolean; reactionCount: number }>(`/posts/${postId}/react`);
  },

  /** POST /posts/:id/save — Toggle bookmark */
  toggleSave(postId: string): Promise<{ saved: boolean }> {
    return api.post<{ saved: boolean }>(`/posts/${postId}/save`);
  },
};
