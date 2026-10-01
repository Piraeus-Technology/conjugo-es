import { create } from 'zustand';

// Invalidate mounted practice sessions before deleting persisted progress.
// The generation also prevents a delayed autosave from recreating old data.
export const usePracticeResetStore = create(() => ({ version: 0, resetting: false }));

export function isCurrentPracticeSession(version: number): boolean {
  const current = usePracticeResetStore.getState();
  return current.version === version && !current.resetting;
}
