/**
 * Nexus Unified Type System
 * Aligned to the NestJS backend Prisma schema & API contract response shapes.
 * Replaces the conflicting batch-1 and batch-2 type definitions.
 */

// ============================================================================
// Auth
// ============================================================================

export interface RegisterDto {
  username: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
}

export interface LoginDto {
  identifier: string; // email or phone
  password: string;
}

export interface OAuthLoginDto {
  idToken: string;
  email?: string;
  birthDate?: string;
}

export interface VerifyPhoneDto {
  phoneNumber: string;
}

export interface ConfirmPhoneDto {
  phoneNumber: string;
  otp: string;
}

export interface LinkExternalDto {
  provider: 'google' | 'apple' | 'telegram';
  idToken: string;
}

export type OAuthProvider = 'google' | 'apple' | 'telegram';

export interface AuthResponse {
  user: User;
  token: string;
}

// ============================================================================
// Users
// ============================================================================

export interface User {
  id: string;
  username: string;
  email?: string | null;
  phone_number?: string | null;
  phone_verified_at?: string | null;
  first_name: string;
  last_name: string;
  name?: string | null;
  birth_date: string;
  bio?: string | null;
  profile_picture_url?: string | null;
  trust_score: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  name: string;
  firstName: string;
  lastName: string;
  bio?: string | null;
  profilePictureUrl?: string | null;
  createdAt: string;
  stats: {
    followersCount: number;
    followingCount: number;
    communitiesCount: number;
  };
  isFollowing: boolean;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  bio?: string;
  profilePictureUrl?: string;
}

// ============================================================================
// Communities
// ============================================================================

export interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  creator_id: string;
  banner_url?: string | null;
  profile_picture_url?: string | null;
  is_private: boolean;
  memberCount: number;
  isMember?: boolean;
  myRole?: CommunityRole | null;
  category: {
    id: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

export type CommunityRole = 'member' | 'moderator' | 'admin' | 'owner';

export interface CreateCommunityDto {
  name: string;
  slug: string;
  description?: string;
  rules?: string;
  categoryId: string;
  bannerUrl?: string;
  profilePictureUrl?: string;
  isPrivate?: boolean;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  rules?: string;
  isPrivate?: boolean;
}

export interface CommunityMember {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  appointedAt?: string | null;
  appointedBy?: string | null;
  user: {
    id: string;
    username: string;
    name: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string | null;
  };
}

export interface ManagedCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  bannerUrl?: string | null;
  profilePictureUrl?: string | null;
  isPrivate: boolean;
  memberCount: number;
  role: CommunityRole;
}

// ============================================================================
// Posts
// ============================================================================

export interface Post {
  id: string;
  communityId: string;
  subcommunityId?: string | null;
  title?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  community?: {
    id: string;
    name: string;
    slug: string;
  };
  tags: string[];
  reactionCount: number;
  hasReacted: boolean;
  hasSaved: boolean;
  commentCount: number;
  comments?: Comment[];
}

export interface PostAuthor {
  id: string;
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string | null;
}

export interface CreatePostDto {
  title?: string;
  content?: string;
  mediaUrl?: string;
  tags?: string[];
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  mediaUrl?: string;
  tags?: string[];
}

// ============================================================================
// Comments
// ============================================================================

export interface Comment {
  id: string;
  postId: string;
  parentCommentId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  reactionCount: number;
  hasReacted: boolean;
  replyCount?: number;
  replies?: Comment[];
}

export interface CreateCommentDto {
  content: string;
  parentCommentId?: string;
}

export interface UpdateCommentDto {
  content: string;
}

// ============================================================================
// Events
// ============================================================================

export type VisibilityScope = 'public' | 'community' | 'subcommunity';
export type EventApprovalStatus = 'proposed' | 'approved' | 'rejected';

export interface EventItem {
  id: string;
  communityId: string;
  communitySlug?: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  visibility: VisibilityScope;
  approvalStatus: EventApprovalStatus;
  isVerified: boolean;
  maxParticipants?: number | null;
  participantsCount: number;
  isParticipant: boolean;
  isSaved: boolean;
  creator: PostAuthor;
  location?: {
    placeName: string;
    latitude: number;
    longitude: number;
  } | null;
}

export interface CreateEventDto {
  title: string;
  description?: string;
  coverImageUrl?: string;
  startsAt: string;
  endsAt?: string;
  visibility?: VisibilityScope;
  maxParticipants?: number;
}

// ============================================================================
// Hangouts
// ============================================================================

export type HangoutJoinType = 'open' | 'request_based';

export interface HangoutItem {
  id: string;
  communityId?: string | null;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  visibility: VisibilityScope;
  joinType: HangoutJoinType;
  maxParticipants?: number | null;
  participantsCount: number;
  isParticipant: boolean;
  isSaved: boolean;
  creator: PostAuthor;
  location?: {
    placeName: string;
    latitude: number;
    longitude: number;
  } | null;
}

export interface CreateHangoutDto {
  title: string;
  description?: string;
  coverImageUrl?: string;
  startsAt: string;
  endsAt?: string;
  visibility?: VisibilityScope;
  joinType?: HangoutJoinType;
  maxParticipants?: number;
  communityId?: string;
}

export interface HangoutJoinRequest {
  hangoutId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  user: PostAuthor;
}

// ============================================================================
// Notifications
// ============================================================================

export type NotificationType =
  | 'post_reaction'
  | 'comment_reply'
  | 'event_approved'
  | 'event_reminder'
  | 'hangout_request'
  | 'hangout_approved'
  | 'report_resolved'
  | 'moderation_action'
  | 'follow'
  | 'mention';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

// ============================================================================
// Reports
// ============================================================================

export interface CreateReportDto {
  reason: string;
  reportedUserId?: string;
  reportedPostId?: string;
  reportedCommentId?: string;
  reportedEventId?: string;
  reportedHangoutId?: string;
}

// ============================================================================
// Upload
// ============================================================================

export interface PresignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

// ============================================================================
// Pagination & API
// ============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      code: string;
      message: string;
      path: string[];
    }>;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface CommunityListParams extends PaginationParams {
  categoryId?: string;
  q?: string;
}

export interface PostListParams extends PaginationParams {
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface NotificationListParams extends PaginationParams {
  unreadOnly?: boolean;
}
