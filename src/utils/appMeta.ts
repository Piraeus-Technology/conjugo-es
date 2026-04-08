import appConfig from '../../app.json';

const expoConfig = appConfig.expo;

export const APP_NAME = expoConfig.name;
export const APP_VERSION = expoConfig.version;
export const APP_STORE_URL = 'https://apps.apple.com/app/id6759270074';
export const APP_REVIEW_URL = `${APP_STORE_URL}?action=write-review`;
export const PRIVACY_POLICY_URL = 'https://piraeus-technology.github.io/conjugo-es/';
export const FEEDBACK_EMAIL = 'contact@piraeus.app';
export const SHARE_MESSAGE = `Check out ${APP_NAME} — a Spanish verb conjugation app! ${APP_STORE_URL}`;
