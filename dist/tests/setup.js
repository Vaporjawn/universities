"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Jest setup file for global test configuration
const globals_1 = require("@jest/globals");
// Mock p-queue globally to avoid ES module issues
globals_1.jest.mock('p-queue', () => {
    return globals_1.jest.fn().mockImplementation(() => ({
        add: globals_1.jest.fn((fn) => Promise.resolve(fn())), // eslint-disable-line @typescript-eslint/no-explicit-any
        pending: 0,
        size: 0,
        isPaused: false,
        pause: globals_1.jest.fn(),
        start: globals_1.jest.fn(),
        clear: globals_1.jest.fn(),
    }));
});
// Custom matcher for University objects
expect.extend({
    toBeValidUniversity(received) {
        const pass = received &&
            typeof received === 'object' &&
            'id' in received &&
            typeof received.id === 'string' &&
            'name' in received &&
            typeof received.name === 'string' &&
            'country' in received &&
            typeof received.country === 'string' &&
            'countryCode' in received &&
            typeof received.countryCode === 'string' &&
            'webPages' in received &&
            Array.isArray(received.webPages) &&
            'domains' in received &&
            Array.isArray(received.domains);
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid university`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be a valid university with required fields`,
                pass: false,
            };
        }
    },
});
// Mock console.log for cleaner test output
globals_1.jest.spyOn(console, 'log').mockImplementation(() => { });
globals_1.jest.spyOn(console, 'warn').mockImplementation(() => { });
//# sourceMappingURL=setup.js.map