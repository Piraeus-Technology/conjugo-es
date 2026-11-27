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
    NotPrepared: 'not-prepared',
    ServiceDisconnected: 'service-disconnected',
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

  async function foreground() {
    const listener = appStateSpy.mock.calls.find(([event]) => event === 'change')?.[1];
    expect(listener).toBeDefined();
    await act(async () => { listener?.('active'); });
  }

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

  test.each([
    'empty', 'failure', 'Play placeholder', 'missing display price', 'unavailable with price',
  ] as const)('keeps the tip unavailable after %s and reloads on foreground', async outcome => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const product = { id: 'tip_small', type: 'in-app', displayPrice: '$0.99' };
      const failedProducts = {
        empty: [],
        'Play placeholder': [{ ...product, productStatusAndroid: 'not-found', displayPrice: '', price: null }],
        'missing display price': [{ ...product, productStatusAndroid: 'ok', displayPrice: '' }],
        'unavailable with price': [{ ...product, productStatusAndroid: 'unknown' }],
      };
      if (outcome === 'failure') mockIap.fetchProducts.mockRejectedValueOnce(new Error('lookup failed'));
      else mockIap.fetchProducts.mockResolvedValueOnce(failedProducts[outcome]);
      const { result } = renderHook(() => useTipJar(), { wrapper: TipJarProvider });

      await waitFor(() => expect(result.current.unavailable).toBe(true));
      expect(result.current.product).toBeNull();
      await foreground();
      expect(mockIap.initConnection).toHaveBeenCalledTimes(1);
      expect(mockIap.fetchProducts).toHaveBeenCalledTimes(2);
      expect(result.current.product).toMatchObject({ id: 'tip_small' });
      expect(result.current.unavailable).toBe(false);
    } finally {
      osSpy.restore();
    }
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

  test('the watchdog releases the button and a late returned receipt is still finished', async () => {
    const { result } = await renderLoadedTipJar();
    let resolvePurchase!: (purchase: ReturnType<typeof purchaseFixture>) => void;
    mockIap.requestPurchase.mockReturnValueOnce(new Promise(resolve => { resolvePurchase = resolve; }));
    jest.useFakeTimers();
    try {
      let request!: Promise<void>;
      act(() => { request = result.current.tip(); });
      expect(result.current.loading).toBe(true);
      act(() => { jest.advanceTimersByTime(120_000); });
      expect(result.current.loading).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
      const purchase = purchaseFixture('ios-watchdog', 'tip_small', requestToken());
      await act(async () => { resolvePurchase(purchase); await request; });
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
      expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
    } finally {
      jest.useRealTimers();
    }
  });

  test('two taps during a pending purchase request start only one purchase', async () => {
    let rejectRequest!: (reason: unknown) => void;
    mockIap.requestPurchase.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectRequest = reject; }));
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
    await act(async () => {
      const error = { code: 'user-cancelled', productId: 'tip_small' };
      latestErrorHandler()(error);
      rejectRequest(error);
      await firstTap;
    });
    expect(result.current.loading).toBe(false);
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

  test('late unmarked errors leave a newer attempt and its receipt alone', async () => {
    const { result } = await renderLoadedTipJar();
    let rejectFirst!: (reason: unknown) => void;
    mockIap.requestPurchase.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFirst = reject; }));
    jest.useFakeTimers();
    try {
      let firstRequest!: Promise<void>;
      act(() => { firstRequest = result.current.tip(); });
      act(() => { jest.advanceTimersByTime(120_000); });
      await act(async () => { await result.current.tip(); });
      const purchase = purchaseFixture('newer-attempt', 'tip_small', requestToken());
      await act(async () => {
        const cancel = { code: 'user-cancelled', productId: 'tip_small' };
        latestErrorHandler()(cancel);
        rejectFirst(cancel);
        latestErrorHandler()({ code: 'unknown', productId: 'tip_small' });
        await firstRequest;
      });
      expect(result.current.loading).toBe(true);
      expect(alertSpy).not.toHaveBeenCalled();
      await act(async () => { await latestPurchaseHandler()(purchase); });
      expect(result.current.loading).toBe(false);
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
    } finally {
      jest.useRealTimers();
    }
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

  test('Play item-not-owned checks ownership and retries a still-owned tip on foreground', async () => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const { result } = await renderLoadedTipJar();
      await act(async () => { await result.current.tip(); });
      const purchase = purchaseFixture('android-consumed', 'tip_small', requestToken());
      mockIap.finishTransaction.mockRejectedValueOnce({ code: 'item-not-owned' });
      mockIap.getAvailablePurchases.mockResolvedValueOnce([purchase]).mockResolvedValueOnce([purchase]);
      await act(async () => { await latestPurchaseHandler()(purchase); });
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
      expect(mockIap.getAvailablePurchases).toHaveBeenCalledTimes(2);
      expect(result.current.loading).toBe(false);
      expect(alertSpy).toHaveBeenCalledWith('Purchase Needs Attention', expect.any(String));
      await foreground();
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
      expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
    } finally {
      osSpy.restore();
    }
  });

  test.each(['service-disconnected', 'not-prepared'])('Play reconnects and reloads the product and purchases after %s', async code => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const { result } = await renderLoadedTipJar();
      const recovered = purchaseFixture(`android-reconnect-${code}`, 'tip_medium');
      mockIap.getAvailablePurchases.mockRejectedValueOnce({ code }).mockResolvedValueOnce([recovered]);
      await foreground();
      expect(result.current.product).toBeNull();
      expect(mockIap.initConnection).toHaveBeenCalledTimes(1);
      await foreground();
      expect(mockIap.initConnection).toHaveBeenCalledTimes(2);
      expect(mockIap.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: recovered, isConsumable: true });
      expect(mockIap.fetchProducts).toHaveBeenCalledTimes(2);
      expect(result.current.product).toMatchObject({ id: 'tip_small' });
    } finally {
      osSpy.restore();
    }
  });

  test('iOS history publishes valid receipts when the unfinished sweep rejects', async () => {
    const recovered = purchaseFixture('ios-foreground', 'tip_large');
    const revoked = { ...purchaseFixture('ios-refunded'), revocationDateIOS: Date.now() };
    mockIap.getPendingTransactionsIOS.mockRejectedValueOnce(new Error('unverified transaction'));
    mockIap.getAvailablePurchases.mockImplementationOnce(async () => {
      void latestPurchaseHandler()(recovered);
      void latestPurchaseHandler()(revoked);
      throw new Error('unverified transaction in history');
    });
    await renderLoadedTipJar();
    expect(mockIap.getAvailablePurchases).toHaveBeenCalledWith({
      onlyIncludeActiveItemsIOS: false,
      alsoPublishToEventListenerIOS: true,
    });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: recovered, isConsumable: true });
    mockIap.getPendingTransactionsIOS.mockResolvedValueOnce([recovered]);
    await foreground();
    expect(mockIap.getPendingTransactionsIOS).toHaveBeenCalledTimes(2);
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
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

  test('an empty Play response releases the button and keeps the marker for delayed payment', async () => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      mockIap.requestPurchase.mockResolvedValueOnce([]);
      const { result } = await renderLoadedTipJar();
      await act(async () => { await result.current.tip(); });
      expect(result.current.loading).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
      const purchase = purchaseFixture('android-deferred', 'tip_small', requestToken());
      await act(async () => { await latestPurchaseHandler()(purchase); });
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
      expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
    } finally {
      osSpy.restore();
    }
  });

});
