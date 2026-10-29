"use client";

import { useEffect, useState } from "react";
import { getErrorMessage } from "./stockUtils";

// Tracks one async action's pending state and error message. `run` resolves to whether it succeeded.
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, setError, run };
}

// Tracks which row (by id) has an action in flight, e.g. a per-row Delete button.
export function usePendingId() {
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function run(id: number, action: () => Promise<unknown>) {
    setPendingId(id);
    try {
      await action();
    } finally {
      setPendingId(null);
    }
  }

  return { pendingId, run };
}

// Loads data for `key` whenever it changes (skipped while it's null), ignoring results from stale loads.
export function useAsyncData<K, T>(key: K | null, load: (key: K) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (key == null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    load(key)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `load` is usually an inline function; reloading is driven by `key` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error };
}
