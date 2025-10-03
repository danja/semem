/**
 * KeywordExtractor - Simple frequency-based keyword extraction
 *
 * Extracts meaningful keywords from text by filtering stopwords and
 * counting word frequency. Used for generating labels from chunk content.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load and cache stopwords from config
let stopwordsSet = null;

function loadStopwords() {
    if (stopwordsSet) return stopwordsSet;

    const stopwordsPath = join(__dirname, '../../config/stopwords.txt');
    const stopwordsContent = readFileSync(stopwordsPath, 'utf-8');

    stopwordsSet = new Set(
        stopwordsContent
            .split('\n')
            .map(line => line.trim().toLowerCase())
            .filter(line => line && !line.startsWith('#'))
    );

    return stopwordsSet;
}

/**
 * Extract top keywords from text using frequency analysis
 * @param {string} text - Text to extract keywords from
 * @param {number} count - Number of keywords to extract (default: 5)
 * @returns {string[]} Array of top keywords by frequency
 */
export function extractKeywords(text, count = 5) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const stopwords = loadStopwords();

    // Tokenize: lowercase, remove punctuation, split on whitespace
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word =>
            word.length >= 4 &&  // At least 4 characters
            !stopwords.has(word) // Not a stopword
        );

    if (words.length === 0) {
        return [];
    }

    // Count word frequency
    const wordCounts = new Map();
    for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    // Sort by frequency (descending) and take top N
    return Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([word]) => word);
}

/**
 * Generate a label from text using top keywords
 * @param {string} text - Text to generate label from
 * @param {number} keywordCount - Number of keywords to use (default: 5)
 * @returns {string} Space-separated keyword label, or 'unlabeled' if no keywords found
 */
export function generateLabel(text, keywordCount = 5) {
    const keywords = extractKeywords(text, keywordCount);
    return keywords.length > 0 ? keywords.join(' ') : 'unlabeled';
}

export default {
    extractKeywords,
    generateLabel
};
