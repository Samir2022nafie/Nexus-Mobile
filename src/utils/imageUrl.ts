import { uploadService } from '../services/upload';

/**
 * Synchronous client-side extraction for Google Images imgurl parameter and clean direct links.
 */
export function extractDirectImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  const match = trimmed.match(/[?&]imgurl=([^&]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {}
  }
  return trimmed;
}

/**
 * Asynchronously resolves redirect URLs (share.google, pin.it, etc.) into direct image URLs.
 */
export async function resolveImageUrl(rawUrl?: string | null): Promise<string> {
  const direct = extractDirectImageUrl(rawUrl);
  if (!direct) return '';
  if (/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(direct)) {
    return direct;
  }
  try {
    return await uploadService.resolveUrl(direct);
  } catch {
    return direct;
  }
}
