/**
 * SimpleTemplateLoader.js - Simple template loader for MCP module
 *
 * This module provides functionality to load simple Markdown templates
 * with {{variableName}} interpolation, consistent with SPARQLTemplateLoader pattern.
 *
 * DESIGN DECISION: We maintain this simple loader (vs src/prompts/TemplateLoader.js) for:
 * - Consistency with SPARQL template pattern (simple Markdown + {{var}} interpolation)
 * - MCP module simplicity (avoids complex JSON schema and Handlebars templating)
 * - Clear separation of concerns (advanced templates use TemplateLoader, simple ones use this)
 *
 * For advanced template features (validation, workflows, Handlebars), use src/prompts/TemplateLoader.js instead.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verbsLogger } from '../tools/VerbsLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SimpleTemplateLoader {
    constructor(templatesPath = null) {
        // Default to prompts/templates/ directory in project root
        if (templatesPath) {
            this.templatesPath = path.isAbsolute(templatesPath)
                ? templatesPath
                : path.resolve(process.cwd(), templatesPath);
        } else {
            // Default to prompts/templates relative to project root
            this.templatesPath = path.resolve(__dirname, '../../../prompts/templates');
        }
        this.templateCache = new Map();
        this.lastLoadTime = new Map();
    }

    /**
     * Load a prompt template by name and category
     * @param {string} category - The template category (subdirectory)
     * @param {string} name - The template name (without .md extension)
     * @returns {Promise<string|null>} The template content or null if not found
     */
    async loadTemplate(category, name) {
        const fileName = `${name}.md`;
        const templatePath = path.join(this.templatesPath, category, fileName);
        const cacheKey = templatePath;

        try {
            // Check if template is cached and file hasn't changed
            const stats = await fs.promises.stat(templatePath);
            const lastModified = stats.mtime.getTime();

            if (this.templateCache.has(cacheKey) &&
                this.lastLoadTime.get(cacheKey) >= lastModified) {
                return this.templateCache.get(cacheKey);
            }

            // Load template file
            const content = await fs.promises.readFile(templatePath, 'utf-8');

            // Cache the template
            this.templateCache.set(cacheKey, content);
            this.lastLoadTime.set(cacheKey, Date.now());

            return content;

        } catch (error) {
            if (error.code === 'ENOENT') {
                verbsLogger.warn(`Prompt template not found: ${templatePath}`);
                return null;
            }
            verbsLogger.error(`Failed to load prompt template from ${templatePath}:`, error.message);
            return null;
        }
    }

    /**
     * Load and interpolate a prompt template with variables
     * @param {string} category - The template category
     * @param {string} name - The template name
     * @param {Object} variables - Variables to interpolate into the template
     * @returns {Promise<string|null>} The interpolated prompt or null if template not found
     */
    async loadAndInterpolate(category, name, variables = {}) {
        const template = await this.loadTemplate(category, name);
        if (!template) {
            return null;
        }

        return this.interpolateTemplate(template, variables);
    }

    /**
     * Interpolate variables into a template string
     * @param {string} template - The template string with {{variable}} placeholders
     * @param {Object} variables - Variables to interpolate
     * @returns {string} The interpolated string
     */
    interpolateTemplate(template, variables = {}) {
        let result = template;

        // Replace {{variableName}} with values from variables object
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            // Use global replace to handle multiple occurrences
            result = result.split(placeholder).join(value);
        }

        return result;
    }

    /**
     * Clear the template cache
     */
    clearCache() {
        this.templateCache.clear();
        this.lastLoadTime.clear();
    }

    /**
     * List available templates in a category
     * @param {string} category - The category to list
     * @returns {Promise<string[]>} Array of template names (without .md extension)
     */
    async listTemplates(category) {
        const categoryPath = path.join(this.templatesPath, category);

        try {
            if (!fs.existsSync(categoryPath)) {
                return [];
            }

            const files = await fs.promises.readdir(categoryPath);
            return files
                .filter(file => file.endsWith('.md'))
                .map(file => path.basename(file, '.md'));

        } catch (error) {
            verbsLogger.error(`Failed to list templates in category ${category}:`, error.message);
            return [];
        }
    }

    /**
     * Check if a template exists
     * @param {string} category - The template category
     * @param {string} name - The template name
     * @returns {Promise<boolean>} True if template exists
     */
    async templateExists(category, name) {
        const fileName = `${name}.md`;
        const templatePath = path.join(this.templatesPath, category, fileName);

        try {
            await fs.promises.access(templatePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
}

export default SimpleTemplateLoader;