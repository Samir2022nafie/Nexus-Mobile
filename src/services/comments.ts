/**
 * Comments Service — Maps to /posts/:id/comments/* and /comments/* endpoints
 */
import api from './api';
import { Comment, CreateCommentDto, UpdateCommentDto, PaginationParams } from '../types';

export const commentsService = {
  /** GET /posts/:postId/comments */
  listByPost(postId: string, params?: PaginationParams): Promise<Comment[]> {
    return api.get<Comment[]>(`/posts/${postId}/comments`, params as Record<string, any>);
  },

  /** GET /comments/:id */
  getById(commentId: string): Promise<Comment> {
    return api.get<Comment>(`/comments/${commentId}`);
  },

  /** POST /posts/:postId/comments */
  create(postId: string, dto: CreateCommentDto): Promise<Comment> {
    return api.post<Comment>(`/posts/${postId}/comments`, dto);
  },

  /** PATCH /comments/:id */
  update(commentId: string, dto: UpdateCommentDto): Promise<Comment> {
    return api.patch<Comment>(`/comments/${commentId}`, dto);
  },

  /** DELETE /comments/:id */
  delete(commentId: string): Promise<{ success: true }> {
    return api.delete<{ success: true }>(`/comments/${commentId}`);
  },

  /** POST /comments/:id/react — Toggle reaction */
  toggleReaction(commentId: string): Promise<{ reacted: boolean; reactionCount: number }> {
    return api.post<{ reacted: boolean; reactionCount: number }>(`/comments/${commentId}/react`);
  },
};
