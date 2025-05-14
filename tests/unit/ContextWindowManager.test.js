// tests/unit/ContextWindowManager.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import ContextWindowManager from '../../src/ContextWindowManager.js';

describe('ContextWindowManager', () => {
    let manager;

    beforeEach(() => {
        manager = new ContextWindowManager({
            minWindowSize: 100,
            maxWindowSize: 1000,
            overlapRatio: 0.1,
            avgTokenLength: 4
        });
    });

    describe('Window Sizing', () => {
        it('should calculate appropriate window size', () => {
            const shortText = 'a'.repeat(200);
            const shortSize = manager.calculateWindowSize(shortText);
            expect(shortSize).toBeLessThanOrEqual(1000);
            expect(shortSize).toBeGreaterThanOrEqual(100);

            const longText = 'a'.repeat(5000);
            const longSize = manager.calculateWindowSize(longText);
            expect(longSize).toBe(1000);
        });

        it('should respect minimum window size', () => {
            const tinyText = 'short';
            const size = manager.calculateWindowSize(tinyText);
            expect(size).toBe(100);
        });

        it('should create windows with appropriate sizing', () => {
            // Generate a text with spaces to ensure proper window creation
            const text = 'word '.repeat(400); // 2000 chars
            const windows = manager.createWindows(text, 1000);
            
            // Make sure we have at least 2 windows for a long text
            expect(windows.length).toBeGreaterThan(1);
            
            // Windows should be approximately the requested size
            for (const window of windows) {
                // Allow some flexibility for word boundaries
                const maxExpectedLength = 1100; // 10% extra for word boundary alignment
                expect(window.text.length).toBeLessThanOrEqual(maxExpectedLength);
            }
        });
    });

    describe('Token Estimation', () => {
        it('should estimate tokens based on average length', () => {
            const text = 'The quick brown fox jumps over the lazy dog';
            const tokens = manager.estimateTokens(text);
            expect(tokens).toBe(Math.ceil(text.length / 4));
        });

        it('should handle empty and short texts', () => {
            expect(manager.estimateTokens('')).toBe(0);
            expect(manager.estimateTokens('a')).toBe(1);
        });
    });

    describe('Window Creation', () => {
        it('should create overlapping windows', () => {
            const text = 'word '.repeat(300); // 1500 chars
            const windows = manager.createWindows(text, 1000);

            expect(windows.length).toBeGreaterThan(1);
            
            // The windows might be slightly larger than the target window size
            // due to respecting word boundaries (allow 5% extra)
            windows.forEach(window => {
                expect(window.text.length).toBeLessThanOrEqual(1050);
            });
        });

        it('should handle word boundaries appropriately', () => {
            // Create a simple text with obvious word boundaries
            const text = 'one two three four five six seven eight nine ten';
            const windows = manager.createWindows(text, 15);
            
            // Check that window positions make sense
            for (let i = 0; i < windows.length - 1; i++) {
                const window = windows[i];
                const nextWindow = windows[i + 1];
                
                // The end position should be before the start of the next window
                // or they should overlap at a word boundary
                expect(window.end).toBeLessThanOrEqual(nextWindow.end);
                
                // Each window's text should be a substring of the original text
                expect(text.slice(window.start, window.end)).toContain(window.text);
            }
        });

        it('should handle single-window texts', () => {
            const text = 'word '.repeat(10);
            const windows = manager.createWindows(text, 1000);

            expect(windows.length).toBe(1);
            expect(windows[0].text).toBe(text.trim());
        });
    });

    describe('Content Processing', () => {
        it('should process context within window limits', () => {
            const shortContext = 'short context';
            const shortResult = manager.processContext(shortContext);
            expect(shortResult.length).toBe(1);

            const longContext = 'word '.repeat(300);
            const longResult = manager.processContext(longContext);
            expect(longResult.length).toBeGreaterThan(1);
        });

        it('should include metadata when requested', () => {
            const context = 'test context';
            const result = manager.processContext(context, { includeMetadata: true });

            expect(result[0].tokenEstimate).toBeDefined();
            expect(result[0].start).toBe(0);
            expect(result[0].end).toBe(context.length);
        });
    });

    describe('Content Merging', () => {
        it('should merge overlapping content', () => {
            const windows = [
                { text: 'The quick brown' },
                { text: 'brown fox jumps' },
                { text: 'jumps over lazy' }
            ];

            const merged = manager.mergeOverlappingContent(windows);
            expect(merged).toBe('The quick brown fox jumps over lazy');
        });

        it('should handle non-overlapping content', () => {
            const windows = [
                { text: 'First part.' },
                { text: 'Second part.' }
            ];

            const merged = manager.mergeOverlappingContent(windows);
            expect(merged).toBe('First part. Second part.');
        });

        it('should find optimal overlap points', () => {
            const text = 'The quick brown fox jumps over the lazy dog';
            const windows = manager.createWindows(text, 20);
            const merged = manager.mergeOverlappingContent(windows);

            expect(merged).toBe(text);
            expect(merged.split(' ').length).toBe(text.split(' ').length);
        });

        it('should preserve special characters', () => {
            const specialText = 'Text with newlines\nand "quotes" and periods...';
            const windows = manager.createWindows(specialText, 20);
            const merged = manager.mergeOverlappingContent(windows);

            expect(merged).toBe(specialText);
        });
    });
});