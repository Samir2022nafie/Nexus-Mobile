/**
 * Smart Date Helpers for Nexus Mobile
 * Handles both Prisma field names (starts_at, ends_at) and API JSON names (startsAt, endsAt)
 */

export interface DateCategory {
  status: 'today' | 'future' | 'passed';
  dateText: string;
  sortKey: number;
  isPassed: boolean;
  timeStr: string;
}

export function categorizeItemByDate(item: any): DateCategory {
  const rawStarts = item.startsAt || item.starts_at;
  const rawEnds = item.endsAt || item.ends_at;
  const now = new Date();

  if (!rawStarts) {
    return {
      status: 'future',
      dateText: 'Upcoming',
      sortKey: 9999999999999,
      isPassed: false,
      timeStr: 'TBA',
    };
  }

  const startDate = new Date(rawStarts);
  const endDate = rawEnds ? new Date(rawEnds) : null;

  const isToday =
    startDate.getFullYear() === now.getFullYear() &&
    startDate.getMonth() === now.getMonth() &&
    startDate.getDate() === now.getDate();

  const isOngoing = startDate <= now && Boolean(endDate && endDate > now);
  const cutoff = endDate || new Date(startDate.getTime() + 3 * 3600 * 1000);
  const isPassed = !isToday && !isOngoing && cutoff < now;

  const timeStr = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday || isOngoing) {
    return {
      status: 'today',
      dateText: `Today • ${timeStr}`,
      sortKey: Math.abs(startDate.getTime() - now.getTime()),
      isPassed: false,
      timeStr,
    };
  }

  if (isPassed) {
    return {
      status: 'passed',
      dateText: 'Passed',
      sortKey: startDate.getTime(),
      isPassed: true,
      timeStr,
    };
  }

  const dateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return {
    status: 'future',
    dateText: `${dateStr} • ${timeStr}`,
    sortKey: startDate.getTime(),
    isPassed: false,
    timeStr,
  };
}

export function sortItemsByDate<T = any>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const catA = categorizeItemByDate(a);
    const catB = categorizeItemByDate(b);

    const rank = { today: 1, future: 2, passed: 3 };
    if (rank[catA.status] !== rank[catB.status]) {
      return rank[catA.status] - rank[catB.status];
    }

    if (catA.status === 'today') {
      return catA.sortKey - catB.sortKey;
    }

    return catA.sortKey - catB.sortKey;
  });
}
