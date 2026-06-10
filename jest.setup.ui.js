// Setup for the jest-expo "ui" project only. The "logic" project mocks
// AsyncStorage per-test instead.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
