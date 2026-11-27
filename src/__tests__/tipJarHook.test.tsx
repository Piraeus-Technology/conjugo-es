import React from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { render, renderHook, act, waitFor } from '@testing-library/react-native';
import { TipJarProvider, useTipJar } from '../utils/tipJar';
import { __resetIapLifecycleForTests } from '../utils/iapLifecycle';

// The factory must be self-contained: jest.mock is hoisted above imports,
// and the factory runs while tipJar.ts is being imported — before any
// module-level const here would be initialized.
jest.mock('expo-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(() => Promise.resolve()),
  fetchProducts: jest.fn(() =>
    Promise.resolve([
      { id: 'tip_large', type: 'in-app', displayPrice: 'retired price' },
      { id: 'tip_small', type: 'in-app', displayPrice: 'localized store price' },
      { id: 'some_subscription', type: 'subs' },
    ]),
  ),
  getAvailablePurchases: jest.fn(() => Promise.resolve([] as unknown[])),
  getPendingTransactionsIOS: jest.fn(() => Promise.resolve([] as unknown[])),
  requestPurchase: jest.fn(() => Promise.resolve(null)),
  finishTransaction: jest.fn(() => Promise.resolve()),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  ErrorCode: {
    UserCancelled: 'user-cancelled',
    DeferredPayment: 'deferred-payment',
    Pending: 'pending',
    DuplicatePurchase: 'duplicate-purchase',
    ItemNotOwned: 'item-not-owned',
    PurchaseVerificationFinished: 'purchase-verification-finished',
    AlreadyOwned: 'already-owned',
  },
}));

const mockIap = jest.requireMock('expo-iap');

function latestPurchaseHandler(): (purchase: unknown) => Promise<void> {
  const calls = mockIap.purchaseUpdatedListener.mock.calls as unknown as [
    (purchase: unknown) => Promise<void>,
  ][];
  return calls[calls.length - 1][0];
}

function latestErrorHandler(): (error: unknown) => void {
  const calls = mockIap.purchaseErrorListener.mock.calls as unknown as [
    (error: unknown) => void,
  ][];
  return calls[calls.length - 1][0];
}

function purchaseFixture(id: string, productId = 'tip_small', attemptToken?: string, purchaseState = 'purchased') {
  const common = { id, productId, purchaseState, transactionDate: Date.now(), isAutoRenewing: false, quantity: 1 };
  return Platform.OS === 'ios'
    ? { ...common, store: 'apple', storeId: 'apple', transactionId: id, appAccountToken: attemptToken }
    : { ...common, store: 'google', storeId: 'play', purchaseToken: `token-${id}`, obfuscatedAccountIdAndroid: attemptToken };
}

function requestToken(): string {
  const { request } = mockIap.requestPurchase.mock.calls.at(-1)[0];
  return request.apple.appAccountToken;
}

async function renderLoadedTipJar() {
  const utils = renderHook(() => useTipJar(), { wrapper: TipJarProvider });
  await waitFor(() => expect(utils.result.current.product).not.toBeNull());
  return utils;
}

describe('useTipJar', () => {
  let alertSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let appStateSpy: jest.SpyInstance<ReturnType<typeof AppState.addEventListener>, Parameters<typeof AppState.addEventListener>>;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetIapLifecycleForTests();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    appStateSpy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    warnSpy.mockRestore();
    appStateSpy.mockRestore();
    __resetIapLifecycleForTests();
  });

  test('loads and offers only tip_small with the store display price', async () => {
    const { result } = await renderLoadedTipJar();

    expect(mockIap.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
    expect(mockIap.purchaseUpdatedListener).toHaveBeenCalledWith(expect.any(Function), { dedupeTransactionIOS: false });
    expect(mockIap.purchaseUpdatedListener.mock.invocationCallOrder[0]).toBeLessThan(
      mockIap.initConnection.mock.invocationCallOrder[0],
    );
    expect(result.current.unsupported).toBe(false);
    expect(result.current.unavailable).toBe(false);
    expect(mockIap.fetchProducts).toHaveBeenCalledWith({ skus: ['tip_small'], type: 'in-app' });
    expect(result.current.product).toMatchObject({ id: 'tip_small', displayPrice: 'localized store price' });
  });

  test('reports unavailable when the store returns no tip products', async () => {
    mockIap.fetchProducts.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useTipJar(), { wrapper: TipJarProvider });

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.product).toBeNull();
  });

  test('reports unsupported when the package loads without its native module', async () => {
    mockIap.purchaseUpdatedListener.mockImplementationOnce(() => {
      throw new Error("Cannot find native module 'ExpoIap'");
    });
    const { result } = renderHook(() => useTipJar(), { wrapper: TipJarProvider });

    await waitFor(() => expect(result.current.unsupported).toBe(true));
    expect(result.current.unavailable).toBe(true);
    expect(mockIap.initConnection).not.toHaveBeenCalled();
  });

  test('finishes a successful purchase as consumable and thanks the user', async () => {
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(true);
    const purchase = purchaseFixture('tx-1', 'tip_small', requestToken().toUpperCase());
    await act(async () => {
      await latestPurchaseHandler()(purchase);
    });

    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
    expect(result.current.loading).toBe(false);
  });

  test('does not finish purchases outside the tip-jar SKU allowlist', async () => {
    await renderLoadedTipJar();

    await act(async () => {
      await latestPurchaseHandler()(purchaseFixture('tx-other', 'premium_entitlement'));
    });

    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('deduplicates replayed purchase events for the same transaction', async () => {
    await renderLoadedTipJar();

    const purchase = purchaseFixture('tx-dup');
    await act(async () => {
      await Promise.all([latestPurchaseHandler()(purchase), latestPurchaseHandler()(purchase)]);
    });

    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test.each(['ios', 'android'] as const)('finishes both retired tips through the %s listener', async os => {
    const osSpy = jest.replaceProperty(Platform, 'OS', os);
    try {
      await renderLoadedTipJar();
      for (const productId of ['tip_medium', 'tip_large']) {
        const purchase = purchaseFixture(`listener-${os}-${productId}`, productId);
        await act(async () => { await latestPurchaseHandler()(purchase); });
        expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
      }
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
    } finally {
      osSpy.restore();
    }
  });

  test('failed finish alerts once, then a successful replay still thanks the user', async () => {
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    const purchase = purchaseFixture('tx-fail', 'tip_small', requestToken());
    mockIap.finishTransaction
      .mockRejectedValueOnce(new Error('store hiccup'))
      .mockRejectedValueOnce(new Error('store hiccup again'));

    await act(async () => {
      await latestPurchaseHandler()(purchase);
    });
    expect(alertSpy).toHaveBeenCalledWith('Purchase Needs Attention', expect.any(String));
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // Second failure for the same transaction stays quiet (no alert loop)...
    await act(async () => {
      await latestPurchaseHandler()(purchase);
    });
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // The canonical duplicate error also prompts a sweep of unfinished items.
    mockIap.getPendingTransactionsIOS.mockResolvedValueOnce([purchase]);
    await act(async () => { latestErrorHandler()({ code: 'duplicate-purchase' }); });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(3);
    expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
  });

  test('clears busy state after the outcome timeout even when no event arrives', async () => {
    const { result } = await renderLoadedTipJar();
    jest.useFakeTimers();
    try {
      await act(async () => { await result.current.tip(); });
      expect(result.current.loading).toBe(true);
      act(() => { jest.advanceTimersByTime(120_000); });
      expect(result.current.loading).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('two taps during a pending purchase request start only one purchase', async () => {
    let finishRequest!: () => void;
    mockIap.requestPurchase.mockReturnValueOnce(new Promise<void>(resolve => { finishRequest = resolve; }));
    const { result } = await renderLoadedTipJar();
    let firstTap!: Promise<void>;
    await act(async () => {
      firstTap = result.current.tip();
      await result.current.tip();
    });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(mockIap.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: { sku: 'tip_small', appAccountToken: expect.any(String) },
        google: { skus: ['tip_small'], obfuscatedAccountId: requestToken() },
      },
      type: 'in-app',
    });
    expect(result.current.loading).toBe(true);
    act(() => { latestErrorHandler()({ code: 'user-cancelled' }); });
    expect(result.current.loading).toBe(false);
    await act(async () => { finishRequest(); await firstTap; });
  });

  test('tip() surfaces an immediate non-cancellation request failure', async () => {
    mockIap.requestPurchase.mockRejectedValueOnce({
      code: 'network-error',
    });
    const { result } = await renderLoadedTipJar();

    await act(async () => {
      await result.current.tip();
    });

    expect(alertSpy).toHaveBeenCalledWith('Purchase Failed', expect.any(String));
    expect(result.current.loading).toBe(false);
  });

  test('tip() keeps an immediate cancellation silent', async () => {
    mockIap.requestPurchase.mockRejectedValueOnce({
      code: 'user-cancelled',
    });
    const { result } = await renderLoadedTipJar();

    await act(async () => {
      await result.current.tip();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  test('purchase errors clear loading and only alert for non-cancel errors', async () => {
    const { result } = await renderLoadedTipJar();

    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(true);
    act(() => {
      latestErrorHandler()({ code: 'user-cancelled' });
    });
    expect(result.current.loading).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();

    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(true);
    act(() => {
      latestErrorHandler()({ code: 'unknown' });
    });
    expect(alertSpy).toHaveBeenCalledWith('Purchase Failed', expect.any(String));
  });

  test('Android startup sweep finishes cached tips once, skipping other SKUs and claimed transactions', async () => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const cachedTip = purchaseFixture('tx-cached', 'tip_medium');
      const otherRetiredTip = purchaseFixture('tx-retired-large', 'tip_large');
      const otherSku = purchaseFixture('tx-other-sku', 'not_a_tip');
      mockIap.getAvailablePurchases.mockResolvedValueOnce([cachedTip, otherRetiredTip, otherSku]);

      render(<TipJarProvider>{null}</TipJarProvider>);
      await waitFor(() => expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2));
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({
        purchase: cachedTip,
        isConsumable: true,
      });
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: otherRetiredTip, isConsumable: true });

      // A listener replay of the same transaction is skipped — already claimed.
      await act(async () => {
        await latestPurchaseHandler()(cachedTip);
      });
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
    } finally {
      osSpy.restore();
    }
  });

  test.each(['error', 'receipt'] as const)('Play already-owned %s recovers silently and clears loading', async path => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const { result } = await renderLoadedTipJar();
      const owned = purchaseFixture(`android-owned-${path}`);
      if (path === 'error') {
        mockIap.getAvailablePurchases.mockResolvedValueOnce([owned]);
        mockIap.requestPurchase.mockRejectedValueOnce({ code: 'already-owned', productId: 'tip_small' });
      } else {
        mockIap.requestPurchase.mockResolvedValueOnce([owned]);
      }
      await act(async () => { await result.current.tip(); });
      await waitFor(() => expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: owned, isConsumable: true }));
      expect(result.current.loading).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      osSpy.restore();
    }
  });

  test('Play item-not-owned from the finisher remains claimed and silent on replay', async () => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const { result } = await renderLoadedTipJar();
      await act(async () => { await result.current.tip(); });
      const purchase = purchaseFixture('android-consumed', 'tip_small', requestToken());
      mockIap.finishTransaction.mockRejectedValueOnce({ code: 'item-not-owned' });
      await act(async () => {
        const receive = latestPurchaseHandler();
        await receive(purchase);
        await receive(purchase);
      });
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      osSpy.restore();
    }
  });

  test('retrying iOS recovery on foreground finishes a retired purchase silently', async () => {
    let foreground: (state: string) => void = () => {};
    appStateSpy.mockImplementation((_type, listener) => {
      foreground = listener as typeof foreground;
      return { remove: jest.fn() };
    });
    const recovered = purchaseFixture('ios-foreground', 'tip_large');
    mockIap.getPendingTransactionsIOS.mockRejectedValueOnce(new Error('not ready')).mockResolvedValueOnce([recovered]);
    render(<TipJarProvider>{null}</TipJarProvider>);
    await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    await act(async () => { foreground('active'); });
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: recovered, isConsumable: true });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('Apple deferred payment clears the busy state and shows the pending message once', async () => {
    mockIap.requestPurchase.mockImplementationOnce(async () => {
      const error = { code: 'deferred-payment', productId: 'tip_small' };
      latestErrorHandler()(error);
      throw error;
    });
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(false);
    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Purchase Pending', expect.any(String));
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  test('Play pending payment stays unconsumed until the same purchase is paid', async () => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      mockIap.getAvailablePurchases.mockResolvedValueOnce([purchaseFixture('android-recovered-pending', 'tip_medium', undefined, 'pending')]);
      const { result } = await renderLoadedTipJar();
      await act(async () => { await result.current.tip(); });
      const token = requestToken();
      await act(async () => { await latestPurchaseHandler()(purchaseFixture('android-pending', 'tip_small', token, 'pending')); });
      expect(result.current.loading).toBe(false);
      expect(mockIap.finishTransaction).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Purchase Pending', expect.any(String));
      await act(async () => { await latestPurchaseHandler()(purchaseFixture('android-pending', 'tip_small', token)); });
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
    } finally {
      osSpy.restore();
    }
  });

});
