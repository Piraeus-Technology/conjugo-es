import {
  __resetIapLifecycleForTests,
  hasPendingIapEnd,
  releaseIapConnection,
  retainIapConnection,
  waitForPendingIapEnd,
} from '../utils/iapLifecycle';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('IAP lifecycle ref counting', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetIapLifecycleForTests();
  });

  afterEach(() => {
    __resetIapLifecycleForTests();
    jest.useRealTimers();
  });

  test('cancels a scheduled end when the tip jar remounts quickly', () => {
    const endConnection = jest.fn();

    retainIapConnection();
    releaseIapConnection(endConnection, 100);
    retainIapConnection();

    jest.advanceTimersByTime(100);

    expect(endConnection).not.toHaveBeenCalled();
  });

  test('exposes and clears an in-flight end so callers can wait before init', async () => {
    const end = deferred<void>();
    const endConnection = jest.fn(() => end.promise);

    retainIapConnection();
    releaseIapConnection(endConnection, 0);
    jest.advanceTimersByTime(0);
    await Promise.resolve();

    expect(endConnection).toHaveBeenCalledTimes(1);
    expect(hasPendingIapEnd()).toBe(true);

    const waitPromise = waitForPendingIapEnd();
    end.resolve();
    await waitPromise;

    expect(hasPendingIapEnd()).toBe(false);
  });
});
