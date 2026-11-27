import { getTipTransactionKey } from '../utils/tipJar';

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'web' },
}));

describe('tip jar transaction keying', () => {
  test('keys purchases by the same platform identifier required by the finisher', () => {
    const android = { purchaseToken: 'token', id: 'id' };
    expect(getTipTransactionKey(android, 'android')).toBe('token');
    expect(getTipTransactionKey(android, 'ios')).toBe('id');
    expect(getTipTransactionKey({ id: 'id', purchaseToken: ' ' }, 'android')).toBeNull();
    expect(getTipTransactionKey({ purchaseToken: 'token' }, 'ios')).toBeNull();
  });
});
