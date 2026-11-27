import { getTodayKey } from './dayKey';

export interface SessionDelta {
  count: number;
  correct: number;
  bestStreak: number;
}

export interface SessionSaveCoordinator {
  saveNow: () => Promise<void>;
  getUnsaved: () => { count: number; correct: number };
}

export function createSessionSaveCoordinator(
  getSnapshot: () => SessionDelta,
  save: (delta: SessionDelta, markSaved: () => void) => Promise<void>,
  onError: (error: unknown) => void = (error) =>
    console.warn('Failed to save session:', error),
): SessionSaveCoordinator {
  let lastSavedCount = 0;
  let lastSavedCorrect = 0;
  let lastSavedBestStreak = 0;
  let saveQueue = Promise.resolve();

  const saveNow = () => {
    const operation = saveQueue.then(async () => {
      const snapshot = { ...getSnapshot() };
      const unsavedCount = snapshot.count - lastSavedCount;
      const unsavedCorrect = snapshot.correct - lastSavedCorrect;
      const unsavedBestStreak = Math.max(snapshot.bestStreak, lastSavedBestStreak);
      if (unsavedCount <= 0) return;

      const markSaved = () => {
        lastSavedCount = snapshot.count;
        lastSavedCorrect = snapshot.correct;
        lastSavedBestStreak = unsavedBestStreak;
      };

      try {
        await save({
          count: unsavedCount,
          correct: unsavedCorrect,
          bestStreak: unsavedBestStreak,
        }, markSaved);
        markSaved();
      } catch (error) {
        onError(error);
      }
    });

    // Keep the queue usable if an unexpected exception escapes the operation.
    saveQueue = operation.catch(onError);
    return operation;
  };

  return {
    saveNow,
    getUnsaved: () => {
      const snapshot = getSnapshot();
      return {
        count: Math.max(0, snapshot.count - lastSavedCount),
        correct: Math.max(0, snapshot.correct - lastSavedCorrect),
      };
    },
  };
}

export interface DatedSessionDelta extends SessionDelta {
  day: string;
}

export function createDatedSessionSaveCoordinator(
  save: (delta: DatedSessionDelta, markSaved: () => void) => Promise<void>,
  isCurrent: () => boolean = () => true,
  onError?: (error: unknown) => void,
) {
  const days = new Map<string, { snapshot: SessionDelta; coordinator: SessionSaveCoordinator }>();
  return {
    recordAnswer(correct: boolean, bestStreak = 0, day = getTodayKey()) {
      if (!isCurrent()) return;
      let entry = days.get(day);
      if (!entry) {
        const snapshot: SessionDelta = { count: 0, correct: 0, bestStreak: 0 };
        entry = {
          snapshot,
          coordinator: createSessionSaveCoordinator(
            () => snapshot,
            (delta, markSaved) => isCurrent() ? save({ ...delta, day }, markSaved) : Promise.resolve(),
            onError,
          ),
        };
        days.set(day, entry);
      }
      entry.snapshot.count += 1;
      entry.snapshot.correct += correct ? 1 : 0;
      entry.snapshot.bestStreak = Math.max(entry.snapshot.bestStreak, bestStreak);
    },
    async saveNow() {
      if (!isCurrent()) return;
      await Promise.all([...days.values()].map(entry => entry.coordinator.saveNow()));
    },
    getUnsaved(day = getTodayKey()) {
      return days.get(day)?.coordinator.getUnsaved() ?? { count: 0, correct: 0 };
    },
  };
}
