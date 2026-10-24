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
    '!src/cli.ts', // CLI is tested separately
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 11,
      functions: 29,
      lines: 30,
      statements: 29,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 10000,
};
