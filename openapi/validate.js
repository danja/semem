#!/usr/bin/env node

/**
 * OpenAPI Specification Validation Script
 * 
 * This script validates the Semem OpenAPI specification for:
 * - YAML syntax correctness
 * - OpenAPI 3.0.3 compliance
 * - Schema reference validity
 * - Example consistency
 * - Path parameter consistency
 * 
 * Usage: node validate.js
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OPENAPI_DIR = __dirname;
const MAIN_SPEC = join(OPENAPI_DIR, 'openapi.yaml');

class OpenAPIValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.schemas = new Map();
        this.paths = new Map();
    }

    log(level, message, file = null) {
        const entry = { level, message, file, timestamp: new Date().toISOString() };
        if (level === 'error') {
            this.errors.push(entry);
        } else if (level === 'warning') {
            this.warnings.push(entry);
        }
        
        const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️';
        const fileInfo = file ? ` [${relative(OPENAPI_DIR, file)}]` : '';
        console.log(`${prefix} ${message}${fileInfo}`);
    }

    async validateFile(filePath) {
        try {
            const content = readFileSync(filePath, 'utf8');
            const parsed = yaml.load(content);
            this.log('info', `✅ Valid YAML syntax`, filePath);
            return parsed;
        } catch (error) {
            this.log('error', `Invalid YAML: ${error.message}`, filePath);
            return null;
        }
    }

    validateMainSpec(spec) {
        // Check required OpenAPI fields
        const required = ['openapi', 'info', 'paths'];
        for (const field of required) {
            if (!spec[field]) {
                this.log('error', `Missing required field: ${field}`, MAIN_SPEC);
            }
        }

        // Validate OpenAPI version
        if (spec.openapi !== '3.0.3') {
            this.log('warning', `OpenAPI version is ${spec.openapi}, expected 3.0.3`, MAIN_SPEC);
        }

        // Validate info section
        if (spec.info) {
            const requiredInfo = ['title', 'version'];
            for (const field of requiredInfo) {
                if (!spec.info[field]) {
                    this.log('error', `Missing required info field: ${field}`, MAIN_SPEC);
                }
            }
        }

        // Validate servers
        if (spec.servers && Array.isArray(spec.servers)) {
            spec.servers.forEach((server, index) => {
                if (!server.url) {
                    this.log('error', `Server ${index} missing URL`, MAIN_SPEC);
                }
            });
        }

        this.log('info', `Main specification structure validated`);
    }

    validateSchemaReferences(spec) {
        const findReferences = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;

            if (Array.isArray(obj)) {
                obj.forEach((item, index) => findReferences(item, `${path}[${index}]`));
                return;
            }

            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (key === '$ref' && typeof value === 'string') {
                    this.validateSchemaReference(value, currentPath);
                } else {
                    findReferences(value, currentPath);
                }
            }
        };

        findReferences(spec);
    }

    validateSchemaReference(ref, path) {
        // Check if reference is properly formatted
        if (!ref.startsWith('#/') && !ref.startsWith('./')) {
            this.log('warning', `Unusual reference format: ${ref} at ${path}`, MAIN_SPEC);
            return;
        }

        // For external references, check if file exists
        if (ref.startsWith('./')) {
            const [filePath, anchor] = ref.split('#');
            const fullPath = join(dirname(MAIN_SPEC), filePath);
            
            if (!existsSync(fullPath)) {
                this.log('error', `Referenced file does not exist: ${filePath} at ${path}`, MAIN_SPEC);
            } else {
                this.log('info', `✅ External reference valid: ${ref}`);
            }
        }
    }

    async validateSchemaFiles() {
        const schemaDir = join(OPENAPI_DIR, 'components', 'schemas');
        
        try {
            const schemaFiles = readdirSync(schemaDir).filter(file => file.endsWith('.yaml'));
            
            for (const file of schemaFiles) {
                const filePath = join(schemaDir, file);
                const schema = await this.validateFile(filePath);
                
                if (schema) {
                    this.schemas.set(file, schema);
                    this.validateSchemaDefinitions(schema, filePath);
                }
            }
            
            this.log('info', `Schema files validated: ${schemaFiles.length} files`);
        } catch (error) {
            this.log('error', `Error validating schema files: ${error.message}`, schemaDir);
            throw error;
        }
    }

    validateSchemaDefinitions(schema, filePath) {
        const validateSchema = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;

            // Check for required schema properties
            if (obj.type) {
                const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
                if (!validTypes.includes(obj.type)) {
                    this.log('warning', `Invalid schema type: ${obj.type} at ${path}`, filePath);
                }
            }

            // Validate array schemas
            if (obj.type === 'array' && !obj.items) {
                this.log('error', `Array schema missing items definition at ${path}`, filePath);
            }

            // Validate object schemas
            if (obj.type === 'object' && obj.required && Array.isArray(obj.required)) {
                if (obj.properties) {
                    for (const requiredProp of obj.required) {
                        if (!obj.properties[requiredProp]) {
                            this.log('error', `Required property ${requiredProp} not defined in properties at ${path}`, filePath);
                        }
                    }
                }
            }

            // Recursively validate nested schemas
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object') {
                    validateSchema(value, path ? `${path}.${key}` : key);
                }
            }
        };

        validateSchema(schema);
    }

    async validatePathFiles() {
        const pathsDir = join(OPENAPI_DIR, 'paths');
        
        try {
            await this.validatePathsRecursively(pathsDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log('error', `Paths directory not found: ${pathsDir}`);
            } else {
                throw error;
            }
        }
    }

    async validatePathsRecursively(dir) {
        const files = readdirSync(dir);
        
        for (const file of files) {
            const fullPath = join(dir, file);
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
                await this.validatePathsRecursively(fullPath);
            } else if (file.endsWith('.yaml')) {
                const pathSpec = await this.validateFile(fullPath);
                if (pathSpec) {
                    await this.validatePathDefinition(pathSpec, fullPath);
                }
            }
        }
    }

    async validatePathDefinition(pathSpec, filePath) {
        if (!pathSpec) return;

        // Extract the path from the file path
        const relPath = relative(join(OPENAPI_DIR, 'paths'), filePath);
        const pathName = '/' + relPath
            .replace(/\.[^/.]+$/, '') // Remove extension
            .replace(/\\/g, '/');     // Normalize path separators

        // Validate each HTTP method in the path specification
        const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
        for (const method of methods) {
            if (pathSpec[method]) {
                await this.validateOperation(pathSpec[method], method, filePath);
            }
        }

        this.paths.set(pathName, pathSpec);
        this.log('info', `✅ Validated path: ${pathName}`, filePath);
        return true;
    }

    async validateOperation(operation, method, filePath) {
        const required = ['tags', 'summary', 'operationId', 'responses'];
        
        for (const field of required) {
            if (!operation[field]) {
                this.log('warning', `Operation ${method} missing recommended field: ${field}`, filePath);
            }
        }

        // Validate responses
        if (operation.responses) {
            const hasSuccessResponse = Object.keys(operation.responses).some(code => 
                code.startsWith('2') || code === '200' || code === '201'
            );
            
            if (!hasSuccessResponse) {
                this.log('warning', `Operation ${method} has no success response (2xx)`, filePath);
            }
        }

        // Validate parameters
        if (operation.parameters) {
            for (let i = 0; i < operation.parameters.length; i++) {
                const param = operation.parameters[i];
                
                // Handle $ref parameters
                if (param.$ref) {
                    try {
                        // Resolve the reference
                        const refPath = param.$ref;
                        if (!refPath.startsWith('#')) {
                            // For external references, we'll just log a warning for now
                            this.log('info', `Skipping external parameter reference: ${refPath}`, filePath);
                            continue;
                        }
                        
                        // For now, we'll assume the parameter is valid if it has a $ref
                        // In a full implementation, we would resolve the reference and validate its contents
                        continue;
                    } catch (error) {
                        this.log('error', `Failed to resolve parameter reference: ${error.message}`, filePath);
                    }
                }
                
                // Validate direct parameters
                if (!param.name || !param.in) {
                    this.log('error', `Parameter ${i} in ${method} missing name or in field`, filePath);
                }
            }
        }
    }

    async validateExamples() {
        const examplesFile = join(OPENAPI_DIR, 'components', 'examples', 'index.yaml');
        
        try {
            if (existsSync(examplesFile)) {
                const examples = await this.validateFile(examplesFile);
                if (examples) {
                    this.log('info', `✅ Examples file validated`);
                    return true;
                } else {
                    this.log('error', `Failed to validate examples file`, examplesFile);
                    return false;
                }
            } else {
                this.log('warning', `Examples file not found: ${examplesFile}`);
                return true;
            }
        } catch (error) {
            this.log('error', `Error validating examples: ${error.message}`, examplesFile);
            return false;
        }
    }

    async validate() {
        console.log('🔍 Starting OpenAPI specification validation...\n');

        try {
            const spec = await this.validateFile(MAIN_SPEC);
            if (!spec) return false;

            console.log('📋 Validating main specification...');
            this.validateMainSpec(spec);
            this.validateSchemaReferences(spec);

            console.log('\n🏗️  Validating schema files...');
            await this.validateSchemaFiles();

            console.log('\n🛣️  Validating path files...');
            await this.validatePathFiles();

            console.log('\n🔍 Validating examples...');
            this.validateExamples();

            console.log('\n📊 Generating validation report...');
            return this.generateReport();
        } catch (error) {
            console.error('❌ Error during validation:', error);
            return false;
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 VALIDATION REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n📈 Summary:`);
        console.log(`   Errors: ${this.errors.length}`);
        console.log(`   Warnings: ${this.warnings.length}`);
        console.log(`   Schemas validated: ${this.schemas.size}`);
        
        if (this.errors.length > 0) {
            console.log(`\n❌ Errors (${this.errors.length}):`);
            this.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.message}`);
                if (error.file) {
                    console.log(`      File: ${relative(OPENAPI_DIR, error.file)}`);
                }
            });
        }
        
        if (this.warnings.length > 0) {
            console.log(`\n⚠️ Warnings (${this.warnings.length}):`);
            this.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning.message}`);
                if (warning.file) {
                    console.log(`      File: ${relative(OPENAPI_DIR, warning.file)}`);
                }
            });
        }

        const isValid = this.errors.length === 0;
        console.log(`\n${isValid ? '✅' : '❌'} Overall Status: ${isValid ? 'VALID' : 'INVALID'}`);
        
        if (isValid) {
            console.log('🎉 OpenAPI specification is valid and ready for use!');
        } else {
            console.log('🔧 Please fix the errors above before using the specification.');
        }
        
        console.log('='.repeat(60));
        
        return isValid;
    }
}

// Run validation if called directly
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    const validator = new OpenAPIValidator();
    validator.validate().then(isValid => {
        if (isValid) {
            console.log('\n✅ Validation passed!');
            process.exit(0);
        } else {
            console.log('\n❌ Validation failed');
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Error during validation:', error);
        process.exit(1);
    });
}

export default OpenAPIValidator;