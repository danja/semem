/**
 * Tests for external template loading functionality
 */

import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import TemplateLoader from '../../../../src/prompts/TemplateLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TemplateLoader', () => {
    let templateLoader;
    const testTemplatesPath = path.resolve(__dirname, '../../../prompts/templates');

    beforeAll(() => {
        templateLoader = new TemplateLoader(testTemplatesPath);
    });

    describe('Template Loading', () => {
        test('should load all external templates', async () => {
            const templates = await templateLoader.loadAllTemplates();
            
            expect(templates).toBeInstanceOf(Map);
            
            // Should have loaded our concept extraction templates
            const templateNames = Array.from(templates.keys());
            expect(templateNames).toContain('concept-extraction-enhanced');
            expect(templateNames).toContain('concept-extraction-mistral');
            expect(templateNames).toContain('concept-extraction-llama');
        });

        test('should load specific template by category and name', async () => {
            const template = await templateLoader.loadTemplateByName('concept-extraction', 'enhanced');
            
            expect(template).toBeDefined();
            expect(template.name).toBe('concept-extraction-enhanced');
            expect(template.category).toBe('concept-extraction');
        });

        test('should return null for non-existent template', async () => {
            const template = await templateLoader.loadTemplateByName('concept-extraction', 'nonexistent');
            
            expect(template).toBeNull();
        });

        test('should list all template files', async () => {
            const templateFiles = await templateLoader.listTemplateFiles();
            
            expect(Array.isArray(templateFiles)).toBe(true);
            expect(templateFiles.length).toBeGreaterThan(0);
            
            // Should find our concept extraction templates
            const conceptExtractionFiles = templateFiles.filter(f => f.category === 'concept-extraction');
            expect(conceptExtractionFiles.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('Template Categories', () => {
        test('should find template categories', async () => {
            const categories = await templateLoader.findTemplateCategories();
            
            expect(Array.isArray(categories)).toBe(true);
            expect(categories).toContain('concept-extraction');
        });

        test('should load category templates', async () => {
            const templates = await templateLoader.loadCategoryTemplates('concept-extraction');
            
            expect(templates).toBeInstanceOf(Map);
            expect(templates.size).toBeGreaterThanOrEqual(3);
            
            // Check specific templates
            expect(templates.has('concept-extraction-enhanced')).toBe(true);
            expect(templates.has('concept-extraction-mistral')).toBe(true);
            expect(templates.has('concept-extraction-llama')).toBe(true);
        });
    });

    describe('Template Validation', () => {
        test('should validate template data structure', () => {
            const validTemplate = {
                name: 'test-template',
                description: 'Test template',
                content: 'Test content: ${text}',
                format: 'completion',
                category: 'test'
            };

            expect(() => {
                templateLoader.validateTemplateData(validTemplate, 'test-path');
            }).not.toThrow();
        });

        test('should reject invalid template data', () => {
            const invalidTemplate = {
                name: 'test-template',
                // Missing required fields
            };

            expect(() => {
                templateLoader.validateTemplateData(invalidTemplate, 'test-path');
            }).toThrow();
        });

        test('should reject invalid format', () => {
            const invalidFormatTemplate = {
                name: 'test-template',
                description: 'Test template',
                content: 'Test content',
                format: 'invalid-format',
                category: 'test'
            };

            expect(() => {
                templateLoader.validateTemplateData(invalidFormatTemplate, 'test-path');
            }).toThrow('invalid format');
        });
    });

    describe('Caching', () => {
        test('should cache loaded templates', async () => {
            // Load template twice
            const template1 = await templateLoader.loadTemplateByName('concept-extraction', 'enhanced');
            const template2 = await templateLoader.loadTemplateByName('concept-extraction', 'enhanced');
            
            expect(template1).toBeDefined();
            expect(template2).toBeDefined();
            expect(template1.name).toBe(template2.name);
        });

        test('should reload templates when requested', async () => {
            const originalTemplates = await templateLoader.loadAllTemplates();
            const reloadedTemplates = await templateLoader.reloadTemplates();
            
            expect(originalTemplates.size).toBe(reloadedTemplates.size);
        });
    });
});