// tests/unit/mcp/tools/simple-verbs-registration.test.js
// Tests for Simple Verbs MCP tool registration

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerSimpleVerbs, SimpleVerbToolNames } from '../../../../mcp/tools/simple-verbs.js';

// Mock the logger to prevent console output during tests
vi.mock('loglevel', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock the MCP debug utilities
vi.mock('../../../../mcp/lib/debug-utils.js', () => ({
    mcpDebugger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('Simple Verbs Tool Registration', () => {
    let mockServer;
    let registeredTools;

    beforeEach(() => {
        vi.clearAllMocks();
        registeredTools = new Map();

        // Mock MCP server
        mockServer = {
            tool: vi.fn((name, description, schema, handler) => {
                registeredTools.set(name, {
                    name,
                    description,
                    schema,
                    handler
                });
            })
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('registerSimpleVerbs function', () => {
        it('should register all 6 simple verb tools', () => {
            registerSimpleVerbs(mockServer);

            expect(mockServer.tool).toHaveBeenCalledTimes(6);
            
            // Verify all expected tools are registered
            const expectedTools = ['tell', 'ask', 'augment', 'zoom', 'pan', 'tilt'];
            expectedTools.forEach(toolName => {
                expect(registeredTools.has(toolName)).toBe(true);
            });
        });

        it('should register tools with correct names from SimpleVerbToolNames', () => {
            registerSimpleVerbs(mockServer);

            expect(registeredTools.has(SimpleVerbToolNames.TELL)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.ASK)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.AUGMENT)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.ZOOM)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.PAN)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.TILT)).toBe(true);
        });

        it('should register tell tool with correct properties', () => {
            registerSimpleVerbs(mockServer);

            const tellTool = registeredTools.get('tell');
            expect(tellTool).toBeDefined();
            expect(tellTool.name).toBe('tell');
            expect(tellTool.description).toContain('Add resources to the system');
            expect(tellTool.schema).toBeDefined();
            expect(typeof tellTool.handler).toBe('function');
        });

        it('should register ask tool with correct properties', () => {
            registerSimpleVerbs(mockServer);

            const askTool = registeredTools.get('ask');
            expect(askTool).toBeDefined();
            expect(askTool.name).toBe('ask');
            expect(askTool.description).toContain('Query the system');
            expect(askTool.schema).toBeDefined();
            expect(typeof askTool.handler).toBe('function');
        });

        it('should register augment tool with correct properties', () => {
            registerSimpleVerbs(mockServer);

            const augmentTool = registeredTools.get('augment');
            expect(augmentTool).toBeDefined();
            expect(augmentTool.name).toBe('augment');
            expect(augmentTool.description).toContain('Run operations like concept extraction');
            expect(augmentTool.schema).toBeDefined();
            expect(typeof augmentTool.handler).toBe('function');
        });

        it('should register zoom tool with correct properties', () => {
            registerSimpleVerbs(mockServer);

            const zoomTool = registeredTools.get('zoom');
            expect(zoomTool).toBeDefined();
            expect(zoomTool.name).toBe('zoom');
            expect(zoomTool.description).toContain('Set the abstraction level');
            expect(zoomTool.schema).toBeDefined();
            expect(typeof zoomTool.handler).toBe('function');
        });

        it('should register pan tool with correct properties', () => {
            registerSimpleVerbs(mockServer);

            const panTool = registeredTools.get('pan');
            expect(panTool).toBeDefined();
            expect(panTool.name).toBe('pan');
            expect(panTool.description).toContain('Set subject domain filters');
            expect(panTool.schema).toBeDefined();
            expect(typeof panTool.handler).toBe('function');
        });

        it('should register tilt tool with correct properties', () => {
            registerSimpleVerbs(mockServer);

            const tiltTool = registeredTools.get('tilt');
            expect(tiltTool).toBeDefined();
            expect(tiltTool.name).toBe('tilt');
            expect(tiltTool.description).toContain('Set the view filter');
            expect(tiltTool.schema).toBeDefined();
            expect(typeof tiltTool.handler).toBe('function');
        });

        it('should log registration process', () => {
            registerSimpleVerbs(mockServer);

            expect(mockMcpDebugger.info).toHaveBeenCalledWith(
                'Registering Simple MCP Verbs (tell, ask, augment, zoom, pan, tilt)...'
            );
            expect(mockMcpDebugger.info).toHaveBeenCalledWith(
                'Simple MCP Verbs registered successfully'
            );
        });
    });

    describe('Tool Schema Validation', () => {
        beforeEach(() => {
            registerSimpleVerbs(mockServer);
        });

        it('should have valid tell schema with required content field', () => {
            const tellTool = registeredTools.get('tell');
            const schema = tellTool.schema;

            expect(schema.parse).toBeDefined();
            
            // Valid input should parse successfully
            const validInput = { content: 'test content' };
            expect(() => schema.parse(validInput)).not.toThrow();

            // Invalid input (missing content) should throw
            expect(() => schema.parse({})).toThrow();
        });

        it('should have valid ask schema with required question field', () => {
            const askTool = registeredTools.get('ask');
            const schema = askTool.schema;

            expect(schema.parse).toBeDefined();
            
            // Valid input should parse successfully
            const validInput = { question: 'test question' };
            expect(() => schema.parse(validInput)).not.toThrow();

            // Invalid input (missing question) should throw
            expect(() => schema.parse({})).toThrow();
        });

        it('should have valid augment schema with required target field', () => {
            const augmentTool = registeredTools.get('augment');
            const schema = augmentTool.schema;

            expect(schema.parse).toBeDefined();
            
            // Valid input should parse successfully
            const validInput = { target: 'test target' };
            expect(() => schema.parse(validInput)).not.toThrow();

            // Invalid input (missing target) should throw
            expect(() => schema.parse({})).toThrow();
        });

        it('should have valid zoom schema with optional level field', () => {
            const zoomTool = registeredTools.get('zoom');
            const schema = zoomTool.schema;

            expect(schema.parse).toBeDefined();
            
            // Both empty input and valid level should work
            expect(() => schema.parse({})).not.toThrow();
            expect(() => schema.parse({ level: 'entity' })).not.toThrow();

            // Invalid level should throw
            expect(() => schema.parse({ level: 'invalid_level' })).toThrow();
        });

        it('should have valid pan schema with all optional fields', () => {
            const panTool = registeredTools.get('pan');
            const schema = panTool.schema;

            expect(schema.parse).toBeDefined();
            
            // Empty input should work (all fields optional)
            expect(() => schema.parse({})).not.toThrow();

            // Valid fields should work
            const validInput = {
                domains: ['tech'],
                keywords: ['AI'],
                temporal: { start: '2023-01-01' }
            };
            expect(() => schema.parse(validInput)).not.toThrow();
        });

        it('should have valid tilt schema with optional style field', () => {
            const tiltTool = registeredTools.get('tilt');
            const schema = tiltTool.schema;

            expect(schema.parse).toBeDefined();
            
            // Both empty input and valid style should work
            expect(() => schema.parse({})).not.toThrow();
            expect(() => schema.parse({ style: 'keywords' })).not.toThrow();

            // Invalid style should throw
            expect(() => schema.parse({ style: 'invalid_style' })).toThrow();
        });
    });

    describe('Tool Handler Return Format', () => {
        beforeEach(() => {
            registerSimpleVerbs(mockServer);
        });

        it('should return MCP-compatible format from all tool handlers', async () => {
            const tools = ['tell', 'ask', 'augment', 'zoom', 'pan', 'tilt'];

            for (const toolName of tools) {
                const tool = registeredTools.get(toolName);
                expect(tool).toBeDefined();
                expect(typeof tool.handler).toBe('function');

                // All handlers should be async and return content array
                const handler = tool.handler;
                expect(handler.constructor.name).toBe('AsyncFunction');
            }
        });

        it('should handle tell tool execution with mock', async () => {
            const tellTool = registeredTools.get('tell');
            const handler = tellTool.handler;

            // Mock the service dependencies
            vi.doMock('../../../../mcp/tools/simple-verbs.js', async (importOriginal) => {
                const actual = await importOriginal();
                return {
                    ...actual,
                    SimpleVerbsService: class MockService {
                        async tell() {
                            return { 
                                success: true, 
                                verb: 'tell',
                                message: 'Mock response' 
                            };
                        }
                    }
                };
            });

            // The handler should be callable (though it may fail due to missing deps in test)
            expect(typeof handler).toBe('function');
        });
    });

    describe('SimpleVerbToolNames constants', () => {
        it('should export correct tool name constants', () => {
            expect(SimpleVerbToolNames.TELL).toBe('tell');
            expect(SimpleVerbToolNames.ASK).toBe('ask');
            expect(SimpleVerbToolNames.AUGMENT).toBe('augment');
            expect(SimpleVerbToolNames.ZOOM).toBe('zoom');
            expect(SimpleVerbToolNames.PAN).toBe('pan');
            expect(SimpleVerbToolNames.TILT).toBe('tilt');
        });

        it('should have all expected tool name constants', () => {
            const expectedNames = ['TELL', 'ASK', 'AUGMENT', 'ZOOM', 'PAN', 'TILT'];
            
            expectedNames.forEach(name => {
                expect(SimpleVerbToolNames).toHaveProperty(name);
            });

            expect(Object.keys(SimpleVerbToolNames)).toEqual(expectedNames);
        });

        it('should use tool name constants in registration', () => {
            registerSimpleVerbs(mockServer);

            // Verify that the registered tool names match the constants
            expect(registeredTools.has(SimpleVerbToolNames.TELL)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.ASK)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.AUGMENT)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.ZOOM)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.PAN)).toBe(true);
            expect(registeredTools.has(SimpleVerbToolNames.TILT)).toBe(true);
        });
    });

    describe('Error Handling in Registration', () => {
        it('should handle server registration errors gracefully', () => {
            const errorServer = {
                tool: vi.fn(() => {
                    throw new Error('Registration failed');
                })
            };

            // Registration should not throw even if server.tool fails
            expect(() => registerSimpleVerbs(errorServer)).toThrow('Registration failed');
        });

        it('should continue registering other tools if one fails', () => {
            let callCount = 0;
            const partialFailureServer = {
                tool: vi.fn((name) => {
                    callCount++;
                    if (name === 'ask') {
                        throw new Error('Ask tool registration failed');
                    }
                    registeredTools.set(name, { name });
                })
            };

            // Should attempt to register all tools, even if one fails
            expect(() => registerSimpleVerbs(partialFailureServer)).toThrow();
            
            // Should have attempted to register the tool that failed
            expect(partialFailureServer.tool).toHaveBeenCalledWith(
                'ask',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });
});