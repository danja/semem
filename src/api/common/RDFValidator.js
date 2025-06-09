import SPARQLHelpers from '../../utils/SPARQLHelpers.js';

export default class RDFValidator {
    constructor(config = {}) {
        this.shapes = new Map();
        this.constraints = new Map();
        this.loadShapes(config.shapes || {});
    }

    loadShapes(shapes) {
        for (const [name, shape] of Object.entries(shapes)) {
            this.registerShape(name, shape);
        }
    }

    registerShape(name, shape) {
        this.shapes.set(name, {
            ...shape,
            constraints: shape.constraints?.map(c => this.parseConstraint(c)) || []
        });
    }

    parseConstraint(constraint) {
        const parsed = {
            path: constraint.path,
            type: constraint.type,
            message: constraint.message
        };

        switch (constraint.type) {
            case 'datatype':
                parsed.datatype = constraint.datatype;
                break;
            case 'pattern':
                parsed.pattern = new RegExp(constraint.pattern);
                break;
            case 'range':
                parsed.min = constraint.min;
                parsed.max = constraint.max;
                break;
            case 'cardinality':
                parsed.min = constraint.min;
                parsed.max = constraint.max;
                break;
            case 'class':
                parsed.class = constraint.class;
                break;
            case 'in':
                parsed.values = new Set(constraint.values);
                break;
        }

        return parsed;
    }

    generateSHACL(shape) {
        const prefixes = {
            sh: 'http://www.w3.org/ns/shacl#',
            xsd: 'http://www.w3.org/2001/XMLSchema#'
        };

        let shacl = '';
        for (const prefix in prefixes) {
            shacl += `@prefix ${prefix}: <${prefixes[prefix]}> .\n`;
        }

        shacl += `\n${shape.targetClass} a sh:NodeShape ;\n`;

        for (const constraint of shape.constraints) {
            shacl += this.constraintToSHACL(constraint);
        }

        return shacl;
    }

    constraintToSHACL(constraint) {
        let shacl = `  sh:property [\n`;
        shacl += `    sh:path ${constraint.path} ;\n`;

        switch (constraint.type) {
            case 'datatype':
                shacl += `    sh:datatype ${constraint.datatype} ;\n`;
                break;
            case 'pattern':
                shacl += `    sh:pattern "${constraint.pattern.source}" ;\n`;
                break;
            case 'range':
                if (constraint.min !== undefined) {
                    shacl += `    sh:minInclusive ${constraint.min} ;\n`;
                }
                if (constraint.max !== undefined) {
                    shacl += `    sh:maxInclusive ${constraint.max} ;\n`;
                }
                break;
            case 'cardinality':
                if (constraint.min !== undefined) {
                    shacl += `    sh:minCount ${constraint.min} ;\n`;
                }
                if (constraint.max !== undefined) {
                    shacl += `    sh:maxCount ${constraint.max} ;\n`;
                }
                break;
            case 'class':
                shacl += `    sh:class ${constraint.class} ;\n`;
                break;
            case 'in':
                shacl += `    sh:in (${Array.from(constraint.values).join(' ')}) ;\n`;
                break;
        }

        if (constraint.message) {
            shacl += `    sh:message "${constraint.message}" ;\n`;
        }

        shacl += `  ] ;\n`;
        return shacl;
    }

    async validate(data, shapeName) {
        const shape = this.shapes.get(shapeName);
        if (!shape) {
            throw new Error(`Shape not found: ${shapeName}`);
        }

        const validationResults = {
            valid: true,
            errors: []
        };

        for (const constraint of shape.constraints) {
            try {
                const result = await this.validateConstraint(data, constraint);
                if (!result.valid) {
                    validationResults.valid = false;
                    validationResults.errors.push(result);
                }
            } catch (error) {
                validationResults.valid = false;
                validationResults.errors.push({
                    path: constraint.path,
                    message: error.message
                });
            }
        }

        return validationResults;
    }

    async validateConstraint(data, constraint) {
        const value = this.getValue(data, constraint.path);

        switch (constraint.type) {
            case 'datatype':
                return this.validateDatatype(value, constraint);
            case 'pattern':
                return this.validatePattern(value, constraint);
            case 'range':
                return this.validateRange(value, constraint);
            case 'cardinality':
                return this.validateCardinality(value, constraint);
            case 'class':
                return this.validateClass(value, constraint);
            case 'in':
                return this.validateIn(value, constraint);
            default:
                throw new Error(`Unknown constraint type: ${constraint.type}`);
        }
    }

    getValue(data, path) {
        const parts = path.split('.');
        let value = data;
        for (const part of parts) {
            value = value?.[part];
            if (value === undefined) break;
        }
        return value;
    }

    validateDatatype(value, constraint) {
        if (value === undefined) return { valid: true };

        const valid = this.checkDatatype(value, constraint.datatype);
        return {
            valid,
            path: constraint.path,
            message: valid ? null : 
                constraint.message || `Invalid datatype: expected ${constraint.datatype}`
        };
    }

    validatePattern(value, constraint) {
        if (value === undefined) return { valid: true };

        const valid = constraint.pattern.test(String(value));
        return {
            valid,
            path: constraint.path,
            message: valid ? null :
                constraint.message || `Value does not match pattern: ${constraint.pattern}`
        };
    }

    validateRange(value, constraint) {
        if (value === undefined) return { valid: true };

        const num = Number(value);
        const valid = !isNaN(num) &&
            (constraint.min === undefined || num >= constraint.min) &&
            (constraint.max === undefined || num <= constraint.max);

        return {
            valid,
            path: constraint.path,
            message: valid ? null :
                constraint.message || `Value out of range: ${constraint.min} - ${constraint.max}`
        };
    }

    validateCardinality(value, constraint) {
        const count = Array.isArray(value) ? value.length : (value === undefined ? 0 : 1);
        const valid = (constraint.min === undefined || count >= constraint.min) &&
                     (constraint.max === undefined || count <= constraint.max);

        return {
            valid,
            path: constraint.path,
            message: valid ? null :
                constraint.message || `Cardinality violation: expected ${constraint.min}-${constraint.max}`
        };
    }

    validateClass(value, constraint) {
        if (value === undefined) return { valid: true };
        
        const valid = value.type === constraint.class;
        return {
            valid,
            path: constraint.path,
            message: valid ? null :
                constraint.message || `Invalid class: expected ${constraint.class}`
        };
    }

    validateIn(value, constraint) {
        if (value === undefined) return { valid: true };

        const valid = constraint.values.has(value);
        return {
            valid,
            path: constraint.path,
            message: valid ? null :
                constraint.message || `Value not in allowed set: ${Array.from(constraint.values).join(', ')}`
        };
    }

    checkDatatype(value, type) {
        switch (type) {
            case 'xsd:string':
                return typeof value === 'string';
            case 'xsd:integer':
                return Number.isInteger(Number(value));
            case 'xsd:decimal':
            case 'xsd:float':
            case 'xsd:double':
                return !isNaN(Number(value));
            case 'xsd:boolean':
                return typeof value === 'boolean';
            case 'xsd:date':
            case 'xsd:dateTime':
                return !isNaN(Date.parse(value));
            default:
                return true;
        }
    }
}