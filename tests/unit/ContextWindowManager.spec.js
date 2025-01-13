import ContextWindowManager from '../../src/ContextWindowManager.js';

describe('ContextWindowManager', () => {
    let windowManager;

    beforeEach(() => {
        windowManager = new ContextWindowManager({
            maxWindowSize: 1000,
            minWindowSize: 250,
            overlapRatio: 0.1
        });
    });

    it('should calculate correct window size', () => {
        const size = windowManager.calculateWindowSize('x'.repeat(1000));
        expect(size).toBeLessThanOrEqual(1000);
        expect(size).toBeGreaterThanOrEqual(250);
    });

    it('should create overlapping windows', () => {
        const text = 'x'.repeat(2000);
        const windows = windowManager.createWindows(text, 1000);
        expect(windows.length).toBeGreaterThan(1);
        expect(windows[0].text.length).toBeLessThanOrEqual(1000);
    });

    it('should merge overlapping content', () => {
        const windows = [
            { text: 'Hello world' },
            { text: 'world and universe' }
        ];
        const merged = windowManager.mergeOverlappingContent(windows);
        expect(merged).toBe('Hello world and universe');
    });
});