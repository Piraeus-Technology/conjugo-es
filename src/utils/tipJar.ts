import { createContext, createElement, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
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

let iapModule: typeof import('react-native-iap') | null = null;
try {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module; import would throw in Expo Go/web
    iapModule = require('react-native-iap');
  }
} catch {
  // react-native-iap not available (Expo Go, web, etc.)
}

type Product = import('react-native-iap').Product;
type Purchase = import('react-native-iap').Purchase;
type PurchaseError = import('react-native-iap').PurchaseError;

const OUTCOME_TIMEOUT_MS = 120_000;

interface TipAttempt {
  token: string;
  deadline: number;
  timeout: ReturnType<typeof setTimeout>;
  pendingNotified: boolean;
}

const attempts = new Map<string, TipAttempt>();
const finishing = new Set<string>();
const finished = new Map<string, number>();
const attentionNotified = new Set<string>();
let finishSequence = 0;

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

function useTipJarController() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(!iapModule);
  const activeAttempt = useRef<TipAttempt | null>(null);
  const sweepRef = useRef<(() => Promise<void>) | null>(null);

  const settle = useCallback((attempt: TipAttempt) => {
    if (activeAttempt.current !== attempt) return;
    clearTimeout(attempt.timeout);
    activeAttempt.current = null;
    setLoading(false);
  }, []);

  const handlePurchaseError = useCallback((error: Partial<PurchaseError> | undefined, attempt: TipAttempt | null) => {
    const codes = iapModule!.ErrorCode;
    const code = error?.code;
    if (code && code === codes.DuplicatePurchase) {
      void sweepRef.current?.();
      return;
    }
    // The Apple finisher emits this event before the JS API treats its
    // corresponding rejection as an already-finished transaction.
    if (Platform.OS === 'ios' && code === codes.PurchaseError && error?.message === 'Transaction not found') return;
    if (!attempt || attempt !== activeAttempt.current || (error?.productId && error.productId !== ACTIVE_TIP_SKU)) return;
    settle(attempt);
    if (code === codes.DeferredPayment || code === codes.Pending) {
      showPending(attempt);
      return;
    }
    attempts.delete(attempt.token);
    if (code === codes.AlreadyOwned) {
      void sweepRef.current?.();
      return;
    }
    if (code === codes.UserCancelled || code === codes.ReceiptFinished || code === codes.PurchaseVerificationFinished) return;
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

    const keyFor = (purchase: Purchase) => getTipTransactionKey(purchase, Platform.OS);

    const handlePurchase = async (purchase: Purchase) => {
      if (!mounted || !CONSUMABLE_TIP_SKUS.has(purchase.productId)) return;
      const token = 'appAccountToken' in purchase ? purchase.appAccountToken
        : 'obfuscatedAccountIdAndroid' in purchase ? purchase.obfuscatedAccountIdAndroid : undefined;
      const attempt = purchase.productId === ACTIVE_TIP_SKU && token ? attempts.get(token.toLowerCase()) : undefined;
      if (purchase.purchaseState === 'pending') {
        if (attempt) {
          settle(attempt);
          showPending(attempt);
        }
        return;
      }
      if (purchase.purchaseState !== 'purchased') return;
      if (attempt) settle(attempt);
      const key = keyFor(purchase);
      if (!key || finished.has(key) || finishing.has(key)) return;

      finishing.add(key);
      try {
        await iap.finishTransaction({ purchase, isConsumable: true });
        finished.set(key, ++finishSequence);
        attentionNotified.delete(key);
        if (attempt) {
          attempts.delete(attempt.token);
          Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
        }
      } catch (error) {
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
      if (!connected || !mounted) return;
      if (sweep) return sweep;
      const lastFinish = finishSequence;
      sweep = (async () => {
        const purchases = Platform.OS === 'ios'
          ? await iap.getPendingTransactionsIOS()
          : await iap.getAvailablePurchases();
        for (const purchase of purchases) {
          if (!mounted) return;
          const key = keyFor(purchase);
          // The pinned Android bridge can return success even when Play's
          // consume call returns false. A fresh ownership query can retry it.
          if (Platform.OS === 'android' && key && (finished.get(key) ?? Infinity) <= lastFinish) {
            finished.delete(key);
          }
          await handlePurchase(purchase);
        }
      })().catch(error => console.warn('Failed to recover tip transactions:', error))
        .finally(() => { sweep = undefined; });
      return sweep;
    };
    sweepRef.current = recover;

    const attachListeners = () => {
      purchaseListener?.remove();
      errorListener?.remove();
      purchaseListener = iap.purchaseUpdatedListener(handlePurchase);
      errorListener = iap.purchaseErrorListener(error => {
        if (mounted && connected) handlePurchaseError(error, activeAttempt.current);
      });
    };

    // Early registration can attach when Nitro is available. Re-register
    // after init because an early registration can be inert and end clears it.
    attachListeners();

    const connect = async () => {
      if (connected || connecting) return;
      connecting = true;
      try {
        await waitForPendingIapEnd();
        if (!mounted) return;
        connected = await iap.initConnection();
        if (!mounted) return;
        if (!connected) {
          setUnavailable(true);
          return;
        }
        attachListeners();
        void recover();
        const items = await iap.fetchProducts({ skus: [ACTIVE_TIP_SKU] });
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
      appState.remove();
      purchaseListener?.remove();
      errorListener?.remove();
      if (attemptRef.current) clearTimeout(attemptRef.current.timeout);
      attemptRef.current = null;
      releaseIapConnection(iap.endConnection);
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
      // The outcome comes from store events. A settled JS request alone
      // does not tell us whether the purchase went through.
      await iapModule.requestPurchase({
        request: {
          apple: { sku: ACTIVE_TIP_SKU, appAccountToken: token },
          google: { skus: [ACTIVE_TIP_SKU], obfuscatedAccountId: token },
        },
        type: 'in-app',
      });
    } catch (error) {
      handlePurchaseError(error as PurchaseError | undefined, attempt);
    }
  }, [handlePurchaseError, product, settle]);

  return { product, loading, unavailable, unsupported: !iapModule, tip };
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
