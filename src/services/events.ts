/**
 * Events Service — Maps to /communities/:slug/events/* endpoints
 */
import api from './api';
import { EventItem, CreateEventDto, PaginationParams } from '../types';

export const eventsService = {
  /** GET /communities/:slug/events */
  listByCommunity(slug: string, params?: PaginationParams): Promise<EventItem[]> {
    return api.get<EventItem[]>(`/communities/${slug}/events`, params as Record<string, any>);
  },

  /** GET /communities/:slug/events/:eventId */
  getById(slug: string, eventId: string): Promise<EventItem> {
    return api.get<EventItem>(`/communities/${slug}/events/${eventId}`);
  },

  /** POST /communities/:slug/events */
  create(slug: string, dto: CreateEventDto): Promise<EventItem> {
    return api.post<EventItem>(`/communities/${slug}/events`, dto);
  },

  /** PATCH /communities/:slug/events/:eventId */
  update(slug: string, eventId: string, dto: Partial<CreateEventDto>): Promise<EventItem> {
    return api.patch<EventItem>(`/communities/${slug}/events/${eventId}`, dto);
  },

  /** DELETE /communities/:slug/events/:eventId */
  delete(slug: string, eventId: string): Promise<{ success: true }> {
    return api.delete<{ success: true }>(`/communities/${slug}/events/${eventId}`);
  },

  /** POST /communities/:slug/events/:eventId/join */
  join(slug: string, eventId: string): Promise<{ joined: boolean; participantsCount: number }> {
    return api.post<{ joined: boolean; participantsCount: number }>(`/communities/${slug}/events/${eventId}/join`);
  },

  /** POST /communities/:slug/events/:eventId/leave */
  leave(slug: string, eventId: string): Promise<{ success: true }> {
    return api.post<{ success: true }>(`/communities/${slug}/events/${eventId}/leave`);
  },

  /** POST /communities/:slug/events/:eventId/save — Toggle bookmark */
  toggleSave(slug: string, eventId: string): Promise<{ saved: boolean }> {
    return api.post<{ saved: boolean }>(`/communities/${slug}/events/${eventId}/save`);
  },

  /** POST /communities/:slug/events/:eventId/approve — Admin/Mod/Owner */
  approve(slug: string, eventId: string): Promise<EventItem> {
    return api.post<EventItem>(`/communities/${slug}/events/${eventId}/approve`);
  },

  /** POST /communities/:slug/events/:eventId/reject — Admin/Mod/Owner */
  reject(slug: string, eventId: string, reason?: string): Promise<EventItem> {
    return api.post<EventItem>(`/communities/${slug}/events/${eventId}/reject`, { reason });
  },

  /** GET /admin/communities/:slug/pending-events — Admin/Mod/Owner */
  listPending(slug: string, params?: PaginationParams): Promise<EventItem[]> {
    return api.get<EventItem[]>(`/admin/communities/${slug}/pending-events`, params as Record<string, any>);
  },
};
