import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  getReviewUrl,
  getShareMessage,
  getStoreName,
} from '../utils/appMeta';

describe('platform store metadata', () => {
  test('Android support surfaces use Google Play', () => {
    expect(getStoreName('android')).toBe('Google Play');
    expect(getReviewUrl('android')).toMatch(/^market:\/\/details\?id=/);
    expect(getShareMessage('android')).toContain(PLAY_STORE_URL);
    expect(getShareMessage('android')).not.toContain(APP_STORE_URL);
  });

  test('iOS support surfaces use the App Store', () => {
    expect(getStoreName('ios')).toBe('the App Store');
    expect(getReviewUrl('ios')).toContain(APP_STORE_URL);
    expect(getShareMessage('ios')).toContain(APP_STORE_URL);
  });
});
