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
  save: (delta: SessionDelta) => Promise<void>,
  onError: (error: unknown) => void = (error) =>
    console.warn('Failed to save session:', error),
): SessionSaveCoordinator {
  let lastSavedCount = 0;
  let lastSavedCorrect = 0;
  let lastSavedBestStreak = 0;
  let saveQueue = Promise.resolve();

  const saveNow = () => {
    const operation = saveQueue.then(async () => {
      const snapshot = getSnapshot();
      const unsavedCount = snapshot.count - lastSavedCount;
      const unsavedCorrect = snapshot.correct - lastSavedCorrect;
      const unsavedBestStreak = Math.max(snapshot.bestStreak, lastSavedBestStreak);
      if (unsavedCount <= 0) return;

      const previous = {
        count: lastSavedCount,
        correct: lastSavedCorrect,
        bestStreak: lastSavedBestStreak,
      };
      lastSavedCount = snapshot.count;
      lastSavedCorrect = snapshot.correct;
      lastSavedBestStreak = unsavedBestStreak;

      try {
        await save({
          count: unsavedCount,
          correct: unsavedCorrect,
          bestStreak: unsavedBestStreak,
        });
      } catch (error) {
        // Saves execute serially, so no later successful claim can exist
        // while this rollback happens.
        lastSavedCount = previous.count;
        lastSavedCorrect = previous.correct;
        lastSavedBestStreak = previous.bestStreak;
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
