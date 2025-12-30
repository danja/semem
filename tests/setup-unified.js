/**
 * Unified Test Setup for Semem
 *
 * This file provides different setup modes based on environment variables:
 * - E2E mode: No mocking, real network calls, real console output
 * - Integration mode: Minimal mocking, service checks
 * - Unit mode: Full mocking for isolated testing
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Detect test mode from environment or config
const isE2ETest = process.env.E2E_TESTS === 'true' || process.env.INTEGRATION_TESTS === 'true';
const isIntegrationTest = process.env.INTEGRATION_TESTS === 'true' && !isE2ETest;
const isUnitTest = !isE2ETest && !isIntegrationTest;

console.log(`🔧 Test setup mode: ${isE2ETest ? 'E2E' : isIntegrationTest ? 'Integration' : 'Unit'}`);

// Common environment setup
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

if (isE2ETest) {
  // E2E Mode: Real everything, no mocking
  console.log('🚀 E2E Mode: Using real services and network calls');

  // Provide real fetch from node-fetch for compatibility
  const { default: fetch } = await import('node-fetch');
  global.fetch = fetch;

  // Keep real console for debugging
  // No mocking of any services

} else if (isIntegrationTest) {
  // Integration Mode: Some mocking, service checks
  console.log('🔗 Integration Mode: Limited mocking with service checks');

  // Import service checker for availability tests
  let ServiceChecker;
  try {
    ServiceChecker = (await import('./helpers/serviceChecks.js')).default;
  } catch (error) {
    console.warn('Service checker not available, skipping service checks');
  }

  // Provide fetch but allow real network calls
  const { default: fetch } = await import('node-fetch');
  global.fetch = fetch;

  // Mock only problematic external services
  vi.mock('d3', () => ({
    default: {
      select: vi.fn(() => ({
        selectAll: vi.fn(() => ({
          data: vi.fn(() => ({
            enter: vi.fn(() => ({
              append: vi.fn(() => ({
                attr: vi.fn(() => ({})),
                style: vi.fn(() => ({})),
                text: vi.fn(() => ({}))
              }))
            }))
          }))
        }))
      })),
      scaleLinear: vi.fn(() => ({
        domain: vi.fn(() => ({
          range: vi.fn(() => vi.fn())
        }))
      }))
    }
  }));

  // Check service availability
  let serviceStatus = {};
  beforeAll(async () => {
    if (ServiceChecker) {
      try {
        serviceStatus = await ServiceChecker.checkAllServices();
      } catch (error) {
        console.warn('Service check failed:', error);
        serviceStatus = {};
      }
    }
  });

  // Minimal cleanup
  afterEach(() => {
    vi.clearAllMocks();
  });

} else {
  // Unit Mode: Full mocking for isolated tests
  console.log('🧪 Unit Mode: Full mocking for isolated testing');

  // Mock console to reduce test noise
  global.console = {
    ...console,
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: console.error // Keep errors visible
  };

  // Mock fetch for controlled testing
  const fetchMock = vi.fn();
  global.fetch = fetchMock;

  // Mock node-fetch module
  vi.mock('node-fetch', () => ({
    default: vi.fn(),
    __esModule: true,
  }));

  // Mock problematic dependencies
  vi.mock('d3', () => ({
    default: {
      select: vi.fn(() => ({
        selectAll: vi.fn(() => ({
          data: vi.fn(() => ({
            enter: vi.fn(() => ({
              append: vi.fn(() => ({
                attr: vi.fn(() => ({})),
                style: vi.fn(() => ({})),
                text: vi.fn(() => ({}))
              }))
            }))
          }))
        }))
      })),
      scaleLinear: vi.fn(() => ({
        domain: vi.fn(() => ({
          range: vi.fn(() => vi.fn())
        }))
      }))
    }
  }));

  // Set up fake timers
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (fetchMock) fetchMock.mockReset();
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

// Common utilities available in all modes
global.TEST_TIMEOUT = 30000;

global.waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Export test mode flags for conditional test behavior
export const testMode = {
  isE2E: isE2ETest,
  isIntegration: isIntegrationTest,
  isUnit: isUnitTest
};

// Global polyfills
if (!global.structuredClone) {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
