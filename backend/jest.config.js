/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './tests/helpers/globalSetup.js',
  verbose: true,
  detectOpenHandles: true,
  testTimeout: 20000,
  collectCoverageFrom: [
    'src/**/*.service.js',
    '!src/**/index.js',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
};
