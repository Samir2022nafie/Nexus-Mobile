import React, { createContext, useContext, useState, useCallback } from 'react';
import { postsService } from '../services/posts';

interface PostStateContextType {
  likedPosts: Record<string, boolean>;
  savedPosts: Record<string, boolean>;
  commentCounts: Record<string, number>;
  likesCounts: Record<string, number>;
  setPostLiked: (postId: string, isLiked: boolean, count?: number) => void;
  setPostSaved: (postId: string, isSaved: boolean) => void;
  setPostCommentCount: (postId: string, count: number) => void;
  updatePostCommentCount: (postId: string, delta: number) => void;
  toggleLike: (postId: string, currentlyLiked: boolean, baseCount: number) => Promise<boolean>;
  toggleSave: (postId: string, currentlySaved: boolean) => Promise<boolean>;
}

const PostStateContext = createContext<PostStateContextType>({
  likedPosts: {},
  savedPosts: {},
  commentCounts: {},
  likesCounts: {},
  setPostLiked: () => {},
  setPostSaved: () => {},
  setPostCommentCount: () => {},
  updatePostCommentCount: () => {},
  toggleLike: async () => false,
  toggleSave: async () => false,
});

export const PostStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [likesCounts, setLikesCounts] = useState<Record<string, number>>({});

  const setPostLiked = useCallback((postId: string, isLiked: boolean, count?: number) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: isLiked }));
    if (count !== undefined) {
      setLikesCounts((prev) => ({ ...prev, [postId]: count }));
    }
  }, []);

  const setPostSaved = useCallback((postId: string, isSaved: boolean) => {
    setSavedPosts((prev) => ({ ...prev, [postId]: isSaved }));
  }, []);

  const setPostCommentCount = useCallback((postId: string, count: number) => {
    setCommentCounts((prev) => ({ ...prev, [postId]: Math.max(0, count) }));
  }, []);

  const updatePostCommentCount = useCallback((postId: string, delta: number) => {
    setCommentCounts((prev) => {
      const current = prev[postId] ?? 0;
      return { ...prev, [postId]: Math.max(0, current + delta) };
    });
  }, []);

  const toggleLike = useCallback(
    async (postId: string, currentlyLiked: boolean, baseCount: number) => {
      const nextLiked = !currentlyLiked;
      const nextCount = Math.max(0, baseCount + (nextLiked ? 1 : -1));

      setLikedPosts((prev) => ({ ...prev, [postId]: nextLiked }));
      setLikesCounts((prev) => ({ ...prev, [postId]: nextCount }));

      try {
        const res = await postsService.toggleReaction(postId);
        if (res && typeof res.reacted === 'boolean') {
          setLikedPosts((prev) => ({ ...prev, [postId]: res.reacted }));
          return res.reacted;
        }
        return nextLiked;
      } catch {
        // Revert on error
        setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
        setLikesCounts((prev) => ({ ...prev, [postId]: baseCount }));
        return currentlyLiked;
      }
    },
    []
  );

  const toggleSave = useCallback(async (postId: string, currentlySaved: boolean) => {
    const nextSaved = !currentlySaved;
    setSavedPosts((prev) => ({ ...prev, [postId]: nextSaved }));

    try {
      const res = await postsService.toggleSave(postId);
      if (res && typeof res.saved === 'boolean') {
        setSavedPosts((prev) => ({ ...prev, [postId]: res.saved }));
        return res.saved;
      }
      return nextSaved;
    } catch {
      // Revert on error
      setSavedPosts((prev) => ({ ...prev, [postId]: currentlySaved }));
      return currentlySaved;
    }
  }, []);

  return (
    <PostStateContext.Provider
      value={{
        likedPosts,
        savedPosts,
        commentCounts,
        likesCounts,
        setPostLiked,
        setPostSaved,
        setPostCommentCount,
        updatePostCommentCount,
        toggleLike,
        toggleSave,
      }}
    >
      {children}
    </PostStateContext.Provider>
  );
};

export const usePostState = () => useContext(PostStateContext);
export default PostStateContext;
