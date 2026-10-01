import {
  createSessionSaveCoordinator,
  createDatedSessionSaveCoordinator,
  type SessionDelta,
} from '../utils/sessionSaveCoordinator';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('session autosave coordination', () => {
  test('keeps local answer dates across midnight and overlapping saves', async () => {
    const save = jest.fn(async () => {});
    const coordinator = createDatedSessionSaveCoordinator(save);
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date(2026, 8, 30, 23, 58));
      coordinator.recordAnswer(true, 1);
      coordinator.recordAnswer(false);
      jest.setSystemTime(new Date(2026, 9, 1, 0, 1));
      coordinator.recordAnswer(true, 1);
      await Promise.all([coordinator.saveNow(), coordinator.saveNow()]);
      expect(save.mock.calls).toEqual([
        [{ day: '2026-09-30', count: 2, correct: 1, bestStreak: 1 }],
        [{ day: '2026-10-01', count: 1, correct: 1, bestStreak: 1 }],
      ]);
      expect(coordinator.getUnsaved()).toEqual({ count: 0, correct: 0 });
    } finally {
      jest.useRealTimers();
    }
  });

  test('invalidated practice sessions cannot save pre-reset deltas', async () => {
    let current = true;
    const save = jest.fn(async () => {});
    const coordinator = createDatedSessionSaveCoordinator(save, () => current);
    coordinator.recordAnswer(true, 3);
    const pending = coordinator.saveNow();
    current = false;
    await pending;
    await coordinator.saveNow();
    expect(save).not.toHaveBeenCalled();
  });

  test('a failed save cannot roll the cursor behind a later successful save', async () => {
    let snapshot: SessionDelta = { count: 5, correct: 4, bestStreak: 3 };
    const firstWrite = deferred();
    const savedDeltas: SessionDelta[] = [];
    const save = jest
      .fn<Promise<void>, [SessionDelta]>()
      .mockImplementationOnce((delta) => {
        savedDeltas.push(delta);
        return firstWrite.promise;
      })
      .mockImplementation(async (delta) => {
        savedDeltas.push(delta);
      });
    const coordinator = createSessionSaveCoordinator(
      () => snapshot,
      save,
      jest.fn(),
    );

    const firstSave = coordinator.saveNow();
    await Promise.resolve();
    snapshot = { count: 8, correct: 7, bestStreak: 5 };
    const overlappingSave = coordinator.saveNow();

    firstWrite.reject(new Error('disk full'));
    await Promise.all([firstSave, overlappingSave]);

    snapshot = { count: 9, correct: 8, bestStreak: 5 };
    await coordinator.saveNow();

    expect(savedDeltas).toEqual([
      { count: 5, correct: 4, bestStreak: 3 },
      { count: 8, correct: 7, bestStreak: 5 },
      { count: 1, correct: 1, bestStreak: 5 },
    ]);
  });
});
