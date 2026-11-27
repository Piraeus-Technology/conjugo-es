import { getTipTransactionKey } from '../utils/tipJar';

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'web' },
}));

describe('tip jar transaction keying', () => {
  test('keys purchases by the same platform identifier required by the finisher', () => {
    const ios = { id: '2000000123456789', purchaseState: 'purchased' };
    const android = { purchaseToken: 'play-token', id: 'GPA.0000-0000-0000-00000', purchaseState: 'purchased' };
    expect(getTipTransactionKey(android, 'android')).toBe('play-token');
    expect(getTipTransactionKey(ios, 'ios')).toBe(ios.id);
    expect(getTipTransactionKey({ id: 'id', purchaseToken: ' ' }, 'android')).toBeNull();
    expect(getTipTransactionKey({ purchaseToken: 'token' }, 'ios')).toBeNull();
  });
});
