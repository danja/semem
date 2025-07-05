#!/usr/bin/env node

// Simple test to see what entities are extracted and how they match

function extractSimpleEntities(text) {
    const entities = [];
    const words = text.split(/\s+/);
    
    for (const word of words) {
        const cleaned = word.replace(/[^\w]/g, '');
        if (cleaned.length > 2 && /^[A-Z]/.test(cleaned)) {
            entities.push(cleaned.toLowerCase());
        }
    }
    
    // Add beer-specific terms
    const beerTerms = ['beer', 'ale', 'lager', 'stout', 'porter', 'ipa', 'brewery', 'brewing', 'malt', 'hops'];
    for (const term of beerTerms) {
        if (text.toLowerCase().includes(term)) {
            entities.push(term);
        }
    }
    
    return [...new Set(entities)];
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

function calculateStringSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
}

function fuzzyMatch(str1, str2, threshold = 0.5) {
    const similarity = calculateStringSimilarity(str1, str2);
    return { match: similarity >= threshold, similarity: similarity };
}

// Test the problematic cases
const question = "What are chares?";
const texts = [
    "Hart to Hart",
    "Char", 
    "Char siu",
    "Chares"
];

console.log(`Question: "${question}"`);
const questionEntities = extractSimpleEntities(question);
console.log(`Question entities: [${questionEntities.join(', ')}]`);
console.log();

for (const text of texts) {
    console.log(`\nText: "${text}"`);
    const textEntities = extractSimpleEntities(text);
    console.log(`Text entities: [${textEntities.join(', ')}]`);
    
    const commonEntities = [];
    const matches = [];
    
    for (const qEntity of questionEntities) {
        for (const tEntity of textEntities) {
            const result = fuzzyMatch(qEntity, tEntity, 0.5);
            if (result.match) {
                commonEntities.push(qEntity);
                matches.push(`${qEntity} <-> ${tEntity} (similarity: ${result.similarity.toFixed(3)})`);
            }
        }
    }
    
    console.log(`Matches: ${matches.join(', ')}`);
    console.log(`Common entities: [${commonEntities.join(', ')}]`);
    
    if (commonEntities.length > 0) {
        const entityOverlap = commonEntities.length / Math.max(questionEntities.length, textEntities.length);
        console.log(`Entity overlap weight: ${entityOverlap.toFixed(3)}`);
    } else {
        console.log(`Entity overlap weight: 0.000`);
    }
}