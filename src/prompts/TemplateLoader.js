/**
 * TemplateLoader.js - Loads prompt templates from external files
 * 
 * This module provides functionality to load prompt templates from the
 * prompts/templates/ directory structure, making templates easy to modify
 * and reuse without changing code.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PromptTemplate } from './interfaces.js';
import { createUnifiedLogger } from '../utils/LoggingConfig.js';

const logger = createUnifiedLogger('TemplateLoader');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateLoader {
    constructor(templatesPath = null) {
        // Default to prompts/templates/ directory in project root
        if (templatesPath) {
            // If templatesPath is relative, resolve it from the project root
            this.templatesPath = path.isAbsolute(templatesPath) 
                ? templatesPath 
                : path.resolve(process.cwd(), templatesPath);
        } else {
            // Default fallback
            this.templatesPath = path.resolve(__dirname, '../../prompts/templates');
        }
        this.templateCache = new Map();
        this.lastLoadTime = new Map();
        this.watchFiles = new Set();
    }

    /**
     * Load all templates from the templates directory
     */
    async loadAllTemplates() {
        const templates = new Map();
        
        try {
            if (!fs.existsSync(this.templatesPath)) {
                logger.warn(`Templates directory does not exist: ${this.templatesPath}`);
                return templates;
            }

            const categories = await this.findTemplateCategories();
            
            for (const category of categories) {
                const categoryTemplates = await this.loadCategoryTemplates(category);
                categoryTemplates.forEach((template, name) => {
                    templates.set(name, template);
                });
            }

            logger.info(`Loaded ${templates.size} prompt templates from ${this.templatesPath}`);
            
        } catch (error) {
            logger.error('Failed to load templates:', error.message);
        }

        return templates;
    }

    /**
     * Find all template categories (subdirectories)
     */
    async findTemplateCategories() {
        const categories = [];
        
        try {
            const entries = await fs.promises.readdir(this.templatesPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    categories.push(entry.name);
                }
            }
            
        } catch (error) {
            logger.warn('Failed to read templates directory:', error.message);
        }

        return categories;
    }

    /**
     * Load all templates from a specific category
     */
    async loadCategoryTemplates(category) {
        const templates = new Map();
        const categoryPath = path.join(this.templatesPath, category);
        
        try {
            if (!fs.existsSync(categoryPath)) {
                return templates;
            }

            const files = await fs.promises.readdir(categoryPath);
            const templateFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of templateFiles) {
                const templatePath = path.join(categoryPath, file);
                const template = await this.loadTemplate(templatePath);
                
                if (template) {
                    templates.set(template.name, template);
                }
            }
            
        } catch (error) {
            logger.error(`Failed to load templates from category ${category}:`, error.message);
        }

        return templates;
    }

    /**
     * Load a single template from a file
     */
    async loadTemplate(templatePath) {
        try {
            // Check if template is cached and file hasn't changed
            const stats = await fs.promises.stat(templatePath);
            const lastModified = stats.mtime.getTime();
            const cacheKey = templatePath;
            
            if (this.templateCache.has(cacheKey) && 
                this.lastLoadTime.get(cacheKey) >= lastModified) {
                return this.templateCache.get(cacheKey);
            }

            // Load and parse template file
            const content = await fs.promises.readFile(templatePath, 'utf-8');
            const templateData = JSON.parse(content);
            
            // Validate required fields
            this.validateTemplateData(templateData, templatePath);
            
            // Create PromptTemplate instance
            const template = new PromptTemplate(templateData);
            
            // Cache the template
            this.templateCache.set(cacheKey, template);
            this.lastLoadTime.set(cacheKey, Date.now());
            
            logger.debug(`Loaded template: ${template.name} from ${templatePath}`);
            return template;
            
        } catch (error) {
            logger.error(`Failed to load template from ${templatePath}:`, error.message);
            return null;
        }
    }

    /**
     * Validate template data structure
     */
    validateTemplateData(templateData, templatePath) {
        const requiredFields = ['name', 'description', 'content', 'format', 'category'];
        
        for (const field of requiredFields) {
            if (!templateData[field]) {
                throw new Error(`Template ${templatePath} missing required field: ${field}`);
            }
        }

        // Validate format
        const validFormats = ['chat', 'completion', 'structured', 'json', 'markdown'];
        if (!validFormats.includes(templateData.format)) {
            throw new Error(`Template ${templatePath} has invalid format: ${templateData.format}`);
        }

        // Validate arguments if present
        if (templateData.arguments && !Array.isArray(templateData.arguments)) {
            throw new Error(`Template ${templatePath} arguments must be an array`);
        }
    }

    /**
     * Load a specific template by name and category
     */
    async loadTemplateByName(category, name) {
        const fileName = `${name}.json`;
        const templatePath = path.join(this.templatesPath, category, fileName);
        
        if (!fs.existsSync(templatePath)) {
            logger.warn(`Template file not found: ${templatePath}`);
            return null;
        }

        return await this.loadTemplate(templatePath);
    }

    /**
     * Reload templates (useful for development)
     */
    async reloadTemplates() {
        this.templateCache.clear();
        this.lastLoadTime.clear();
        return await this.loadAllTemplates();
    }

    /**
     * Get template file path for a given name and category
     */
    getTemplatePath(category, name) {
        const fileName = `${name}.json`;
        return path.join(this.templatesPath, category, fileName);
    }

    /**
     * List all available template files
     */
    async listTemplateFiles() {
        const templateFiles = [];
        
        try {
            const categories = await this.findTemplateCategories();
            
            for (const category of categories) {
                const categoryPath = path.join(this.templatesPath, category);
                const files = await fs.promises.readdir(categoryPath);
                const jsonFiles = files.filter(file => file.endsWith('.json'));
                
                for (const file of jsonFiles) {
                    templateFiles.push({
                        category,
                        name: path.basename(file, '.json'),
                        path: path.join(categoryPath, file)
                    });
                }
            }
            
        } catch (error) {
            logger.error('Failed to list template files:', error.message);
        }

        return templateFiles;
    }

    /**
     * Watch template files for changes (useful for development)
     */
    watchTemplates(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        // Note: This is a simplified implementation
        // In production, you might want to use a proper file watcher library
        setInterval(async () => {
            try {
                const templates = await this.reloadTemplates();
                callback(templates);
            } catch (error) {
                logger.error('Error during template reload:', error.message);
            }
        }, 5000); // Check every 5 seconds
    }
}

export default TemplateLoader;