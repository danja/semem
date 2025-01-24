// Manages sliding context windows with overlap
export default class ContextWindowManager {
    constructor(options = {}) {
        this.minWindowSize = options.minWindowSize || 1024
        this.maxWindowSize = options.maxWindowSize || 8192
        this.overlapRatio = options.overlapRatio || 0.1
        this.avgTokenLength = options.avgTokenLength || 4
    }

    estimateTokens(text) {
        return Math.ceil(text.length / this.avgTokenLength)
    }

    calculateWindowSize(input) {
        const estimatedTokens = this.estimateTokens(input)
        const windowSize = Math.min(
            this.maxWindowSize,
            Math.max(
                this.minWindowSize,
                estimatedTokens * 1.2
            )
        )
        return windowSize
    }

    createWindows(text, windowSize) {
        const windows = []
        const overlapSize = Math.floor(windowSize * this.overlapRatio)
        const stride = windowSize - overlapSize

        for (let position = 0; position < text.length; position += stride) {
            const window = {
                text: text.slice(position, position + windowSize),
                start: position,
                end: Math.min(position + windowSize, text.length)
            }
            windows.push(window)

            if (position + windowSize >= text.length) {
                if (position < text.length) {
                    windows.push({
                        text: text.slice(position),
                        start: position,
                        end: text.length
                    })
                }
                break
            }
        }

        return windows
    }

    mergeOverlappingContent(windows) {
        if (windows.length === 0) return ''
        if (windows.length === 1) return windows[0].text

        let merged = windows[0].text
        for (let i = 1; i < windows.length; i++) {
            const prevText = merged
            const currText = windows[i].text
            const overlapSize = this._findBestOverlap(
                prevText.slice(-this.maxWindowSize),
                currText,
                Math.floor(this.minWindowSize * this.overlapRatio)
            )

            // Only add non-overlapping portion
            merged += currText.slice(overlapSize)
        }

        return merged
    }

    _findBestOverlap(end, start, minOverlap = 10) {
        const maxCheck = Math.min(end.length, start.length)

        // Try to find largest matching section
        for (let overlap = maxCheck; overlap >= minOverlap; overlap--) {
            const endSlice = end.slice(-overlap)
            const startSlice = start.slice(0, overlap)

            // Full word boundary match if possible
            if (endSlice === startSlice) {
                const isWordBoundary = (
                    overlap === maxCheck ||
                    endSlice[0].match(/\s/) ||
                    startSlice[overlap - 1].match(/\s/)
                )
                if (isWordBoundary) {
                    return overlap
                }
            }
        }

        // Fallback to character-level match
        for (let overlap = maxCheck; overlap >= minOverlap; overlap--) {
            if (end.slice(-overlap) === start.slice(0, overlap)) {
                return overlap
            }
        }

        return 0
    }

    processContext(context, options = {}) {
        const windowSize = this.calculateWindowSize(context)
        const windows = this.createWindows(context, windowSize)

        if (options.includeMetadata) {
            return windows.map(window => ({
                ...window,
                tokenEstimate: this.estimateTokens(window.text)
            }))
        }

        return windows
    }
}