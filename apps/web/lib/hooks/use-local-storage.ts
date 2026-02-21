import { useCallback, useSyncExternalStore } from "react";

// Module-level registry: notifies all hooks using the same key when value changes
const subscribers = new Map<string, Set<() => void>>();

// Cache to maintain referential stability for parsed objects/arrays
const cache = new Map<string, { raw: string | null; value: unknown }>();

function emitChange(key: string) {
  subscribers.get(key)?.forEach((cb) => cb());
}

/**
 * React hook for localStorage with SSR-safe hydration via useSyncExternalStore.
 * Returns [value, setValue] like useState.
 *
 * - Server renders with `defaultValue` (no hydration mismatch)
 * - Client reads from localStorage immediately
 * - Maintains referential stability for objects/arrays
 * - Syncs across multiple hook instances using the same key
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)!.add(callback);
      return () => {
        subscribers.get(key)?.delete(callback);
      };
    },
    [key],
  );

  const getSnapshot = useCallback((): T => {
    const raw = localStorage.getItem(key);
    const cached = cache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;
    if (raw === null) {
      cache.set(key, { raw: null, value: defaultValue });
      return defaultValue;
    }
    try {
      const parsed = JSON.parse(raw) as T;
      cache.set(key, { raw, value: parsed });
      return parsed;
    } catch {
      cache.set(key, { raw: null, value: defaultValue });
      return defaultValue;
    }
    // defaultValue is intentionally excluded — only the initial default matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const getServerSnapshot = useCallback((): T => defaultValue,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const current = getSnapshot();
      const resolved =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(current)
          : newValue;
      const raw = JSON.stringify(resolved);
      localStorage.setItem(key, raw);
      cache.set(key, { raw, value: resolved });
      emitChange(key);
    },
    [key, getSnapshot],
  );

  return [value, setValue];
}
