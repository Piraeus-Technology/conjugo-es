import { createContext, createElement, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import type { ExpoPurchaseError, Product, ProductOrSubscription, Purchase } from 'expo-iap';
import {
  releaseIapConnection,
  retainIapConnection,
  waitForPendingIapEnd,
} from './iapLifecycle';

const ACTIVE_TIP_SKU = 'tip_small';
const CONSUMABLE_TIP_SKUS = new Set([ACTIVE_TIP_SKU, 'tip_medium', 'tip_large']);

type TipTransactionLike = {
  purchaseToken?: string | null;
  id?: string | null;
};

function nonEmpty(value?: string | null): string | null {
  return value && value.trim().length > 0 ? value : null;
}

export function getTipTransactionKey(purchase: TipTransactionLike, platform: string): string | null {
  return nonEmpty(platform === 'ios' ? purchase.id : purchase.purchaseToken);
}

let iapModule: typeof import('expo-iap') | null = null;
try {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, loaded only on store platforms
    iapModule = require('expo-iap');
  }
} catch {
  // Keep the tip jar optional when the module cannot load.
}

const OUTCOME_TIMEOUT_MS = 120_000;

interface TipAttempt {
  token: string;
  deadline: number;
  timeout: ReturnType<typeof setTimeout>;
  pendingNotified: boolean;
}

const attempts = new Map<string, TipAttempt>();
const finishing = new Set<string>();
const finished = new Set<string>();
const attentionNotified = new Set<string>();

function createAttemptToken(): string {
  // Both stores can echo an opaque per-attempt marker. It contains no user data.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character =>
    Math.floor(Math.random() * (character === 'x' ? 16 : 4) + (character === 'x' ? 0 : 8)).toString(16),
  );
}

function showPending(attempt: TipAttempt) {
  if (attempt.pendingNotified) return;
  attempt.pendingNotified = true;
  Alert.alert('Purchase Pending', 'Your tip is waiting for payment or approval.');
}

function getAttemptToken(purchase: Purchase): string | undefined {
  const token = 'appAccountToken' in purchase ? purchase.appAccountToken
    : 'obfuscatedAccountIdAndroid' in purchase ? purchase.obfuscatedAccountIdAndroid : undefined;
  return token?.toLowerCase();
}

function useTipJarController() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(!iapModule);
  const [unsupported, setUnsupported] = useState(!iapModule);
  const activeAttempt = useRef<TipAttempt | null>(null);
  const handlers = useRef<{
    purchase: (purchase: Purchase) => Promise<void>;
    error: (error: Partial<ExpoPurchaseError> | undefined, attempt?: TipAttempt) => void;
  } | null>(null);

  const settle = useCallback((attempt: TipAttempt) => {
    if (activeAttempt.current !== attempt) return;
    clearTimeout(attempt.timeout);
    activeAttempt.current = null;
    setLoading(false);
  }, []);

  useEffect(() => {
    const iap = iapModule;
    if (!iap) return;

    const codes = iap.ErrorCode;
    let mounted = true;
    let connected = false;
    let needsProduct = true;
    let sweep: Promise<void> | undefined;
    let purchaseListener: ReturnType<typeof iap.purchaseUpdatedListener> | undefined;
    let errorListener: ReturnType<typeof iap.purchaseErrorListener> | undefined;
    retainIapConnection();

    const checkConnection = (error: unknown) => {
      const code = (error as ExpoPurchaseError | undefined)?.code;
      if (!mounted || Platform.OS !== 'android' || (code !== codes.ServiceDisconnected && code !== codes.NotPrepared)) return;
      connected = false;
      needsProduct = true;
      setProduct(null);
      setUnavailable(true);
    };

    const finishTip = async (purchase: Purchase, key: string) => {
      try {
        await iap.finishTransaction({ purchase, isConsumable: true });
      } catch (error) {
        if (Platform.OS !== 'android' || (error as ExpoPurchaseError)?.code !== codes.ItemNotOwned) throw error;
        // Play can report ITEM_NOT_OWNED from stale cache data. Keep an owned
        // token retryable on the next sweep, including when this query fails.
        const owned = await iap.getAvailablePurchases();
        if (owned.some(item => item.purchaseToken === key)) throw error;
      }
    };

    const handlePurchase = async (purchase: Purchase) => {
      if (!mounted || !CONSUMABLE_TIP_SKUS.has(purchase.productId)) return;
      // StoreKit history can include refunded or revoked consumables.
      if ('revocationDateIOS' in purchase && purchase.revocationDateIOS != null) return;
      const token = getAttemptToken(purchase);
      const attempt = purchase.productId === ACTIVE_TIP_SKU && token ? attempts.get(token) : undefined;
      if (purchase.purchaseState === 'pending') {
        if (attempt) {
          settle(attempt);
          showPending(attempt);
        }
        return;
      }
      if (purchase.purchaseState !== 'purchased') return;
      if (attempt) settle(attempt);
      const key = getTipTransactionKey(purchase, Platform.OS);
      if (!key || finished.has(key) || finishing.has(key)) return;

      finishing.add(key);
      try {
        await finishTip(purchase, key);
        finished.add(key);
        attentionNotified.delete(key);
        if (attempt) {
          attempts.delete(attempt.token);
          Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
        }
      } catch (error) {
        checkConnection(error);
        console.warn('Failed to finish tip transaction:', error);
        if (attempt && !attentionNotified.has(key)) {
          attentionNotified.add(key);
          Alert.alert(
            'Purchase Needs Attention',
            'Your tip was received, but we could not finish the transaction. Please reopen the app or try again later.',
          );
        }
      } finally {
        finishing.delete(key);
      }
    };
    const recover = async () => {
      try {
        const purchases = Platform.OS === 'ios'
          ? await iap.getPendingTransactionsIOS()
          : await iap.getAvailablePurchases();
        for (const purchase of purchases) {
          if (!mounted || !connected) return;
          await handlePurchase(purchase);
        }
      } catch (error) {
        checkConnection(error);
        console.warn('Failed to recover tip transactions:', error);
        if (mounted && Platform.OS === 'ios') {
          // The history query publishes verified entries even if another entry
          // fails verification. History includes unfinished consumables.
          try {
            await iap.getAvailablePurchases({
              onlyIncludeActiveItemsIOS: false,
              alsoPublishToEventListenerIOS: true,
            });
          } catch (fallbackError) {
            console.warn('Failed to query StoreKit history during tip recovery:', fallbackError);
          }
        }
      }
    };

    const loadProduct = async () => {
      if (!needsProduct) return;
      try {
        const items: ProductOrSubscription[] | null = await iap.fetchProducts({ skus: [ACTIVE_TIP_SKU], type: 'in-app' });
        if (!mounted || !connected) return;
        const product = items?.find((item): item is Product => item.id === ACTIVE_TIP_SKU && item.type === 'in-app' &&
          Boolean(item.displayPrice?.trim()) &&
          (!('productStatusAndroid' in item) || item.productStatusAndroid == null || item.productStatusAndroid === 'ok'));
        needsProduct = !product;
        setProduct(product ?? null);
        setUnavailable(needsProduct);
      } catch (error) {
        checkConnection(error);
        if (mounted) setUnavailable(true);
      }
    };

    const refresh = () => {
      if (sweep || !mounted) return;
      sweep = (async () => {
        if (!connected) {
          try {
            await waitForPendingIapEnd();
            if (!mounted) return;
            // The unfinished-transaction sweep retries failed finishes. Also
            // accept StoreKit replays and deduplicate them in handlePurchase.
            purchaseListener ??= iap.purchaseUpdatedListener(handlePurchase, { dedupeTransactionIOS: false });
            errorListener ??= iap.purchaseErrorListener(error => handlePurchaseError(error));
          } catch {
            // The JS package resolves its native bridge lazily. Expo Go lacks it.
            setUnsupported(true);
            setUnavailable(true);
            return;
          }
          setUnsupported(false);
          connected = await iap.initConnection();
          if (!mounted) return;
          if (!connected) {
            setUnavailable(true);
            return;
          }
        }
        await Promise.all([recover(), loadProduct()]);
      })().catch(error => {
        checkConnection(error);
        if (mounted) setUnavailable(true);
      }).finally(() => { sweep = undefined; });
    };

    function handlePurchaseError(error: Partial<ExpoPurchaseError> | undefined, attempt?: TipAttempt) {
      if (!mounted) return;
      checkConnection(error);
      const code = error?.code;
      if (code === codes.DuplicatePurchase) {
        if (!error?.productId || CONSUMABLE_TIP_SKUS.has(error.productId)) refresh();
        if (attempt) settle(attempt);
        return;
      }
      if (error?.productId && error.productId !== ACTIVE_TIP_SKU) return;
      if (code === codes.AlreadyOwned) refresh();
      // Purchase error events carry product IDs, but no attempt marker.
      // Only the rejection of this specific request can settle its attempt.
      if (!attempt || attempt !== activeAttempt.current) return;
      settle(attempt);
      if (code === codes.DeferredPayment || code === codes.Pending) {
        showPending(attempt);
        return;
      }
      attempts.delete(attempt.token);
      if (code === codes.AlreadyOwned || code === codes.UserCancelled || code === codes.PurchaseVerificationFinished) return;
      Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
    }

    handlers.current = { purchase: handlePurchase, error: handlePurchaseError };
    refresh();
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      const attempt = activeAttempt.current;
      if (attempt && attempt.deadline <= Date.now()) settle(attempt);
      refresh();
    });

    const attemptRef = activeAttempt;
    return () => {
      mounted = false;
      handlers.current = null;
      appState.remove();
      purchaseListener?.remove();
      errorListener?.remove();
      if (attemptRef.current) clearTimeout(attemptRef.current.timeout);
      attemptRef.current = null;
      releaseIapConnection(purchaseListener ? iap.endConnection : undefined);
    };
  }, [settle]);

  const tip = useCallback(async () => {
    if (!iapModule || !product || activeAttempt.current) return;
    const token = createAttemptToken();
    const attempt: TipAttempt = {
      token,
      deadline: Date.now() + OUTCOME_TIMEOUT_MS,
      timeout: setTimeout(() => settle(attempt), OUTCOME_TIMEOUT_MS),
      pendingNotified: false,
    };
    attempts.set(token, attempt);
    activeAttempt.current = attempt;
    setLoading(true);
    try {
      const result = await iapModule.requestPurchase({
        request: {
          apple: { sku: ACTIVE_TIP_SKU, appAccountToken: token },
          google: { skus: [ACTIVE_TIP_SKU], obfuscatedAccountId: token },
        },
        type: 'in-app',
      });
      // Play may resolve with an empty list for deferred payment. Release the
      // button but keep the marker for a later receipt.
      if (Platform.OS === 'android' && Array.isArray(result) && result.length === 0) settle(attempt);
      const purchases = Array.isArray(result) ? result : result ? [result] : [];
      const tipPurchases = purchases.filter(item => item.productId === ACTIVE_TIP_SKU &&
        (item.purchaseState === 'purchased' || item.purchaseState === 'pending'));
      // Play can return an already-owned receipt in place of a new purchase.
      if (tipPurchases.length > 0 && !tipPurchases.some(purchase => getAttemptToken(purchase) === token)) {
        settle(attempt);
        attempts.delete(token);
      }
      for (const purchase of purchases) await handlers.current?.purchase(purchase);
    } catch (error) {
      handlers.current?.error(error as ExpoPurchaseError | undefined, attempt);
    }
  }, [product, settle]);

  return { product, loading, unavailable, unsupported, tip };
}

const TipJarContext = createContext<ReturnType<typeof useTipJarController> | null>(null);

export function TipJarProvider({ children }: { children: ReactNode }) {
  const tipJar = useTipJarController();
  return createElement(TipJarContext.Provider, { value: tipJar }, children);
}

export function useTipJar() {
  const tipJar = useContext(TipJarContext);
  if (!tipJar) throw new Error('TipJarProvider is required');
  return tipJar;
}
