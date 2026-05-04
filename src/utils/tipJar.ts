import { useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';

const TIP_SKUS = ['tip_small', 'tip_medium', 'tip_large'];

const NO_OP_RESULT = {
  products: [] as any[],
  loading: false,
  unavailable: true,
  unsupported: true,
  tip: async () => {},
};

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

    // Attach listeners synchronously before any awaits so cleanup always
    // sees them. Any purchase events that fire before init completes are
    // still delivered, and unmount-during-init can't leak listeners.
    const purchaseListener = purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        await finishTransaction({ purchase, isConsumable: true });
        if (!mounted) return;
        setLoading(false);
        Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
      } catch (error) {
        console.warn('Failed to finish tip transaction:', error);
        if (!mounted) return;
        setLoading(false);
        Alert.alert(
          'Purchase Needs Attention',
          'Your tip was received, but we could not finish the transaction. Please reopen the app or try again later.'
        );
      }
    });

    const errorListener = purchaseErrorListener((error: PurchaseError) => {
      if (!mounted) return;
      setLoading(false);
      if (error.code !== ErrorCode.UserCancelled) {
        Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
      }
    });

    const init = async () => {
      try {
        await initConnection();
        if (!mounted) return;
        setUnavailable(false);
        if (Platform.OS === 'android') {
          try {
            const pendingPurchases = await getAvailablePurchases();
            for (const purchase of pendingPurchases) {
              if (TIP_SKUS.includes(purchase.productId)) {
                await finishTransaction({ purchase, isConsumable: true });
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
      // endConnection is async; fire-and-forget so cleanup stays sync.
      // Swallow errors — a fresh mount's initConnection is idempotent.
      Promise.resolve()
        .then(() => endConnection?.())
        .catch(() => {});
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
