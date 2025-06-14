// Test the extractJsonArray method
import LLMHandler from '../../../src/handlers/LLMHandler.js';

const handler = new LLMHandler({}, 'test-model');

const testCases = [
    'First: ["concept1"] and second: ["concept2", "concept3"]',
    '["artificial intelligence", "machine learning"]',
    'Here are the concepts: ["concept1", "concept2"]',
    '["concept1", "concept2"] - these are the main concepts',
    '[JSON] [{"concept1": "value1"}]',
    'No array here',
    '[]',
    '["test"]',
    '[invalid json}',
    '["valid", "array"] followed by [invalid json}',
    '{"not": "an array"}',
    'Multiple arrays: ["first"] and ["second", "third"]'
];

console.log('Testing extractJsonArray method...\n');

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase}"`);
    const result = handler.extractJsonArray(testCase);
    console.log(`Result: ${result}`);
    
    if (result) {
        try {
            const parsed = JSON.parse(result);
            console.log(`Parsed: ${JSON.stringify(parsed)}`);
            console.log(`Type: ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
        } catch (e) {
            console.log(`Parse error: ${e.message}`);
        }
    }
    console.log('---');
});