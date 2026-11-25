module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // ts before js so a stray compiled .js can never shadow its .ts source under test
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: false,
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(p-queue|p-timeout|p-defer)/)'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/cli.ts', // exercised end to end by src/tests/cli.test.ts in a child process, which Jest cannot instrument
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      // Measured 2026-11: statements 98.1, branches 92.9, functions 97.6, lines 98.6. Keep these a
      // couple of points below the measurement so a real drop fails, and raise them when coverage rises.
      branches: 90,
      functions: 96,
      lines: 96,
      statements: 96,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 10000,
};
