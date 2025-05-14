// tests/helpers/setupGlobals.js - Global test setup for Vitest
// This file replaces the old Jasmine helper with a Vitest-compatible version

// Add any global polyfills here if needed
if (!global.structuredClone) {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Add any other global setup needed for tests