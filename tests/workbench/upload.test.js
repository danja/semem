import { test, expect } from '@playwright/test';

test.describe('Workbench Document Upload Integration', () => {
  test('uploads a document through the Workbench UI', async ({ page }) => {
    const fileName = `workbench-upload-${Date.now()}.md`;
    const fileContents = [
      '# Workbench Upload Verification',
      '',
      'This file is generated during automated tests to verify that the',
      'Workbench UI forwards uploads to the API server using the expected',
      'route (/api/documents/upload).'
    ].join('\n');

    await page.goto('http://localhost:4102');

    // Show the verb panels (hidden by default after UI reorganization)
    await page.waitForSelector('#verbs-toggle', { timeout: 15000 });
    await page.click('#verbs-toggle');

    // Wait for the main content to become visible
    await page.waitForSelector('#main-content[style*="display: flex"]', { timeout: 5000 });

    await page.waitForSelector('#tell-type', { timeout: 15000 });
    await page.selectOption('#tell-type', 'document');
    await page.waitForSelector('#document-file', { timeout: 10000 });

    await page.setInputFiles('#document-file', {
      name: fileName,
      mimeType: 'text/markdown',
      buffer: Buffer.from(fileContents, 'utf-8')
    });

    const uploadResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/documents/upload'),
      { timeout: 20000 }
    );

    await page.click('#tell-submit');

    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);

    const uploadPayload = await uploadResponse.json();
    expect(uploadPayload.success).toBeTruthy();
    expect(uploadPayload.filename).toBeDefined();
    expect(uploadPayload.documentId).toBeDefined();
    expect(uploadPayload.ingestion?.memory?.stored).toBeGreaterThan(0);
    expect(
      Array.isArray(uploadPayload.ingestion?.memory?.interactions) &&
      uploadPayload.ingestion.memory.interactions.length > 0
    ).toBeTruthy();
  });
});
