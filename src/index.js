// index.js
import { config } from './config.js';

async function init() {
  await config.load();
  // rest of application logic
}

init().catch(console.error);
