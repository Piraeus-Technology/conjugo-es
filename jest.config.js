// Two projects: fast node/ts-jest for pure logic (the bulk of the suite),
// and jest-expo for component/hook tests that need the React Native runtime.
module.exports = {
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      collectCoverageFrom: [
        '<rootDir>/src/**/*.ts',
        '!<rootDir>/src/**/*.d.ts',
        '!<rootDir>/src/__tests__/**',
        '!<rootDir>/src/data/**',
      ],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.test.tsx'],
      collectCoverageFrom: [
        '<rootDir>/src/**/*.tsx',
        '!<rootDir>/src/__tests__/**',
      ],
      setupFiles: ['<rootDir>/jest.setup.ui.js'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)/|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
      ],
    },
  ],
};
