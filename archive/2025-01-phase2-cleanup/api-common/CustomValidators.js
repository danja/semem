/**
 * Manages custom validation functions for RDF data validation
 */
export default class CustomValidators {
    constructor() {
        this.validators = new Map();
        this.registerBuiltins();
    }

    registerBuiltins() {
        // Basic type validators
        this.register('uri', {
            validate: (value) => {
                try {
                    new URL(value);
                    return { valid: true };
                } catch {
                    return {
                        valid: false,
                        message: 'Invalid URI format'
                    };
                }
            }
        });

        this.register('language', {
            validate: (value) => {
                const langPattern = /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/;
                return {
                    valid: langPattern.test(value),
                    message: langPattern.test(value) ? null : 'Invalid language tag'
                };
            }
        });

        // Semantic validators
        this.register('concept', {
            validate: (value, options = {}) => {
                if (!value.startsWith(options.namespace)) {
                    return {
                        valid: false,
                        message: 'Concept URI must use correct namespace'
                    };
                }
                return { valid: true };
            }
        });

        // Temporal validators
        this.register('timerange', {
            validate: (value, options = {}) => {
                const { start, end } = value;
                const startDate = new Date(start);
                const endDate = new Date(end);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return {
                        valid: false,
                        message: 'Invalid date format'
                    };
                }

                if (startDate > endDate) {
                    return {
                        valid: false,
                        message: 'Start date must be before end date'
                    };
                }

                return { valid: true };
            }
        });
    }

    /**
     * Register a new validator
     * @param {string} name - Validator name
     * @param {Object} validator - Validator definition
     */
    register(name, validator) {
        if (typeof validator.validate !== 'function') {
            throw new Error('Validator must have a validate function');
        }

        this.validators.set(name, {
            ...validator,
            async: validator.validate.constructor.name === 'AsyncFunction'
        });
    }

    /**
     * Register multiple validators
     * @param {Object} validators - Map of validator names to definitions
     */
    registerBatch(validators) {
        for (const [name, validator] of Object.entries(validators)) {
            this.register(name, validator);
        }
    }

    /**
     * Get a registered validator
     * @param {string} name - Validator name
     */
    get(name) {
        const validator = this.validators.get(name);
        if (!validator) {
            throw new Error(`Validator not found: ${name}`);
        }
        return validator;
    }

    /**
     * Execute a validator
     * @param {string} name - Validator name
     * @param {*} value - Value to validate
     * @param {Object} options - Validator options
     */
    async execute(name, value, options = {}) {
        const validator = this.get(name);
        try {
            const result = await validator.validate(value, options);
            return {
                valid: result.valid,
                message: result.message,
                validator: name,
                value
            };
        } catch (error) {
            return {
                valid: false,
                message: error.message,
                validator: name,
                value,
                error
            };
        }
    }

    /**
     * Create a composite validator from multiple validators
     * @param {Array} validators - Array of validator names or definitions
     */
    compose(validators) {
        return {
            validate: async (value, options = {}) => {
                const results = [];
                for (const validator of validators) {
                    const name = typeof validator === 'string' ?
                        validator : validator.name;
                    const validatorOptions = typeof validator === 'string' ?
                        options : { ...options, ...validator.options };

                    const result = await this.execute(name, value, validatorOptions);
                    results.push(result);

                    if (!result.valid) break;
                }

                const valid = results.every(r => r.valid);
                return {
                    valid,
                    results,
                    message: valid ? null : results.find(r => !r.valid)?.message
                };
            }
        };
    }

    /**
     * Create a conditional validator
     * @param {Function} condition - Condition function
     * @param {string|Object} validator - Validator to apply if condition is true
     */
    conditional(condition, validator) {
        return {
            validate: async (value, options = {}) => {
                if (!await condition(value, options)) {
                    return { valid: true };
                }

                const name = typeof validator === 'string' ?
                    validator : validator.name;
                const validatorOptions = typeof validator === 'string' ?
                    options : { ...options, ...validator.options };

                return this.execute(name, value, validatorOptions);
            }
        };
    }

    /**
     * Create a recursive validator for nested structures
     * @param {string|Object} validator - Base validator
     * @param {Object} options - Recursion options
     */
    recursive(validator, options = {}) {
        return {
            validate: async (value, validatorOptions = {}) => {
                const results = [];
                const maxDepth = options.maxDepth || 10;

                const validateNode = async (node, depth = 0) => {
                    if (depth > maxDepth) {
                        throw new Error('Maximum recursion depth exceeded');
                    }

                    // Validate current node
                    const result = await this.execute(
                        typeof validator === 'string' ? validator : validator.name,
                        node,
                        typeof validator === 'string' ?
                            validatorOptions :
                            { ...validatorOptions, ...validator.options }
                    );
                    results.push(result);

                    // Recurse into children if any
                    if (node && typeof node === 'object') {
                        for (const child of Object.values(node)) {
                            if (child && typeof child === 'object') {
                                await validateNode(child, depth + 1);
                            }
                        }
                    }
                };

                await validateNode(value);

                const valid = results.every(r => r.valid);
                return {
                    valid,
                    results,
                    message: valid ? null : results.find(r => !r.valid)?.message
                };
            }
        };
    }
}