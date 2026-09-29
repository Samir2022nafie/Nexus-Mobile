import { api } from './api';

export interface MapLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface MapCommunityItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  profilePictureUrl?: string;
  category: string;
  memberCount: number;
  location: MapLocation;
}

export interface MapEventItem {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  startsAt: string;
  endsAt?: string;
  communityName: string;
  communitySlug: string;
  category?: string;
  location: MapLocation;
}

export interface MapHangoutItem {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  startsAt: string;
  endsAt?: string;
  joinType: string;
  maxParticipants?: number;
  participantCount: number;
  category?: string;
  creator: {
    id: string;
    username: string;
    name: string;
    profilePictureUrl?: string;
  };
  location: MapLocation;
}

export interface MapUserItem {
  id: string;
  username: string;
  name: string;
  profilePictureUrl?: string;
  trustScore: number;
  isPrivate: boolean;
  location: MapLocation;
}

export interface ExploreMapResponse {
  communities: MapCommunityItem[];
  events: MapEventItem[];
  hangouts: MapHangoutItem[];
  users: MapUserItem[];
}

export const locationsService = {
  getExploreMap: () => {
    return api.get<ExploreMapResponse>('/locations/explore');
  },
};
