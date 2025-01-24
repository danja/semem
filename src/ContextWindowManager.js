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
        return Math.min(
            this.maxWindowSize,
            Math.max(this.minWindowSize, estimatedTokens * 1.2)
        )
    }

    createWindows(text, windowSize) {
        const windows = []
        const overlapSize = Math.floor(windowSize * this.overlapRatio)
        const stride = windowSize - overlapSize

        let position = 0
        while (position < text.length) {
            const end = Math.min(position + windowSize, text.length)
            const window = {
                text: text.slice(position, end),
                start: position,
                end: end
            }
            windows.push(window)
            if (end === text.length) break

            // Find next word boundary for clean split
            position += Math.max(1, stride)
            while (position < text.length && !text[position].match(/\s/)) {
                position++
            }
        }

        return windows
    }

    processContext(context, options = {}) {
        const windowSize = this.calculateWindowSize(context)
        const windows = this.createWindows(context, windowSize)
        return options.includeMetadata ?
            windows.map(w => ({ ...w, tokenEstimate: this.estimateTokens(w.text) })) :
            windows
    }

    mergeOverlappingContent(windows) {
        if (!windows?.length) return ''
        if (windows.length === 1) return windows[0].text

        let result = windows[0].text
        for (let i = 1; i < windows.length; i++) {
            const currText = windows[i].text
            const overlap = this._findOverlap(result, currText)
            if (overlap > 0) {
                result += currText.slice(overlap)
            } else {
                result += ' ' + currText
            }
        }
        return result.trim()
    }

    _findOverlap(prev, curr) {
        const minOverlap = Math.min(10, Math.floor(curr.length * 0.1))
        for (let len = Math.min(prev.length, curr.length); len >= minOverlap; len--) {
            const prevEnd = prev.slice(-len)
            const currStart = curr.slice(0, len)

            if (prevEnd === currStart) {
                // Verify word boundary
                const beforeChar = prev[prev.length - len - 1]
                const afterChar = curr[len]
                if (!beforeChar?.match(/\w/) && !afterChar?.match(/\w/)) {
                    return len
                }
            }
        }
        return 0
    }
}