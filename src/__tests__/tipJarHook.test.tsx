import { Alert, Platform } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTipJar } from '../utils/tipJar';
import { __resetIapLifecycleForTests } from '../utils/iapLifecycle';

// The factory must be self-contained: jest.mock is hoisted above imports,
// and the factory runs while tipJar.ts is being imported — before any
// module-level const here would be initialized.
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(() => Promise.resolve()),
  fetchProducts: jest.fn(() =>
    Promise.resolve([
      { id: 'tip_large', type: 'in-app', price: 9.99 },
      { id: 'tip_small', type: 'in-app', price: 0.99 },
      { id: 'some_subscription', type: 'subs', price: 1.99 },
    ]),
  ),
  getAvailablePurchases: jest.fn(() => Promise.resolve([] as unknown[])),
  requestPurchase: jest.fn(() => Promise.resolve()),
  finishTransaction: jest.fn(() => Promise.resolve()),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  ErrorCode: { UserCancelled: 'E_USER_CANCELLED' },
}));

const mockIap = jest.requireMock('react-native-iap');

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

async function renderLoadedTipJar() {
  const utils = renderHook(() => useTipJar());
  await waitFor(() => expect(utils.result.current.products.length).toBeGreaterThan(0));
  return utils;
}

describe('useTipJar', () => {
  let alertSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetIapLifecycleForTests();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    warnSpy.mockRestore();
    __resetIapLifecycleForTests();
  });

  test('loads in-app products sorted by price and reports available', async () => {
    const { result } = await renderLoadedTipJar();

    expect(mockIap.purchaseUpdatedListener).toHaveBeenCalledTimes(2);
    expect(mockIap.initConnection.mock.invocationCallOrder[0]).toBeLessThan(
      mockIap.purchaseUpdatedListener.mock.invocationCallOrder[1],
    );
    expect(result.current.unsupported).toBe(false);
    expect(result.current.unavailable).toBe(false);
    expect(result.current.products.map((p: any) => p.id)).toEqual(['tip_small', 'tip_large']);
  });

  test('reports unavailable when the store returns no tip products', async () => {
    mockIap.fetchProducts.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useTipJar());

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.products).toEqual([]);
  });

  test('finishes a successful purchase as consumable and thanks the user', async () => {
    await renderLoadedTipJar();

    const purchase = { transactionId: 'tx-1', productId: 'tip_small' };
    await act(async () => {
      await latestPurchaseHandler()(purchase);
    });

    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(alertSpy).toHaveBeenCalledWith('Thank You!', expect.any(String));
  });

  test('does not finish purchases outside the tip-jar SKU allowlist', async () => {
    await renderLoadedTipJar();

    await act(async () => {
      await latestPurchaseHandler()({
        transactionId: 'tx-other',
        productId: 'premium_entitlement',
      });
    });

    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('deduplicates replayed purchase events for the same transaction', async () => {
    await renderLoadedTipJar();

    const purchase = { transactionId: 'tx-dup', productId: 'tip_small' };
    await act(async () => {
      await Promise.all([latestPurchaseHandler()(purchase), latestPurchaseHandler()(purchase)]);
    });

    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  test('failed finish alerts once, then a successful replay still thanks the user', async () => {
    await renderLoadedTipJar();

    const purchase = { transactionId: 'tx-fail', productId: 'tip_small' };
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

    // ...and because the claim was released, a later replay can finish and thank.
    await act(async () => {
      await latestPurchaseHandler()(purchase);
    });
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(3);
    expect(alertSpy).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
  });

  test('tip() clears loading once the request settles even if no event arrives', async () => {
    const { result } = await renderLoadedTipJar();

    // Deferred purchase (e.g. iOS Ask to Buy): requestPurchase resolves but
    // no purchase-updated event ever fires.
    await act(async () => {
      await result.current.tip('tip_small');
    });

    expect(mockIap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  test('tip() surfaces an immediate non-cancellation request failure', async () => {
    mockIap.requestPurchase.mockRejectedValueOnce({
      code: 'E_NETWORK_ERROR',
    });
    const { result } = await renderLoadedTipJar();

    await act(async () => {
      await result.current.tip('tip_small');
    });

    expect(alertSpy).toHaveBeenCalledWith('Purchase Failed', expect.any(String));
    expect(result.current.loading).toBe(false);
  });

  test('tip() keeps an immediate cancellation silent', async () => {
    mockIap.requestPurchase.mockRejectedValueOnce({
      code: 'E_USER_CANCELLED',
    });
    const { result } = await renderLoadedTipJar();

    await act(async () => {
      await result.current.tip('tip_small');
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  test('purchase errors clear loading and only alert for non-cancel errors', async () => {
    const { result } = await renderLoadedTipJar();

    act(() => {
      latestErrorHandler()({ code: 'E_USER_CANCELLED' });
    });
    expect(result.current.loading).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();

    act(() => {
      latestErrorHandler()({ code: 'E_UNKNOWN' });
    });
    expect(alertSpy).toHaveBeenCalledWith('Purchase Failed', expect.any(String));
  });

  test('Android startup sweep finishes cached tips once, skipping other SKUs and claimed transactions', async () => {
    const osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const cachedTip = { transactionId: 'tx-cached', productId: 'tip_medium' };
      const otherSku = { transactionId: 'tx-other', productId: 'not_a_tip' };
      mockIap.getAvailablePurchases.mockResolvedValueOnce([cachedTip, otherSku]);

      await renderLoadedTipJar();

      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({
        purchase: cachedTip,
        isConsumable: true,
      });

      // A listener replay of the same transaction is skipped — already claimed.
      await act(async () => {
        await latestPurchaseHandler()(cachedTip);
      });
      expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    } finally {
      osSpy.restore();
    }
  });
});
