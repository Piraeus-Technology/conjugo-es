import appConfig from '../../app.json';

const expoConfig = appConfig.expo;

export const APP_NAME = expoConfig.name;
export const APP_VERSION = expoConfig.version;
export const APP_STORE_URL = 'https://apps.apple.com/app/id6759270074';
export const APP_REVIEW_URL = `${APP_STORE_URL}?action=write-review`;
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.piraeus.conjugoes';
export const PLAY_STORE_REVIEW_URL = 'market://details?id=com.piraeus.conjugoes';
export const PRIVACY_POLICY_URL = 'https://piraeus-technology.github.io/conjugo-es/';
export const FEEDBACK_EMAIL = 'contact@piraeus.app';

export type StorePlatform = 'ios' | 'android' | 'other';

export function getStoreName(platform: StorePlatform): string {
  if (platform === 'android') return 'Google Play';
  if (platform === 'ios') return 'the App Store';
  return 'the app store';
}

export function getStoreUrl(platform: StorePlatform): string {
  return platform === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
}

export function getReviewUrl(platform: StorePlatform): string {
  return platform === 'android' ? PLAY_STORE_REVIEW_URL : APP_REVIEW_URL;
}

export function getShareMessage(platform: StorePlatform): string {
  return `Check out ${APP_NAME} — a Spanish verb conjugation app! ${getStoreUrl(platform)}`;
}
