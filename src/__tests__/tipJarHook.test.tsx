import React from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { render, renderHook, act, waitFor } from '@testing-library/react-native';
import { __resetTipSessionForTests, TipJarProvider, useTipJar } from '../utils/tipJar';

// The factory must be self-contained: jest.mock is hoisted above imports,
// and the factory runs while tipJar.ts is being imported — before any
// module-level const here would be initialized.
jest.mock('expo-iap', () => ({
  initConnection: jest.fn(),
  endConnection: jest.fn(),
  fetchProducts: jest.fn(),
  getAvailablePurchases: jest.fn(),
  getPendingTransactionsIOS: jest.fn(),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
  ErrorCode: {
    UserCancelled: 'user-cancelled',
    DeferredPayment: 'deferred-payment',
    Pending: 'pending',
    DuplicatePurchase: 'duplicate-purchase',
    ItemNotOwned: 'item-not-owned',
    AlreadyOwned: 'already-owned',
    NotPrepared: 'not-prepared',
    ServiceDisconnected: 'service-disconnected',
    ServiceTimeout: 'service-timeout',
    BillingUnavailable: 'billing-unavailable',
    IapNotAvailable: 'iap-not-available',
    ItemUnavailable: 'item-unavailable',
    DeveloperError: 'developer-error',
    FeatureNotSupported: 'feature-not-supported',
    SkuNotFound: 'sku-not-found',
  },
}));

const mockIap = jest.requireMock('expo-iap');
const tipProduct = { id: 'tip_small', type: 'in-app', displayPrice: 'localized store price' };
const attentionMessage = 'Your tip was received, but we could not finish the transaction. Please reopen the app later.';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

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
  return Platform.OS === 'android' ? request.google.obfuscatedAccountId : request.apple.appAccountToken;
}

async function renderLoadedTipJar() {
  const utils = renderHook(() => useTipJar(), { wrapper: TipJarProvider });
  await waitFor(() => expect(utils.result.current.product).not.toBeNull());
  return utils;
}

describe('useTipJar', () => {
  let alertSpy: jest.SpyInstance;
  let appStateSpy: jest.SpyInstance<ReturnType<typeof AppState.addEventListener>, Parameters<typeof AppState.addEventListener>>;

  async function foreground() {
    const listener = appStateSpy.mock.calls.find(([event]) => event === 'change')?.[1];
    expect(listener).toBeDefined();
    await act(async () => { listener?.('active'); });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockIap.initConnection.mockResolvedValue(true);
    mockIap.endConnection.mockResolvedValue(true);
    mockIap.fetchProducts.mockResolvedValue([
      { id: 'tip_large', type: 'in-app', displayPrice: 'retired price' },
      tipProduct,
      { id: 'some_subscription', type: 'subs' },
    ]);
    mockIap.getAvailablePurchases.mockResolvedValue([]);
    mockIap.getPendingTransactionsIOS.mockResolvedValue([]);
    mockIap.requestPurchase.mockResolvedValue(null);
    mockIap.finishTransaction.mockResolvedValue(undefined);
    mockIap.purchaseUpdatedListener.mockImplementation(() => ({ remove: jest.fn() }));
    mockIap.purchaseErrorListener.mockImplementation(() => ({ remove: jest.fn() }));
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    appStateSpy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    __resetTipSessionForTests();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('loads and offers only tip_small with the store display price', async () => {
    const { result } = await renderLoadedTipJar();

    expect(mockIap.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
    expect(mockIap.purchaseUpdatedListener).toHaveBeenCalledWith(expect.any(Function), { dedupeTransactionIOS: false });
    expect(mockIap.purchaseUpdatedListener.mock.invocationCallOrder[0]).toBeLessThan(
      mockIap.initConnection.mock.invocationCallOrder[0],
    );
    expect(mockIap.purchaseErrorListener.mock.invocationCallOrder[0]).toBeLessThan(
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
      expect(mockIap.initConnection).toHaveBeenCalledTimes(2);
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
    const request = deferred<unknown>();
    mockIap.requestPurchase.mockReturnValueOnce(request.promise);
    await act(async () => { void result.current.tip(); });
    expect(result.current.loading).toBe(true);
    const purchase = purchaseFixture('tx-1', 'tip_small', requestToken().toUpperCase());
    await act(async () => {
      await latestPurchaseHandler()(purchase);
      request.resolve(purchase);
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

  test.each(['ios', 'android'] as const)('finishes both retired tips silently without settling the current %s attempt', async os => {
    jest.replaceProperty(Platform, 'OS', os);
    const { result } = await renderLoadedTipJar();
    const request = deferred<unknown>();
    mockIap.requestPurchase.mockReturnValueOnce(request.promise);
    await act(async () => { void result.current.tip(); });

    for (const productId of ['tip_medium', 'tip_large']) {
      const purchase = purchaseFixture(`listener-${os}-${productId}`, productId, requestToken());
      await act(async () => { await latestPurchaseHandler()(purchase); });
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    }
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
    await act(async () => { request.resolve(null); });
  });

  test('a failed finish keeps tips unavailable and alerts once until duplicate recovery succeeds', async () => {
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    const purchase = purchaseFixture('tx-fail', 'tip_small', requestToken());
    mockIap.finishTransaction
      .mockRejectedValueOnce(new Error('store hiccup'))
      .mockRejectedValueOnce(new Error('store hiccup again'));

    await act(async () => {
      await latestPurchaseHandler()(purchase);
    });
    expect(result.current.unavailable).toBe(true);
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Purchase Needs Attention', attentionMessage);
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // Second failure for the same transaction stays quiet (no alert loop)...
    await act(async () => {
      await latestPurchaseHandler()(purchase);
    });
    expect(result.current.unavailable).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // The canonical duplicate error also prompts a sweep of unfinished items.
    mockIap.getPendingTransactionsIOS.mockResolvedValueOnce([purchase]);
    await act(async () => { latestErrorHandler()({ code: 'duplicate-purchase' }); });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(3);
    expect(result.current.unavailable).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(2);
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

  test.each(['ios', 'android'] as const)('two taps during a pending %s purchase request start only one purchase', async os => {
    jest.replaceProperty(Platform, 'OS', os);
    let rejectRequest!: (reason: unknown) => void;
    mockIap.requestPurchase.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectRequest = reject; }));
    const { result } = await renderLoadedTipJar();
    let firstTap!: Promise<void>;
    await act(async () => { firstTap = result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(mockIap.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: { sku: 'tip_small', appAccountToken: expect.any(String) },
        google: { skus: ['tip_small'], obfuscatedAccountId: requestToken() },
      },
      type: 'in-app',
    });
    expect(result.current.loading).toBe(true);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    await act(async () => {
      const error = { code: 'user-cancelled', productId: 'tip_small' };
      latestErrorHandler()(error);
      rejectRequest(error);
      await firstTap;
    });
    expect(result.current.loading).toBe(false);
  });

  test.each([
    ['android', 'billing-unavailable'],
    ['android', 'item-unavailable'],
    ['android', 'developer-error'],
    ['android', 'feature-not-supported'],
    ['android', 'sku-not-found'],
    ['ios', 'iap-not-available'],
    ['ios', 'item-unavailable'],
    ['ios', 'developer-error'],
    ['ios', 'feature-not-supported'],
    ['ios', 'sku-not-found'],
  ] as const)('tip() shows Purchase Failed for an active %s request rejected with %s', async (os, code) => {
    jest.replaceProperty(Platform, 'OS', os);
    mockIap.requestPurchase.mockRejectedValueOnce({ code });
    const { result } = await renderLoadedTipJar();

    await act(async () => {
      await result.current.tip();
    });

    expect(alertSpy).toHaveBeenCalledWith('Purchase Failed', 'Something went wrong. Please try again.');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  test.each([
    ['android', 'iap-not-available'],
    ['ios', 'billing-unavailable'],
  ] as const)('tip() quietly reconciles a %s request rejected with the other store\'s %s code', async (os, code) => {
    jest.replaceProperty(Platform, 'OS', os);
    mockIap.requestPurchase.mockRejectedValueOnce({ code });
    const { result } = await renderLoadedTipJar();
    const sweep = os === 'android' ? mockIap.getAvailablePurchases : mockIap.getPendingTransactionsIOS;

    await act(async () => { await result.current.tip(); });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(sweep).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
  });

  test('a StoreKit transaction-validation-failed rejection is quiet and sweeps unfinished transactions', async () => {
    const { result } = await renderLoadedTipJar();
    const sweep = deferred<unknown[]>();
    mockIap.getPendingTransactionsIOS.mockReturnValueOnce(sweep.promise);
    mockIap.requestPurchase.mockRejectedValueOnce({ code: 'transaction-validation-failed' });

    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockIap.getPendingTransactionsIOS).toHaveBeenCalledTimes(2);

    const purchase = purchaseFixture('verification-recovery', 'tip_small', requestToken());
    await act(async () => { sweep.resolve([purchase]); });
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
  });

  test.each(['ios', 'android'] as const)('tip() keeps an immediate %s cancellation silent', async os => {
    jest.replaceProperty(Platform, 'OS', os);
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
    const secondRequest = deferred<unknown>();
    mockIap.requestPurchase
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockReturnValueOnce(secondRequest.promise);
    jest.useFakeTimers();
    try {
      let firstRequest!: Promise<void>;
      act(() => { firstRequest = result.current.tip(); });
      act(() => { jest.advanceTimersByTime(120_000); });
      await act(async () => { void result.current.tip(); });
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
      await act(async () => { await latestPurchaseHandler()(purchase); secondRequest.resolve(purchase); });
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
      expect(alertSpy).toHaveBeenCalledWith('Purchase Needs Attention', attentionMessage);
      await foreground();
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
      expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
    } finally {
      osSpy.restore();
    }
  });

  test.each(['service-disconnected', 'not-prepared'])('Play reconnects and recovers on the first foreground after %s', async code => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const { result } = await renderLoadedTipJar();
      const recovered = purchaseFixture(`android-reconnect-${code}`, 'tip_medium');
      mockIap.getAvailablePurchases.mockRejectedValueOnce({ code }).mockResolvedValueOnce([recovered]);
      await foreground();
      expect(mockIap.initConnection).toHaveBeenCalledTimes(3);
      expect(mockIap.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: recovered, isConsumable: true });
      expect(result.current.product).toMatchObject({ id: 'tip_small' });
      expect(alertSpy).not.toHaveBeenCalled();
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

  test.each(['deferred-payment', 'pending'])('Apple %s rejection clears loading and shows the pending message once', async code => {
    mockIap.requestPurchase.mockImplementationOnce(async () => {
      const error = { code, productId: 'tip_small' };
      latestErrorHandler()(error);
      throw error;
    });
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(false);
    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Purchase Pending', 'Your tip is waiting for payment or approval.');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const pending = purchaseFixture('apple-pending', 'tip_small', requestToken(), 'pending');
    await act(async () => { await latestPurchaseHandler()(pending); });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  test('Play pending payment alerts once and stays unconsumed until the same purchase is paid', async () => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      mockIap.getAvailablePurchases.mockResolvedValueOnce([purchaseFixture('android-recovered-pending', 'tip_medium', undefined, 'pending')]);
      const { result } = await renderLoadedTipJar();
      mockIap.requestPurchase.mockImplementationOnce(async () => {
        const pending = purchaseFixture('android-pending', 'tip_small', requestToken(), 'pending');
        await latestPurchaseHandler()(pending);
        return [pending];
      });
      await act(async () => { await result.current.tip(); });
      const token = requestToken();
      expect(result.current.loading).toBe(false);
      expect(mockIap.finishTransaction).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Purchase Pending', expect.any(String));
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const finish = deferred<void>();
      mockIap.finishTransaction.mockReturnValueOnce(finish.promise);
      await act(async () => { void latestPurchaseHandler()(purchaseFixture('android-pending', 'tip_small', token)); });
      expect(result.current.loading).toBe(true);
      await act(async () => { finish.resolve(); });
      expect(result.current.loading).toBe(false);
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
    } finally {
      osSpy.restore();
    }
  });

  test('keeps a confirmed pending Play marker when a later rejection drains the request', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    mockIap.requestPurchase.mockImplementationOnce(async () => {
      await latestPurchaseHandler()(purchaseFixture('pending-before-rejection', 'tip_small', requestToken(), 'pending'));
      throw { code: 'network-error' };
    });
    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Purchase Pending', 'Your tip is waiting for payment or approval.');

    const purchase = purchaseFixture('pending-before-rejection', 'tip_small', requestToken());
    await act(async () => { await latestPurchaseHandler()(purchase); });
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
  });

  test.each(['empty', 'unknown'])('a Play %s result releases the button and keeps the marker for delayed payment', async outcome => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      mockIap.requestPurchase.mockImplementationOnce(async () => outcome === 'empty' ? [] : [
        purchaseFixture('unknown-state', 'tip_small', requestToken(), 'unknown'),
      ]);
      const { result } = await renderLoadedTipJar();
      await act(async () => { await result.current.tip(); });
      expect(result.current.loading).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
      expect(mockIap.finishTransaction).not.toHaveBeenCalled();
      const purchase = purchaseFixture('android-deferred', 'tip_small', requestToken());
      await act(async () => { await latestPurchaseHandler()(purchase); });
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
      expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
    } finally {
      osSpy.restore();
    }
  });

  test.each(['ios', 'android'] as const)('keeps the %s button busy and available during the first finish, then thanks once', async os => {
    jest.replaceProperty(Platform, 'OS', os);
    const { result } = await renderLoadedTipJar();
    const finish = deferred<void>();
    mockIap.requestPurchase.mockImplementationOnce(async () => purchaseFixture('returned-tip', 'tip_small', requestToken()));
    mockIap.finishTransaction.mockReturnValueOnce(finish.promise);
    let request!: Promise<void>;
    await act(async () => { request = result.current.tip(); });

    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(true);
    expect(result.current.unavailable).toBe(false);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();

    await act(async () => { finish.resolve(); await request; });
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
  });

  test.each(['service-disconnected', 'service-timeout', 'network-error'])('recovers silently after Play %s and thanks once for the marked receipt', async code => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    const sweep = deferred<unknown[]>();
    mockIap.getAvailablePurchases.mockReturnValueOnce(sweep.promise);
    mockIap.requestPurchase.mockRejectedValueOnce({ code });
    await act(async () => { await result.current.tip(); });
    expect(result.current.loading).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockIap.getAvailablePurchases).toHaveBeenCalledTimes(2);

    const purchase = purchaseFixture(`unknown-${code}`, 'tip_small', requestToken());
    await act(async () => {
      if (code !== 'network-error') latestErrorHandler()({ code: 'service-disconnected' });
      sweep.resolve([purchase]);
    });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));

    await act(async () => { await latestPurchaseHandler()(purchase); });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  test('a Play provider remount reconnects without native teardown and sweeps a late rejected request', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result, unmount } = await renderLoadedTipJar();
    const response = deferred<unknown>();
    mockIap.requestPurchase.mockReturnValueOnce(response.promise);
    mockIap.endConnection.mockReturnValue(deferred<boolean>().promise);
    jest.useFakeTimers();
    let request!: Promise<void>;
    await act(async () => { request = result.current.tip(); });
    const purchase = purchaseFixture('paid-across-remount', 'tip_small', requestToken());
    unmount();
    await act(async () => { await jest.advanceTimersByTimeAsync(250); });

    const remounted = await renderLoadedTipJar();
    expect(mockIap.endConnection).not.toHaveBeenCalled();
    expect(mockIap.getAvailablePurchases).toHaveBeenCalledTimes(2);
    expect(remounted.result.current.unavailable).toBe(false);

    mockIap.getAvailablePurchases.mockResolvedValueOnce([purchase]);
    await act(async () => { response.reject({ code: 'network-error' }); await request; });
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
  });

  test('keeps Play busy past two minutes and during the listener finish, and blocks checkout until the request drains', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    jest.useFakeTimers();
    const response = deferred<unknown>();
    mockIap.requestPurchase.mockReturnValueOnce(response.promise);
    let request!: Promise<void>;
    await act(async () => { request = result.current.tip(); });

    act(() => jest.advanceTimersByTime(121_000));
    expect(result.current.loading).toBe(true);
    expect(result.current.unavailable).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);

    const purchase = purchaseFixture('listener-before-play-result', 'tip_small', requestToken());
    const finish = deferred<void>();
    mockIap.finishTransaction.mockReturnValueOnce(finish.promise);
    await act(async () => { void latestPurchaseHandler()(purchase); });
    expect(result.current.loading).toBe(true);
    expect(result.current.unavailable).toBe(false);
    await act(async () => { finish.resolve(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.unavailable).toBe(false);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);

    await act(async () => { response.resolve([purchase]); await request; });
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(false);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(2);
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
  });

  test('honors the Play backstop despite a slow wall clock and reconciles after a late rejection', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    jest.useFakeTimers();
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const response = deferred<unknown>();
    mockIap.requestPurchase.mockReturnValueOnce(response.promise);
    let request!: Promise<void>;
    await act(async () => { request = result.current.tip(); });

    act(() => jest.advanceTimersByTime(15 * 60_000));
    expect(result.current.loading).toBe(true);
    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(true);
    await act(async () => { result.current.retryIfUnavailable(); });
    expect(mockIap.fetchProducts).toHaveBeenCalledTimes(3);
    await foreground();
    expect(mockIap.fetchProducts).toHaveBeenCalledTimes(4);
    expect(result.current.unavailable).toBe(true);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();

    const purchase = purchaseFixture('charged-before-backstop', 'tip_small', requestToken());
    mockIap.getAvailablePurchases.mockResolvedValueOnce([purchase]);
    await act(async () => { response.reject({ code: 'network-error' }); await request; });
    expect(result.current.unavailable).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
  });

  test.each(['reconnect', 'product reload'])('bounds a stalled Play %s and reloads on More focus', async step => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    jest.useFakeTimers();
    const storeStep = step === 'reconnect' ? mockIap.initConnection : mockIap.fetchProducts;
    storeStep.mockReturnValueOnce(deferred<unknown>().promise);
    let request!: Promise<void>;
    await act(async () => { request = result.current.tip(); });
    expect(storeStep).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);

    await act(async () => { jest.advanceTimersByTime(30_000); await request; });
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(true);
    expect(mockIap.requestPurchase).not.toHaveBeenCalled();
    const fetches = mockIap.fetchProducts.mock.calls.length;
    await act(async () => { result.current.retryIfUnavailable(); });
    expect(mockIap.fetchProducts).toHaveBeenCalledTimes(fetches + 1);
    expect(result.current.unavailable).toBe(false);
  });

  test('retries an offline launch when More focuses', async () => {
    mockIap.initConnection.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(useTipJar, { wrapper: TipJarProvider });
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(mockIap.fetchProducts).not.toHaveBeenCalled();

    await act(async () => { result.current.retryIfUnavailable(); });
    expect(mockIap.initConnection).toHaveBeenCalledTimes(2);
    expect(mockIap.fetchProducts).toHaveBeenCalledTimes(1);
    expect(result.current.product).toMatchObject(tipProduct);
    expect(result.current.unavailable).toBe(false);
  });

  test('reloads on More focus and foreground while a sweep is still running', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const sweep = deferred<unknown[]>();
    const initialProduct = deferred<unknown[]>();
    mockIap.getAvailablePurchases.mockReturnValueOnce(sweep.promise);
    mockIap.fetchProducts.mockReturnValueOnce(initialProduct.promise).mockResolvedValueOnce([]);
    const { result } = renderHook(useTipJar, { wrapper: TipJarProvider });
    await waitFor(() => expect(mockIap.fetchProducts).toHaveBeenCalledTimes(1));

    await act(async () => { result.current.retryIfUnavailable(); initialProduct.resolve([]); });
    expect(mockIap.fetchProducts).toHaveBeenCalledTimes(2);
    expect(result.current.unavailable).toBe(true);
    await foreground();
    expect(mockIap.getAvailablePurchases).toHaveBeenCalledTimes(1);
    expect(mockIap.fetchProducts).toHaveBeenCalledTimes(3);
    expect(result.current.product).toMatchObject(tipProduct);
    expect(result.current.unavailable).toBe(false);
    await act(async () => { sweep.resolve([]); });
  });

  test('blocks Play taps while a marked receipt waits behind an older receipt in a recovery batch', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    const oldReceipt = purchaseFixture('batch-old-tip');
    const markedReceipt = purchaseFixture('batch-marked-tip', 'tip_small', requestToken());
    const finishOld = deferred<void>();
    const finishMarked = deferred<void>();
    mockIap.finishTransaction.mockReturnValueOnce(finishOld.promise).mockReturnValueOnce(finishMarked.promise);
    mockIap.getAvailablePurchases.mockResolvedValueOnce([oldReceipt, markedReceipt]);

    await foreground();
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: oldReceipt, isConsumable: true });
    expect(result.current.loading).toBe(true);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);

    await act(async () => { finishOld.resolve(); });
    expect(mockIap.finishTransaction).toHaveBeenLastCalledWith({ purchase: markedReceipt, isConsumable: true });
    expect(result.current.loading).toBe(true);
    await act(async () => { finishMarked.resolve(); });
    expect(result.current.loading).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
  });

  test('discards a Play tap overtaken by an earlier marked receipt during preparation', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    const purchase = purchaseFixture('overtaking-tip', 'tip_small', requestToken());
    const reload = deferred<unknown[]>();
    mockIap.fetchProducts.mockReturnValueOnce(reload.promise);
    let request!: Promise<void>;
    await act(async () => { request = result.current.tip(); });
    expect(result.current.loading).toBe(true);

    await act(async () => { await latestPurchaseHandler()(purchase); });
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
    await act(async () => { reload.resolve([tipProduct]); await request; });
    expect(result.current.loading).toBe(false);
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(2);
  });

  test.each([
    ['ios', 'original finish'],
    ['android', 'retry'],
  ] as const)('blocks %s checkout after a finish timeout until the %s succeeds, then thanks once', async (os, completion) => {
    jest.replaceProperty(Platform, 'OS', os);
    const { result } = await renderLoadedTipJar();
    jest.useFakeTimers();
    await act(async () => { await result.current.tip(); });
    const purchase = purchaseFixture('stalled-finish', 'tip_small', requestToken());
    const original = deferred<void>();
    const ownership = deferred<unknown[]>();
    const retry = deferred<void>();
    const query = os === 'ios' ? mockIap.getPendingTransactionsIOS : mockIap.getAvailablePurchases;
    if (os === 'android') {
      mockIap.finishTransaction.mockRejectedValueOnce({ code: 'item-not-owned' });
      query.mockReturnValueOnce(ownership.promise);
    } else {
      mockIap.finishTransaction.mockReturnValueOnce(original.promise);
    }
    mockIap.finishTransaction.mockReturnValueOnce(retry.promise);

    let finishing!: Promise<void>;
    await act(async () => { finishing = latestPurchaseHandler()(purchase); });
    expect(result.current.loading).toBe(true);
    expect(result.current.unavailable).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(120_000); await finishing; });
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(true);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Purchase Needs Attention', attentionMessage);

    query.mockResolvedValueOnce([purchase]);
    await foreground();
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
    expect(mockIap.finishTransaction).toHaveBeenLastCalledWith({ purchase, isConsumable: true });
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(true);
    await act(async () => { (completion === 'original finish' ? original : retry).resolve(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(false);
    expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
    await act(async () => {
      if (os === 'android') ownership.resolve([]);
      else retry.resolve();
      await latestPurchaseHandler()(purchase);
    });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(2);
  });

  test('a paid result returned across an iOS remount blocks checkout until a More focus sweep succeeds', async () => {
    const first = await renderLoadedTipJar();
    const response = deferred<unknown>();
    mockIap.requestPurchase.mockReturnValueOnce(response.promise);
    let request!: Promise<void>;
    act(() => { request = first.result.current.tip(); });
    const purchase = purchaseFixture('paid-result-across-remount', 'tip_small', requestToken());
    first.unmount();

    const { result } = await renderLoadedTipJar();
    const finish = deferred<void>();
    mockIap.finishTransaction.mockReturnValueOnce(finish.promise);
    await act(async () => { response.resolve(purchase); });
    expect(result.current.loading).toBe(true);
    expect(result.current.unavailable).toBe(false);
    await act(async () => { finish.reject(new Error('finish failed')); await request; });
    expect(result.current.unavailable).toBe(true);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);

    mockIap.getPendingTransactionsIOS.mockResolvedValueOnce([purchaseFixture(purchase.id)]);
    await act(async () => { result.current.retryIfUnavailable(); });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(2);
    expect(result.current.unavailable).toBe(false);
    expect(alertSpy.mock.calls).toEqual([
      ['Purchase Needs Attention', attentionMessage],
      ['Thank You!', expect.any(String)],
    ]);
  });

  test('a retired tip recovered with a matching marker never blocks checkout or alerts', async () => {
    const { result } = await renderLoadedTipJar();
    await act(async () => { await result.current.tip(); });
    const retired = purchaseFixture('retired-with-marker', 'tip_medium', requestToken());
    const finish = deferred<void>();
    mockIap.finishTransaction.mockReturnValueOnce(finish.promise);
    mockIap.getPendingTransactionsIOS.mockResolvedValueOnce([retired]);

    await foreground();
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: retired, isConsumable: true });
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(false);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(2);

    await act(async () => { finish.reject(new Error('finish failed')); });
    expect(result.current.unavailable).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('recovers on the first foreground after an idle Play disconnect and loads the next purchase on its live client', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const owned = purchaseFixture('idle-owned-tip');
    let client: object | undefined;
    let productClient: object | undefined;
    const liveChecks: boolean[] = [];
    mockIap.initConnection.mockImplementation(async () => {
      client ??= {};
      return true;
    });
    mockIap.fetchProducts.mockImplementation(async () => {
      productClient = client;
      return [tipProduct];
    });
    const { result } = await renderLoadedTipJar();
    client = undefined;
    mockIap.getAvailablePurchases.mockImplementationOnce(async () => client ? [owned] : []);
    await foreground();
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: owned, isConsumable: true });
    expect(alertSpy).not.toHaveBeenCalled();

    client = undefined;
    mockIap.requestPurchase.mockImplementationOnce(async () => {
      liveChecks.push(Boolean(client && productClient === client));
      return [];
    });
    await act(async () => { await result.current.tip(); });
    expect(liveChecks).toEqual([true]);
    expect(result.current.loading).toBe(false);
  });

  test('a Play duplicate-purchase rejection recovers a retired tip silently', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderLoadedTipJar();
    const purchase = purchaseFixture('duplicate-retired', 'tip_large');
    mockIap.requestPurchase.mockRejectedValueOnce({ code: 'duplicate-purchase', productId: 'tip_large' });
    mockIap.getAvailablePurchases.mockResolvedValueOnce([purchase]);
    await act(async () => { await result.current.tip(); });
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(result.current.loading).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
