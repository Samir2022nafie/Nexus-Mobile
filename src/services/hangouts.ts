/**
 * Hangouts Service — Maps to /hangouts/* endpoints
 */
import api from './api';
import { HangoutItem, CreateHangoutDto, HangoutJoinRequest, PaginationParams } from '../types';

export const hangoutsService = {
  /** GET /hangouts */
  list(params?: PaginationParams): Promise<HangoutItem[]> {
    return api.get<HangoutItem[]>('/hangouts', params as Record<string, any>);
  },

  /** GET /hangouts/:id */
  getById(hangoutId: string): Promise<HangoutItem> {
    return api.get<HangoutItem>(`/hangouts/${hangoutId}`);
  },

  /** POST /hangouts */
  create(dto: CreateHangoutDto): Promise<HangoutItem> {
    return api.post<HangoutItem>('/hangouts', dto);
  },

  /** PATCH /hangouts/:id */
  update(hangoutId: string, dto: Partial<CreateHangoutDto>): Promise<HangoutItem> {
    return api.patch<HangoutItem>(`/hangouts/${hangoutId}`, dto);
  },

  /** DELETE /hangouts/:id */
  delete(hangoutId: string): Promise<{ success: true }> {
    return api.delete<{ success: true }>(`/hangouts/${hangoutId}`);
  },

  /** POST /hangouts/:id/join — Join open hangout */
  join(hangoutId: string): Promise<{ joined: boolean; participantsCount: number }> {
    return api.post<{ joined: boolean; participantsCount: number }>(`/hangouts/${hangoutId}/join`);
  },

  /** POST /hangouts/:id/leave */
  leave(hangoutId: string): Promise<{ success: true }> {
    return api.post<{ success: true }>(`/hangouts/${hangoutId}/leave`);
  },

  /** POST /hangouts/:id/request — Request to join (request_based hangout) */
  requestJoin(hangoutId: string): Promise<{ requested: boolean; status: string }> {
    return api.post<{ requested: boolean; status: string }>(`/hangouts/${hangoutId}/request`);
  },

  /** PATCH /hangouts/:id/requests/:userId — Approve or reject join request */
  respondToJoinRequest(
    hangoutId: string,
    userId: string,
    status: 'approved' | 'rejected'
  ): Promise<HangoutJoinRequest> {
    return api.patch<HangoutJoinRequest>(`/hangouts/${hangoutId}/requests/${userId}`, { status });
  },

  /** POST /hangouts/:id/save — Toggle bookmark */
  toggleSave(hangoutId: string): Promise<{ saved: boolean }> {
    return api.post<{ saved: boolean }>(`/hangouts/${hangoutId}/save`);
  },

  /** POST /hangouts/:id/ban */
  banUser(hangoutId: string, userId: string, reason?: string): Promise<{ success: true }> {
    return api.post<{ success: true }>(`/hangouts/${hangoutId}/ban`, { userId, reason });
  },
};
