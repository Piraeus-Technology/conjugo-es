import {
  createSessionSaveCoordinator,
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
