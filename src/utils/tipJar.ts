import { useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import {
  hasPendingIapEnd,
  releaseIapConnection,
  retainIapConnection,
  waitForPendingIapEnd,
} from './iapLifecycle';

const TIP_SKUS = ['tip_small', 'tip_medium', 'tip_large'];

const NO_OP_RESULT = {
  products: [] as any[],
  loading: false,
  unavailable: true,
  unsupported: true,
  tip: async () => {},
};

type TipTransactionLike = {
  transactionId?: string | null;
  purchaseToken?: string | null;
  id?: string | null;
};

function nonEmpty(value?: string | null): string | null {
  return value && value.trim().length > 0 ? value : null;
}

export function getTipTransactionKey(purchase: TipTransactionLike): string | null {
  return nonEmpty(purchase.transactionId)
    ?? nonEmpty(purchase.purchaseToken)
    ?? nonEmpty(purchase.id);
}

let iapModule: any = null;
try {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    iapModule = require('react-native-iap');
  }
} catch {
  // react-native-iap not available (Expo Go, web, etc.)
}

export function useTipJar() {
  if (!iapModule) {
    return NO_OP_RESULT;
  }
  return useTipJarNative();
}

function useTipJarNative() {
  const {
    initConnection,
    endConnection,
    fetchProducts,
    getAvailablePurchases,
    requestPurchase,
    finishTransaction,
    purchaseUpdatedListener,
    purchaseErrorListener,
    ErrorCode,
  } = iapModule;
  type Product = import('react-native-iap').Product;
  type Purchase = import('react-native-iap').Purchase;
  type PurchaseError = import('react-native-iap').PurchaseError;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [unsupported] = useState(false);

  useEffect(() => {
    let mounted = true;
    let purchaseListener: ReturnType<typeof purchaseUpdatedListener> | null = null;
    let errorListener: ReturnType<typeof purchaseErrorListener> | null = null;
    // Track per-mount finishTransaction failures by stable transaction key so
    // OS replays don't trap the user in repeated attention alerts.
    const failedTransactionIds = new Set<string>();
    // Claimed-before-finish keys shared by the listener and the Android
    // startup sweep, so the same transaction can't be finished twice (the
    // loser of that race throws and used to alert "Purchase Needs Attention"
    // for a purchase that actually completed fine).
    const claimedTransactionKeys = new Set<string>();
    const claimTransaction = (purchase: Purchase): boolean => {
      const key = getTipTransactionKey(purchase);
      if (!key) return true; // no stable key to dedupe on — proceed
      if (claimedTransactionKeys.has(key)) return false;
      claimedTransactionKeys.add(key);
      return true;
    };
    const releaseTransactionClaim = (purchase: Purchase) => {
      const key = getTipTransactionKey(purchase);
      if (key) claimedTransactionKeys.delete(key);
    };
    retainIapConnection();

    const handlePurchaseUpdated = async (purchase: Purchase) => {
      const txKey = getTipTransactionKey(purchase);
      if (!claimTransaction(purchase)) return; // the other path is finishing it
      try {
        await finishTransaction({ purchase, isConsumable: true });
        if (!mounted) return;
        setLoading(false);
        // Always thank on success — the user deserves the confirmation
        // even (especially) when the same transaction had previously
        // failed and we'd warned them with "Purchase Needs Attention".
        Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
        if (txKey) failedTransactionIds.delete(txKey);
      } catch (error) {
        console.warn('Failed to finish tip transaction:', error);
        // Release the claim so an OS replay can retry the finish.
        releaseTransactionClaim(purchase);
        if (!mounted) return;
        setLoading(false);
        if (txKey && failedTransactionIds.has(txKey)) {
          // Already alerted on this transaction this mount — stay quiet.
          return;
        }
        if (txKey) failedTransactionIds.add(txKey);
        Alert.alert(
          'Purchase Needs Attention',
          'Your tip was received, but we could not finish the transaction. Please reopen the app or try again later.'
        );
      }
    };

    const handlePurchaseError = (error: PurchaseError) => {
      if (!mounted) return;
      setLoading(false);
      if (error.code !== ErrorCode.UserCancelled) {
        Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
      }
    };

    const attachListeners = () => {
      purchaseListener?.remove();
      errorListener?.remove();
      purchaseListener = purchaseUpdatedListener(handlePurchaseUpdated);
      errorListener = purchaseErrorListener(handlePurchaseError);
    };

    // Attach immediately so cleanup always has concrete subscriptions to
    // remove. If a previous screen's endConnection is already in flight, init
    // will reattach after it resolves because react-native-iap clears JS
    // listeners during endConnection.
    attachListeners();

    const init = async () => {
      try {
        const shouldReattachAfterEnd = hasPendingIapEnd();
        await waitForPendingIapEnd();
        if (!mounted) return;
        if (shouldReattachAfterEnd) {
          attachListeners();
        }
        await initConnection();
        if (!mounted) return;
        setUnavailable(false);
        if (Platform.OS === 'android') {
          try {
            const pendingPurchases = await getAvailablePurchases();
            for (const purchase of pendingPurchases) {
              if (!TIP_SKUS.includes(purchase.productId)) continue;
              if (!claimTransaction(purchase)) continue; // listener already finishing it
              try {
                await finishTransaction({ purchase, isConsumable: true });
              } catch {
                // Release so a later replay can retry; one stuck purchase
                // shouldn't abort the rest of the sweep.
                releaseTransactionClaim(purchase);
              }
            }
          } catch {
            // Safe to ignore when there are no cached Android tip purchases to finish.
          }
        }
        if (!mounted) return;
        const items = await fetchProducts({ skus: TIP_SKUS });
        if (!mounted) return;
        const inAppItems = (items as Product[]).filter(p => p.type === 'in-app');
        inAppItems.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
        setProducts(inAppItems);
        setUnavailable(inAppItems.length === 0);
      } catch {
        if (!mounted) return;
        setProducts([]);
        setUnavailable(true);
      }
    };

    init();

    return () => {
      mounted = false;
      purchaseListener?.remove();
      errorListener?.remove();
      releaseIapConnection(endConnection);
    };
  }, []);

  const tip = useCallback(async (sku: string) => {
    setLoading(true);
    try {
      await requestPurchase({
        request: { apple: { sku }, google: { skus: [sku] } },
        type: 'in-app',
      });
    } catch {
      setLoading(false);
      // handled by error listener
    }
  }, []);

  return { products, loading, unavailable, unsupported, tip };
}
