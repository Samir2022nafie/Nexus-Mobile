/**
 * Upload Service — Maps to POST /upload/presigned
 */
import api from './api';
import { PresignedUploadResponse } from '../types';

export const uploadService = {
  /** POST /upload/presigned — Get presigned upload URL */
  getPresignedUrl(filename: string, contentType: string): Promise<PresignedUploadResponse> {
    return api.post<PresignedUploadResponse>('/upload/presigned', { filename, contentType });
  },

  /** Upload file directly to storage using presigned URL */
  async uploadFile(presignedUrl: string, fileUri: string, contentType: string): Promise<void> {
    const response = await fetch(fileUri);
    const blob = await response.blob();

    await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });
  },
};
