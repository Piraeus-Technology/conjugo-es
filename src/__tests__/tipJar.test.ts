import { getTipTransactionKey } from '../utils/tipJar';

// jest.mock is hoisted above the import at runtime regardless of order.
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'web' },
}));

describe('tip jar transaction keying', () => {
  test('uses stable transaction identifiers before falling back to no dedupe key', () => {
    expect(getTipTransactionKey({
      transactionId: 'tx-1',
      purchaseToken: 'token-1',
      id: 'id-1',
    })).toBe('tx-1');

    expect(getTipTransactionKey({
      purchaseToken: 'token-1',
      id: 'id-1',
    })).toBe('token-1');

    expect(getTipTransactionKey({
      id: 'id-1',
    })).toBe('id-1');
  });

  test('does not dedupe distinct purchases by product id alone', () => {
    expect(getTipTransactionKey({
      productId: 'tip_small',
    } as any)).toBeNull();

    expect(getTipTransactionKey({
      transactionId: '',
      purchaseToken: '   ',
      productId: 'tip_small',
    } as any)).toBeNull();
  });
});
