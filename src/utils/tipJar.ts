import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
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

  useEffect(() => {
    let purchaseListener: ReturnType<typeof purchaseUpdatedListener> | null = null;
    let errorListener: ReturnType<typeof purchaseErrorListener> | null = null;

    const init = async () => {
      try {
        await initConnection();
        const items = await fetchProducts({ skus: TIP_SKUS });
        const inAppItems = (items as Product[]).filter(p => p.type === 'in-app');
        inAppItems.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        setProducts(inAppItems);
      } catch {
        // IAP not available (e.g. simulator)
      }

      purchaseListener = purchaseUpdatedListener(async (purchase: Purchase) => {
        try {
          await finishTransaction({ purchase, isConsumable: true });
          Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
        } catch {}
      });

      errorListener = purchaseErrorListener((error: PurchaseError) => {
        if (error.code !== ErrorCode.UserCancelled) {
          Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
        }
      });
    };

    init();

    return () => {
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
      // handled by error listener
    } finally {
      setLoading(false);
    }
  }, []);

  return { products, loading, tip };
}
