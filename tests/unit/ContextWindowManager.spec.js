// tests/unit/ContextWindowManager.spec.js
import ContextWindowManager from '../../src/ContextWindowManager.js'

describe('ContextWindowManager', () => {
    let manager

    beforeEach(() => {
        manager = new ContextWindowManager({
            minWindowSize: 100,
            maxWindowSize: 1000,
            overlapRatio: 0.1,
            avgTokenLength: 4
        })
    })

    describe('Window Sizing', () => {
        it('should calculate appropriate window size', () => {
            const shortText = 'a'.repeat(200)
            const shortSize = manager.calculateWindowSize(shortText)
            expect(shortSize).toBeLessThanOrEqual(1000)
            expect(shortSize).toBeGreaterThanOrEqual(100)

            const longText = 'a'.repeat(5000)
            const longSize = manager.calculateWindowSize(longText)
            expect(longSize).toBe(1000)
        })

        it('should respect minimum window size', () => {
            const tinyText = 'short'
            const size = manager.calculateWindowSize(tinyText)
            expect(size).toBe(100)
        })

        it('should apply overlap ratio correctly', () => {
            const text = 'a'.repeat(2000)
            const windows = manager.createWindows(text, 1000)

            const overlap = windows[0].text.length + windows[1].text.length - text.length
            expect(overlap).toBeGreaterThan(90) // ~10% overlap
            expect(overlap).toBeLessThan(110)
        })
    })

    describe('Token Estimation', () => {
        it('should estimate tokens based on average length', () => {
            const text = 'The quick brown fox jumps over the lazy dog'
            const tokens = manager.estimateTokens(text)
            expect(tokens).toBe(Math.ceil(text.length / 4))
        })

        it('should handle empty and short texts', () => {
            expect(manager.estimateTokens('')).toBe(0)
            expect(manager.estimateTokens('a')).toBe(1)
        })
    })

    describe('Window Creation', () => {
        it('should create overlapping windows', () => {
            const text = 'word '.repeat(300) // 1500 chars
            const windows = manager.createWindows(text, 1000)

            expect(windows.length).toBe(2)
            expect(windows[0].text.length).toBeLessThanOrEqual(1000)
            expect(windows[1].text.length).toBeLessThanOrEqual(1000)
        })

        it('should preserve word boundaries', () => {
            const text = 'word '.repeat(300)
            const windows = manager.createWindows(text, 1000)

            expect(windows[0].text.endsWith(' ')).toBeTrue()
            expect(windows[1].text.startsWith('word')).toBeTrue()
        })

        it('should handle single-window texts', () => {
            const text = 'word '.repeat(10)
            const windows = manager.createWindows(text, 1000)

            expect(windows.length).toBe(1)
            expect(windows[0].text).toBe(text)
        })
    })

    describe('Content Processing', () => {
        it('should process context within window limits', () => {
            const shortContext = 'short context'
            const shortResult = manager.processContext(shortContext)
            expect(shortResult.length).toBe(1)

            const longContext = 'word '.repeat(300)
            const longResult = manager.processContext(longContext)
            expect(longResult.length).toBeGreaterThan(1)
        })

        it('should include metadata when requested', () => {
            const context = 'test context'
            const result = manager.processContext(context, { includeMetadata: true })

            expect(result[0].tokenEstimate).toBeDefined()
            expect(result[0].start).toBe(0)
            expect(result[0].end).toBe(context.length)
        })
    })

    describe('Content Merging', () => {
        it('should merge overlapping content', () => {
            const windows = [
                { text: 'The quick brown' },
                { text: 'brown fox jumps' },
                { text: 'jumps over lazy' }
            ]

            const merged = manager.mergeOverlappingContent(windows)
            expect(merged).toBe('The quick brown fox jumps over lazy')
        })

        it('should handle non-overlapping content', () => {
            const windows = [
                { text: 'First part.' },
                { text: 'Second part.' }
            ]

            const merged = manager.mergeOverlappingContent(windows)
            expect(merged).toBe('First part. Second part.')
        })

        it('should find optimal overlap points', () => {
            const text = 'The quick brown fox jumps over the lazy dog'
            const windows = manager.createWindows(text, 20)
            const merged = manager.mergeOverlappingContent(windows)

            expect(merged).toBe(text)
            expect(merged.split(' ').length).toBe(text.split(' ').length)
        })

        it('should preserve special characters', () => {
            const specialText = 'Text with newlines\nand "quotes" and periods...'
            const windows = manager.createWindows(specialText, 20)
            const merged = manager.mergeOverlappingContent(windows)

            expect(merged).toBe(specialText)
        })
    })
})