"use client";

import { useState } from "react";
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

// Tracks which row (by id) has an action in flight, e.g. a per-row Delete button, and its last error.
export function usePendingId() {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: number, action: () => Promise<unknown>) {
    setPendingId(id);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return { pendingId, error, run };
}
