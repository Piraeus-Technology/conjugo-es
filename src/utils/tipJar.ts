import { useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  getAvailablePurchases,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  type Product,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';

const TIP_SKUS = ['tip_small', 'tip_medium', 'tip_large'];

export function useTipJar() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    let purchaseListener: ReturnType<typeof purchaseUpdatedListener> | null = null;
    let errorListener: ReturnType<typeof purchaseErrorListener> | null = null;

    const init = async () => {
      try {
        await initConnection();
        if (mounted) {
          setUnavailable(false);
        }
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
        const items = await fetchProducts({ skus: TIP_SKUS });
        const inAppItems = (items as Product[]).filter(p => p.type === 'in-app');
        inAppItems.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        if (mounted) {
          setProducts(inAppItems);
          setUnavailable(inAppItems.length === 0);
        }
      } catch {
        if (mounted) {
          setProducts([]);
          setUnavailable(true);
        }
      }

      purchaseListener = purchaseUpdatedListener(async (purchase: Purchase) => {
        try {
          await finishTransaction({ purchase, isConsumable: true });
          if (mounted) {
            setLoading(false);
          }
          Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
        } catch {
          if (mounted) {
            setLoading(false);
          }
        }
      });

      errorListener = purchaseErrorListener((error: PurchaseError) => {
        if (mounted) {
          setLoading(false);
        }
        if (error.code !== ErrorCode.UserCancelled) {
          Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
        }
      });
    };

    init();

    return () => {
      mounted = false;
      purchaseListener?.remove();
      errorListener?.remove();
      endConnection();
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

  return { products, loading, unavailable, tip };
}
