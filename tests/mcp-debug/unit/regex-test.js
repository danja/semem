// Quick regex test to understand the issue
console.log('Testing regex patterns for JSON array extraction...\n');

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

const regex = /\[.*\]/;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase}"`);
    const match = testCase.match(regex);
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