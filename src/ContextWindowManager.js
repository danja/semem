// src/ContextWindow.js
import { logger } from './Utils.js';

export default class ContextWindowManager {
    constructor(options = {}) {
        this.minWindowSize = options.minWindowSize || 1024;
        this.maxWindowSize = options.maxWindowSize || 8192;
        this.overlapRatio = options.overlapRatio || 0.1; // 10% overlap
        this.avgTokenLength = options.avgTokenLength || 4; // average chars per token
    }

    // Estimate token count from text length
    estimateTokens(text) {
        return Math.ceil(text.length / this.avgTokenLength);
    }

    // Calculate optimal window size based on input
    calculateWindowSize(input) {
        const estimatedTokens = this.estimateTokens(input);

        // Scale window size based on input length
        let windowSize = Math.min(
            this.maxWindowSize,
            Math.max(
                this.minWindowSize,
                estimatedTokens * 1.2 // Add 20% buffer
            )
        );

        logger.debug(`Calculated window size: ${windowSize} for input length: ${input.length}`);
        return windowSize;
    }

    // Create overlapping windows
    createWindows(text, windowSize) {
        const windows = [];
        const overlapSize = Math.floor(windowSize * this.overlapRatio);
        const stride = windowSize - overlapSize;

        let position = 0;
        while (position < text.length) {
            const window = {
                text: text.slice(position, position + windowSize),
                start: position,
                end: Math.min(position + windowSize, text.length)
            };

            windows.push(window);
            position += stride;

            if (position + windowSize >= text.length) {
                // Add final window if needed
                if (position < text.length) {
                    windows.push({
                        text: text.slice(position),
                        start: position,
                        end: text.length
                    });
                }
                break;
            }
        }

        return windows;
    }

    // Merge overlapping responses
    mergeOverlappingContent(windows) {
        if (windows.length === 0) return '';
        if (windows.length === 1) return windows[0].text;

        let merged = windows[0].text;
        for (let i = 1; i < windows.length; i++) {
            const overlap = this._findBestOverlap(
                merged.slice(-this.maxWindowSize),
                windows[i].text
            );
            merged += windows[i].text.slice(overlap);
        }

        return merged;
    }

    // Find best overlap point between two text segments
    _findBestOverlap(end, start, minOverlap = 10) {
        // Try to find the largest matching section
        for (let overlap = Math.min(end.length, start.length); overlap >= minOverlap; overlap--) {
            const endSlice = end.slice(-overlap);
            const startSlice = start.slice(0, overlap);

            if (endSlice === startSlice) {
                return overlap;
            }
        }

        return 0;
    }

    // Process context with optimal windowing
    processContext(context, options = {}) {
        const windowSize = this.calculateWindowSize(context);
        const windows = this.createWindows(context, windowSize);

        logger.debug(`Created ${windows.length} windows with size ${windowSize}`);

        // Add window metadata if requested
        if (options.includeMetadata) {
            return windows.map(window => ({
                ...window,
                tokenEstimate: this.estimateTokens(window.text)
            }));
        }

        return windows;
    }
}
