import { createContext, createElement, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import type { ExpoPurchaseError, Product, Purchase } from 'expo-iap';
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
  const sweepRef = useRef<(() => Promise<void>) | null>(null);
  const purchaseHandlerRef = useRef<((purchase: Purchase) => Promise<void>) | null>(null);

  const settle = useCallback((attempt: TipAttempt) => {
    if (activeAttempt.current !== attempt) return;
    clearTimeout(attempt.timeout);
    activeAttempt.current = null;
    setLoading(false);
  }, []);

  const handlePurchaseError = useCallback((error: Partial<ExpoPurchaseError> | undefined, attempt: TipAttempt | null) => {
    const codes = iapModule?.ErrorCode;
    if (!codes) return;
    const code = error?.code;
    if (code === codes.DuplicatePurchase) {
      if (!error?.productId || CONSUMABLE_TIP_SKUS.has(error.productId)) void sweepRef.current?.();
      return;
    }
    if (error?.productId && error.productId !== ACTIVE_TIP_SKU) return;
    if (code === codes.AlreadyOwned) void sweepRef.current?.();
    if (!attempt || attempt !== activeAttempt.current) return;
    settle(attempt);
    if (code === codes.DeferredPayment || code === codes.Pending) {
      showPending(attempt);
      return;
    }
    attempts.delete(attempt.token);
    if (code === codes.AlreadyOwned || code === codes.UserCancelled || code === codes.PurchaseVerificationFinished) return;
    Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
  }, [settle]);

  useEffect(() => {
    const iap = iapModule;
    if (!iap) return;

    let mounted = true;
    let connected = false;
    let connecting = false;
    let sweep: Promise<void> | undefined;
    let purchaseListener: ReturnType<typeof iap.purchaseUpdatedListener> | undefined;
    let errorListener: ReturnType<typeof iap.purchaseErrorListener> | undefined;
    retainIapConnection();

    const handlePurchase = async (purchase: Purchase) => {
      if (!mounted || !CONSUMABLE_TIP_SKUS.has(purchase.productId)) return;
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
        await iap.finishTransaction({ purchase, isConsumable: true });
        finished.add(key);
        attentionNotified.delete(key);
        if (attempt) {
          attempts.delete(attempt.token);
          Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
        }
      } catch (error) {
        // Play can redeliver a token that has already been consumed.
        if (Platform.OS === 'android' && (error as ExpoPurchaseError)?.code === iap.ErrorCode.ItemNotOwned) {
          finished.add(key);
          attentionNotified.delete(key);
          if (attempt) attempts.delete(attempt.token);
          return;
        }
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
    purchaseHandlerRef.current = handlePurchase;

    const recover = async () => {
      if (!connected || !mounted) return;
      if (sweep) return sweep;
      sweep = (async () => {
        const purchases = Platform.OS === 'ios'
          ? await iap.getPendingTransactionsIOS()
          : await iap.getAvailablePurchases();
        for (const purchase of purchases) {
          if (!mounted) return;
          await handlePurchase(purchase);
        }
      })().catch(error => console.warn('Failed to recover tip transactions:', error))
        .finally(() => { sweep = undefined; });
      return sweep;
    };
    sweepRef.current = recover;

    const connect = async () => {
      if (connected || connecting) return;
      connecting = true;
      try {
        await waitForPendingIapEnd();
        if (!mounted) return;
        // StoreKit can replay unfinished transactions during init. Preserve
        // replays so a failed finish can be retried by this controller.
        try {
          purchaseListener ??= iap.purchaseUpdatedListener(handlePurchase, { dedupeTransactionIOS: false });
          errorListener ??= iap.purchaseErrorListener(error => {
            if (mounted && connected) handlePurchaseError(error, activeAttempt.current);
          });
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
        void recover();
        const items = await iap.fetchProducts({ skus: [ACTIVE_TIP_SKU], type: 'in-app' });
        if (!mounted) return;
        const tipProduct = items?.find(item => item.id === ACTIVE_TIP_SKU && item.type === 'in-app');
        setProduct(tipProduct?.type === 'in-app' ? tipProduct : null);
        setUnavailable(tipProduct?.type !== 'in-app');
      } catch {
        if (mounted) setUnavailable(true);
      } finally {
        connecting = false;
      }
    };

    void connect();
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      const attempt = activeAttempt.current;
      if (attempt && attempt.deadline <= Date.now()) settle(attempt);
      if (connected) void recover();
      else void connect();
    });

    const attemptRef = activeAttempt;
    return () => {
      mounted = false;
      sweepRef.current = null;
      purchaseHandlerRef.current = null;
      appState.remove();
      purchaseListener?.remove();
      errorListener?.remove();
      if (attemptRef.current) clearTimeout(attemptRef.current.timeout);
      attemptRef.current = null;
      releaseIapConnection(purchaseListener ? iap.endConnection : undefined);
    };
  }, [handlePurchaseError, settle]);

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
      if (activeAttempt.current !== attempt) return;
      // Play can return an already-owned receipt in place of a new purchase.
      // An empty response still needs a store event or the watchdog.
      const purchases = Array.isArray(result) ? result : result ? [result] : [];
      const purchase = purchases.find(item => item.productId === ACTIVE_TIP_SKU &&
        (item.purchaseState === 'purchased' || item.purchaseState === 'pending'));
      if (!purchase) return;
      if (getAttemptToken(purchase) !== token) {
        settle(attempt);
        attempts.delete(token);
      }
      await purchaseHandlerRef.current?.(purchase);
    } catch (error) {
      const purchaseError = error as ExpoPurchaseError | undefined;
      if (purchaseError?.code === iapModule.ErrorCode.DuplicatePurchase) settle(attempt);
      handlePurchaseError(purchaseError, attempt);
    }
  }, [handlePurchaseError, product, settle]);

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
