/**
 * useSafeRouter — Navigation hook with built-in multi-tap / rapid double-click guard.
 * Prevents duplicate screen pushes when users rapidly tap cards or links.
 */
import { useRouter as useExpoRouter, Href } from 'expo-router';
import { useCallback } from 'react';

let globalLastNavTime = 0;
const DEFAULT_COOLDOWN_MS = 850;

export function useSafeRouter() {
  const router = useExpoRouter();

  const safePush = useCallback(
    (href: Href) => {
      const now = Date.now();
      if (now - globalLastNavTime < DEFAULT_COOLDOWN_MS) {
        return; // Suppress duplicate rapid clicks
      }
      globalLastNavTime = now;
      router.push(href);
    },
    [router]
  );

  const safeNavigate = useCallback(
    (href: Href) => {
      const now = Date.now();
      if (now - globalLastNavTime < DEFAULT_COOLDOWN_MS) {
        return;
      }
      globalLastNavTime = now;
      (router as any).navigate(href);
    },
    [router]
  );

  const safeReplace = useCallback(
    (href: Href) => {
      const now = Date.now();
      if (now - globalLastNavTime < DEFAULT_COOLDOWN_MS) {
        return;
      }
      globalLastNavTime = now;
      router.replace(href);
    },
    [router]
  );

  const safeBack = useCallback(() => {
    const now = Date.now();
    if (now - globalLastNavTime < 450) {
      return;
    }
    globalLastNavTime = now;
    if (router.canGoBack()) {
      router.back();
    } else {
      (router as any).navigate('/(tabs)');
    }
  }, [router]);

  return {
    ...router,
    push: safePush,
    navigate: safeNavigate,
    replace: safeReplace,
    back: safeBack,
  };
}

export function safeNavigateAction(fn: () => void, cooldown = DEFAULT_COOLDOWN_MS) {
  const now = Date.now();
  if (now - globalLastNavTime < cooldown) {
    return;
  }
  globalLastNavTime = now;
  fn();
}
