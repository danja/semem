// Testing improved regex patterns
console.log('Testing improved regex patterns for JSON array extraction...\n');

const testCases = [
    'First: ["concept1"] and second: ["concept2", "concept3"]',
    '["artificial intelligence", "machine learning"]',
    'Here are the concepts: ["concept1", "concept2"]',
    '["concept1", "concept2"] - these are the main concepts',
    '[JSON] [{"concept1": "value1"}]',
    'No array here',
    '[]',
    '["test"]'
];

// Current regex (greedy)
const greedyRegex = /\[.*\]/;

// Improved regex (non-greedy)
const nonGreedyRegex = /\[.*?\]/;

// Even better regex - specifically for JSON arrays
const jsonArrayRegex = /\[(?:[^[\]]*(?:"[^"]*"[^[\]]*)*)*\]/;

console.log('=== GREEDY REGEX ===');
testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase}"`);
    const match = testCase.match(greedyRegex);
    console.log(`Match: ${match ? match[0] : 'null'}`);
    console.log('---');
});

console.log('\n=== NON-GREEDY REGEX ===');
testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase}"`);
    const match = testCase.match(nonGreedyRegex);
    console.log(`Match: ${match ? match[0] : 'null'}`);
    
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            console.log(`Parsed: ${JSON.stringify(parsed)}`);
        } catch (e) {
            console.log(`Parse error: ${e.message}`);
        }
    }
    console.log('---');
});

console.log('\n=== JSON ARRAY REGEX ===');
testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase}"`);
    const match = testCase.match(jsonArrayRegex);
    console.log(`Match: ${match ? match[0] : 'null'}`);
    
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            console.log(`Parsed: ${JSON.stringify(parsed)}`);
        } catch (e) {
            console.log(`Parse error: ${e.message}`);
        }
    }
    console.log('---');
});