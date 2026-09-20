/**
 * Category Definitions & Utilities — Aligned 1-to-1 with Backend-main Prisma seed
 */

export interface CategoryDef {
  id: string;
  name: string;
  label: string;      // Shortened name for tight spaces (carousels, cards, pills)
  fullLabel: string;  // Full display name
  icon: string;
}

export const BACKEND_CATEGORIES: CategoryDef[] = [
  { id: 'ccec8541-95da-4bb4-aadb-199e5fe633d8', name: 'technology', label: 'Tech', fullLabel: 'Technology', icon: 'computer' },
  { id: 'acc7a2e3-c005-4bd9-9258-0926b9842d75', name: 'gaming', label: 'Gaming', fullLabel: 'Gaming', icon: 'sports-esports' },
  { id: 'dea55590-5148-4723-9063-008edbe3adf7', name: 'anime_manga', label: 'Anime', fullLabel: 'Anime & Manga', icon: 'auto-stories' },
  { id: '13615218-a8d8-4f55-89ee-093048b61ee2', name: 'movies_tv', label: 'Movies', fullLabel: 'Movies & TV', icon: 'movie' },
  { id: '78373e34-693b-4c7b-8feb-f90bca7bf0cf', name: 'arts_creativity', label: 'Art', fullLabel: 'Arts & Creativity', icon: 'palette' },
  { id: 'f144d4ed-837e-4697-bd18-4d6bed5c1658', name: 'education_study_groups', label: 'Education', fullLabel: 'Education & Study', icon: 'school' },
  { id: '3820344b-4b67-497b-8048-703419198629', name: 'books_writing', label: 'Books', fullLabel: 'Books & Writing', icon: 'menu-book' },
  { id: '7579faeb-5385-436a-b2a7-24a087233220', name: 'music_entertainment', label: 'Music', fullLabel: 'Music & Entertainment', icon: 'music-note' },
  { id: '5362e75a-a594-4818-b791-1138d380284e', name: 'health_fitness', label: 'Fitness', fullLabel: 'Health & Fitness', icon: 'fitness-center' },
  { id: '1a55efee-d85e-4dab-b299-8984d9841ebf', name: 'outdoor_adventure', label: 'Outdoor', fullLabel: 'Outdoor & Adventure', icon: 'terrain' },
  { id: '868a9d88-bee0-44bb-889a-d12b4d8c1d71', name: 'sports', label: 'Sports', fullLabel: 'Sports', icon: 'sports-soccer' },
  { id: '5b07025d-c09a-43ad-af8c-75b11601bd48', name: 'social_lifestyle', label: 'Social', fullLabel: 'Social & Lifestyle', icon: 'groups' },
  { id: 'c4e7d532-7709-4e18-b6ae-cee521298e65', name: 'culture_language', label: 'Culture', fullLabel: 'Culture & Language', icon: 'translate' },
  { id: '3eb224da-e96f-44ad-a231-0d449e3ac69e', name: 'other', label: 'Other', fullLabel: 'Other', icon: 'more-horiz' },
];

/**
 * Format and optionally shorten category name to avoid 2-line wrap in tight spaces.
 * Example: 'music_entertainment' -> 'Music' (short) or 'Music & Entertainment' (full).
 */
export function formatCategoryName(category: any, shorten: boolean = true): string {
  if (!category) return 'General';
  const raw = typeof category === 'object' ? category.name : category;
  if (!raw || typeof raw !== 'string') return 'General';

  const normalized = raw.toLowerCase().trim();
  const match = BACKEND_CATEGORIES.find(
    (c) => c.name === normalized || c.id === normalized || c.label.toLowerCase() === normalized
  );

  if (match) {
    return shorten ? match.label : match.fullLabel;
  }

  // Fallback cleanup if not in predefined list
  const formatted = raw.replace(/_/g, ' ').trim();
  if (shorten) {
    return formatted.split(' ')[0].replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return formatted.replace(/\b\w/g, (c) => c.toUpperCase());
}
