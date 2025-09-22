// Jest setup file for global test configuration
import { jest } from '@jest/globals';

// Mock p-queue globally to avoid ES module issues
jest.mock('p-queue', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn((fn: any) => Promise.resolve(fn())), // eslint-disable-line @typescript-eslint/no-explicit-any
    pending: 0,
    size: 0,
    isPaused: false,
    pause: jest.fn(),
    start: jest.fn(),
    clear: jest.fn(),
  }));
});

// Custom matcher for University objects
expect.extend({
  toBeValidUniversity(received: unknown) {
    const pass =
      received &&
      typeof received === 'object' &&
      'id' in received &&
      typeof (received as Record<string, unknown>).id === 'string' &&
      'name' in received &&
      typeof (received as Record<string, unknown>).name === 'string' &&
      'country' in received &&
      typeof (received as Record<string, unknown>).country === 'string' &&
      'countryCode' in received &&
      typeof (received as Record<string, unknown>).countryCode === 'string' &&
      'webPages' in received &&
      Array.isArray((received as Record<string, unknown>).webPages) &&
      'domains' in received &&
      Array.isArray((received as Record<string, unknown>).domains);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid university`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid university with required fields`,
        pass: false,
      };
    }
  },
});

// Mock console.log for cleaner test output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
