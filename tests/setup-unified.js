/**
 * Unified Test Setup for Semem
 *
 * All tests use live services and real network calls.
 */

import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

const { default: fetch } = await import('node-fetch');
global.fetch = fetch;

global.TEST_TIMEOUT = 30000;
global.waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

if (!global.structuredClone) {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
