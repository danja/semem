import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TIMEOUT = 30000; // 30 seconds
const INTEGRATION_TEST_DIR = path.join(__dirname, '../tests/integration');

async function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Add global timeout constant if not exists
    if (!content.includes('const TEST_TIMEOUT =') && !content.includes('const TEST_TIMEOUT=')) {
      const firstImport = content.match(/^import.*$/m);
      if (firstImport) {
        content = content.replace(
          firstImport[0],
          `${firstImport[0]}\n\nconst TEST_TIMEOUT = ${TEST_TIMEOUT};`
        );
      } else {
        content = `const TEST_TIMEOUT = ${TEST_TIMEOUT};\n\n${content}`;
      }
      modified = true;
    }

    // Add timeout to describe blocks
    content = content.replace(
      /(describe\s*\(\s*['"`]([^'"`]*)['"`]\s*,\s*)(\(\s*)?(?:async\s*)?(\{)/g,
      (match, p1, p2, p3, p4) => {
        if (match.includes('timeout:')) return match;
        return `${p1}${p3 || '() => '}${p3 ? '' : ' '}${p4}\n    // ${p2}`;
      }
    );

    // Add timeout to it/test blocks
    content = content.replace(
      /(it|test)\s*\(\s*['"`]([^'"`]*)['"`]\s*,\s*(?:(?:async\s*)?\([^)]*\)\s*=>\s*{|\{)/g,
      (match, p1, p2) => {
        if (match.includes('timeout:')) return match;
        return `${p1}('${p2}', { timeout: TEST_TIMEOUT }, async () => {`;
      }
    );

    // Handle describe blocks with options object
    content = content.replace(
      /(describe\s*\(\s*['"`]([^'"`]*)['"`]\s*,\s*)(\{\s*timeout\s*:)/g,
      (match, p1, p2, p3) => {
        return `${p1}{ ...${p3}`;
      }
    );

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    } else {
      console.log(`No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

async function processDirectory(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    
    if (file.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.name.endsWith('.test.js') || file.name.endsWith('.spec.js')) {
      processFile(fullPath);
    }
  }
}

// Run the script
(async () => {
  await processDirectory(INTEGRATION_TEST_DIR);
  console.log('Test timeouts update complete!');
})();
