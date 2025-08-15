import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

test.describe('Document Upload Workflow', () => {
  let testFilesDir;

  test.beforeAll(() => {
    // Create test files directory
    testFilesDir = join(process.cwd(), 'temp', 'playwright-test-files');
    if (!existsSync(testFilesDir)) {
      mkdirSync(testFilesDir, { recursive: true });
    }

    // Create test files
    writeFileSync(
      join(testFilesDir, 'test-document.txt'),
      'This is a test document for Playwright testing.\n\nIt contains multiple lines and some test content.'
    );

    writeFileSync(
      join(testFilesDir, 'test-markdown.md'),
      '# Test Markdown Document\n\nThis is a **test** markdown document with:\n\n- Lists\n- **Bold text**\n- *Italic text*\n\n## Section 2\n\nSome more content here.'
    );

    // Create a small test PDF (just text content for testing)
    writeFileSync(
      join(testFilesDir, 'test-document.pdf'),
      'This would be a PDF file in a real scenario'
    );
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to workbench
    await page.goto('http://localhost:4102');
    
    // Wait for workbench to initialize
    await expect(page.locator('#connection-status .status-text')).toContainText('Connected', { timeout: 10000 });
  });

  test('should show upload controls when Document type is selected', async ({ page }) => {
    // Initially, upload section should be hidden
    await expect(page.locator('#document-upload-section')).toBeHidden();

    // Select Document type from dropdown
    await page.selectOption('#tell-type', 'document');

    // Upload section should now be visible
    await expect(page.locator('#document-upload-section')).toBeVisible();

    // Check that placeholder text changed
    const textarea = page.locator('#tell-content');
    await expect(textarea).toHaveAttribute('placeholder', /Upload a document file/);

    // Content textarea should no longer be required
    await expect(textarea).not.toHaveAttribute('required');
  });

  test('should hide upload controls when switching back to non-document type', async ({ page }) => {
    // First select document type
    await page.selectOption('#tell-type', 'document');
    await expect(page.locator('#document-upload-section')).toBeVisible();

    // Switch back to concept type
    await page.selectOption('#tell-type', 'concept');

    // Upload section should be hidden again
    await expect(page.locator('#document-upload-section')).toBeHidden();

    // Placeholder should be back to normal
    const textarea = page.locator('#tell-content');
    await expect(textarea).toHaveAttribute('placeholder', /Enter information to store/);

    // Content textarea should be required again
    await expect(textarea).toHaveAttribute('required');
  });

  test('should handle text file upload successfully', async ({ page }) => {
    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Upload a text file
    const fileInput = page.locator('#document-file');
    await fileInput.setInputFiles(join(testFilesDir, 'test-document.txt'));

    // Check that file info is displayed
    await expect(page.locator('#selected-file-info')).toBeVisible();
    await expect(page.locator('#selected-file-name')).toContainText('test-document.txt');
    await expect(page.locator('#selected-file-size')).toContainText('bytes', { ignoreCase: true });

    // Upload area should be hidden when file is selected
    await expect(page.locator('.file-upload-info')).toBeHidden();

    // Add some tags
    await page.fill('#tell-tags', 'test, playwright, document');

    // Submit the form
    await page.click('#tell-submit');

    // Wait for success message in console
    await expect(page.locator('.console-entry')).toContainText('Document upload started', { timeout: 5000 });
    
    // Check for successful completion (may take a moment for document processing)
    await expect(page.locator('.console-entry')).toContainText('completed', { timeout: 15000 });

    // Check for success toast
    await expect(page.locator('.toast.success')).toContainText('stored successfully', { timeout: 10000 });

    // Interaction count should increment
    await expect(page.locator('#interactions-count')).toContainText('1');
  });

  test('should handle markdown file upload successfully', async ({ page }) => {
    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Upload a markdown file
    await page.locator('#document-file').setInputFiles(join(testFilesDir, 'test-markdown.md'));

    // Verify file selection
    await expect(page.locator('#selected-file-name')).toContainText('test-markdown.md');

    // Submit the form
    await page.click('#tell-submit');

    // Wait for processing to complete
    await expect(page.locator('.console-entry')).toContainText('Document upload started', { timeout: 5000 });
    await expect(page.locator('.console-entry')).toContainText('completed', { timeout: 15000 });
  });

  test('should validate file types', async ({ page }) => {
    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Try to upload an unsupported file type (create a .docx file for testing)
    const unsupportedFile = join(testFilesDir, 'unsupported.docx');
    writeFileSync(unsupportedFile, 'This is an unsupported file format');

    await page.locator('#document-file').setInputFiles(unsupportedFile);

    // Should show error message
    await expect(page.locator('.toast.error')).toContainText('Unsupported file type', { timeout: 5000 });

    // File info should not be displayed
    await expect(page.locator('#selected-file-info')).toBeHidden();
  });

  test('should validate file size limits', async ({ page }) => {
    // Create a large file (over 10MB limit)
    const largeFile = join(testFilesDir, 'large-file.txt');
    const largeContent = 'A'.repeat(11 * 1024 * 1024); // 11MB
    writeFileSync(largeFile, largeContent);

    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Try to upload large file
    await page.locator('#document-file').setInputFiles(largeFile);

    // Should show size limit error
    await expect(page.locator('.toast.error')).toContainText('File too large', { timeout: 5000 });

    // File info should not be displayed
    await expect(page.locator('#selected-file-info')).toBeHidden();
  });

  test('should allow removing selected file', async ({ page }) => {
    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Upload a file
    await page.locator('#document-file').setInputFiles(join(testFilesDir, 'test-document.txt'));

    // Verify file is selected
    await expect(page.locator('#selected-file-info')).toBeVisible();

    // Click remove button
    await page.click('#remove-file-button');

    // File info should be hidden
    await expect(page.locator('#selected-file-info')).toBeHidden();

    // Upload area should be visible again
    await expect(page.locator('.file-upload-info')).toBeVisible();
  });

  test('should handle mixed content submission (text + file)', async ({ page }) => {
    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Add some text content
    await page.fill('#tell-content', 'Additional context for this document upload');

    // Upload a file
    await page.locator('#document-file').setInputFiles(join(testFilesDir, 'test-document.txt'));

    // Submit (should prioritize file over text content)
    await page.click('#tell-submit');

    // Should process as document upload
    await expect(page.locator('.console-entry')).toContainText('Document upload started', { timeout: 5000 });
  });

  test('should handle document type with text content only (no file)', async ({ page }) => {
    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Add text content instead of file
    await page.fill('#tell-content', 'This is document content entered as text instead of uploading a file');

    // Add tags
    await page.fill('#tell-tags', 'manual, document, text');

    // Submit
    await page.click('#tell-submit');

    // Should process as regular tell operation
    await expect(page.locator('.console-entry')).toContainText('Starting tell operation', { timeout: 5000 });
    await expect(page.locator('.console-entry')).toContainText('tell completed successfully', { timeout: 10000 });
  });

  test('should show error when neither file nor text content is provided', async ({ page }) => {
    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Don't provide any content or file
    // Submit empty form
    await page.click('#tell-submit');

    // Should show error message
    await expect(page.locator('.toast.error')).toContainText('Please provide content or upload a file', { timeout: 5000 });
  });

  test('should update console with detailed upload progress', async ({ page }) => {
    // Select document type and upload file
    await page.selectOption('#tell-type', 'document');
    await page.locator('#document-file').setInputFiles(join(testFilesDir, 'test-document.txt'));

    // Submit
    await page.click('#tell-submit');

    // Check console for detailed progress messages
    await expect(page.locator('.console-entry')).toContainText('File selected for upload', { timeout: 5000 });
    await expect(page.locator('.console-entry')).toContainText('File validation passed', { timeout: 5000 });
    await expect(page.locator('.console-entry')).toContainText('Document upload started', { timeout: 5000 });
    await expect(page.locator('.console-entry')).toContainText('Processing file for upload', { timeout: 5000 });
    await expect(page.locator('.console-entry')).toContainText('Sending document to MCP service', { timeout: 5000 });
  });

  test('should clear form after successful upload', async ({ page }) => {
    // Select document type and upload file
    await page.selectOption('#tell-type', 'document');
    await page.fill('#tell-tags', 'test-tags');
    await page.locator('#document-file').setInputFiles(join(testFilesDir, 'test-document.txt'));

    // Submit and wait for completion
    await page.click('#tell-submit');
    await expect(page.locator('.toast.success')).toContainText('stored successfully', { timeout: 15000 });

    // Form should be cleared
    await expect(page.locator('#tell-tags')).toHaveValue('');
    await expect(page.locator('#selected-file-info')).toBeHidden();
    await expect(page.locator('.file-upload-info')).toBeVisible();
  });

  test('should maintain responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Select document type
    await page.selectOption('#tell-type', 'document');

    // Upload section should still be functional
    await expect(page.locator('#document-upload-section')).toBeVisible();

    // Upload a file
    await page.locator('#document-file').setInputFiles(join(testFilesDir, 'test-document.txt'));

    // File info should display properly on mobile
    await expect(page.locator('#selected-file-info')).toBeVisible();
    await expect(page.locator('#selected-file-name')).toBeVisible();
  });
});

test.afterAll(() => {
  // Cleanup could be added here if needed
  // Note: Temporary files are typically cleaned up automatically
});