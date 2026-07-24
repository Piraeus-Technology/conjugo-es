// Setup for the jest-expo "ui" project only. The "logic" project mocks
// AsyncStorage per-test instead.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Vector icons load their font asynchronously on mount. The behavior belongs
// to Expo, not these component tests, and otherwise produces act() warnings
// after each test has finished.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIonicon = ({ name, ...props }) =>
    React.createElement(Text, props, name);
  MockIonicon.glyphMap = {};
  return { __esModule: true, default: MockIonicon };
});

// Eagerly resolve expo's lazy "winter" runtime globals. Each is a getter
// whose first access require()s its polyfill module; if that first access
// happens at an inopportune point in a suite's lifecycle (seen on CI Linux),
// jest throws "You are trying to `import` a file outside of the scope of
// the test code". Touching them here forces the require while the module
// registry is definitely valid.
void globalThis.__ExpoImportMetaRegistry;
void globalThis.structuredClone;
void globalThis.TextDecoder;
void globalThis.TextDecoderStream;
void globalThis.TextEncoderStream;
void globalThis.URL;
void globalThis.URLSearchParams;
