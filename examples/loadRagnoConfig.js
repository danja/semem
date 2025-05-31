// Utility: Load and parse ragno-config.json
import fs from 'fs/promises';
import path from 'path';

export default async function loadRagnoConfig() {
  const configPath = path.resolve('docs/ragno/ragno-config.json');
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data).ragno;
}
