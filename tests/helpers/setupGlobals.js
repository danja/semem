import fetch from 'node-fetch'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill globals for Node.js environment
globalThis.fetch = fetch
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder