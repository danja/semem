/**
 * VSOM Standalone Unit Tests
 * Tests for the standalone VSOM application components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock D3 and other DOM dependencies
const mockDOM = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>VSOM Test</title>
</head>
<body>
    <div id="app">
        <div id="vsom-grid"></div>
        <div id="data-panel">
            <div id="total-interactions">0</div>
            <div id="total-concepts">0</div>
            <div id="total-duration">0s</div>
            <div id="vsom-nodes">0</div>
            <div id="vsom-grid-size">0x0</div>
            <div id="vsom-trained">No</div>
            <div id="interaction-list"></div>
        </div>
        <div id="zpt-controls">
            <button class="zoom-button" data-level="entity">Entity</button>
            <button class="zoom-button" data-level="unit">Unit</button>
            <button class="tilt-button" data-style="keywords">Keywords</button>
            <button class="tilt-button" data-style="embedding">Embedding</button>
            <input id="pan-domains" type="text" />
            <input id="pan-keywords" type="text" />
            <input id="similarity-threshold" type="range" min="0" max="1" step="0.05" value="0.3" />
            <div id="threshold-value">0.3</div>
            <div id="current-zoom">entity</div>
            <div id="current-pan">all</div>
            <div id="current-tilt">keywords</div>
        </div>
        <div id="toast-container"></div>
    </div>
</body>
</html>
`, { url: 'http://localhost' });

global.window = mockDOM.window;
global.document = mockDOM.window.document;
global.HTMLElement = mockDOM.window.HTMLElement;
global.SVGElement = mockDOM.window.SVGElement;

// Mock fetch API
global.fetch = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock localStorage
global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};

describe('VSOM Standalone Application', () => {
    let VSOMUtils, DataProcessor, VSOMApiService;
    let VSOMGrid, DataPanel, ZPTControls;

    beforeEach(async () => {
        // Reset DOM
        document.body.innerHTML = mockDOM.window.document.body.innerHTML;
        
        // Clear all mocks
        vi.clearAllMocks();
        
        // Import modules after DOM setup
        const { default: VSOMUtilsClass } = await import('../../public/js/utils/VSOMUtils.js');
        const { default: DataProcessorClass } = await import('../../public/js/services/DataProcessor.js');
        const { default: VSOMApiServiceClass } = await import('../../public/js/services/VSOMApiService.js');
        const { default: VSOMGridClass } = await import('../../public/js/components/VSOMGrid.js');
        const { default: DataPanelClass } = await import('../../public/js/components/DataPanel.js');
        const { default: ZPTControlsClass } = await import('../../public/js/components/ZPTControls.js');
        
        VSOMUtils = VSOMUtilsClass;
        DataProcessor = DataProcessorClass;
        VSOMApiService = VSOMApiServiceClass;
        VSOMGrid = VSOMGridClass;
        DataPanel = DataPanelClass;
        ZPTControls = ZPTControlsClass;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('VSOMUtils', () => {
        it('should format duration correctly', () => {
            expect(VSOMUtils.formatDuration(1000)).toBe('1s');
            expect(VSOMUtils.formatDuration(60000)).toBe('1m 0s');
            expect(VSOMUtils.formatDuration(3661000)).toBe('1h 1m');
            expect(VSOMUtils.formatDuration(86461000)).toBe('1d 1h');
        });

        it('should format relative time correctly', () => {
            const now = new Date();
            const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            
            expect(VSOMUtils.formatRelativeTime(new Date(now.getTime() - 30 * 1000))).toBe('Just now');
            expect(VSOMUtils.formatRelativeTime(oneMinuteAgo)).toBe('1m ago');
            expect(VSOMUtils.formatRelativeTime(oneHourAgo)).toBe('1h ago');
        });

        it('should calculate cosine similarity correctly', () => {
            const a = [1, 0, 0];
            const b = [1, 0, 0];
            const c = [0, 1, 0];
            
            expect(VSOMUtils.cosineSimilarity(a, b)).toBeCloseTo(1.0);
            expect(VSOMUtils.cosineSimilarity(a, c)).toBeCloseTo(0.0);
        });

        it('should generate consistent colors from strings', () => {
            const color1 = VSOMUtils.stringToColor('test');
            const color2 = VSOMUtils.stringToColor('test');
            const color3 = VSOMUtils.stringToColor('different');
            
            expect(color1).toBe(color2);
            expect(color1).not.toBe(color3);
            expect(color1).toMatch(/^hsl\(\d+, 70%, 50%\)$/);
        });

        it('should create SVG elements with attributes', () => {
            const circle = VSOMUtils.createSVGElement('circle', {
                cx: '10',
                cy: '10',
                r: '5'
            });
            
            expect(circle.tagName).toBe('circle');
            expect(circle.getAttribute('cx')).toBe('10');
            expect(circle.getAttribute('cy')).toBe('10');
            expect(circle.getAttribute('r')).toBe('5');
        });
    });

    describe('DataProcessor', () => {
        let processor;

        beforeEach(() => {
            processor = new DataProcessor();
        });

        it('should create instance with default interaction types', () => {
            expect(processor.interactionTypes).toBeDefined();
            expect(processor.interactionTypes.tell).toBeDefined();
            expect(processor.interactionTypes.ask).toBeDefined();
        });

        it('should process empty interactions', async () => {
            const result = await processor.processInteractions([]);
            
            expect(result.nodes).toEqual([]);
            expect(result.gridSize).toBe(1);
            expect(result.interactions).toEqual([]);
        });

        it('should detect interaction types correctly', () => {
            const tellInteraction = { type: 'tell', content: 'Store this information' };
            const askInteraction = { type: 'ask', content: 'What is the answer?' };
            const chatInteraction = { content: 'Hello there' };
            
            expect(processor.detectInteractionType(tellInteraction)).toBe('tell');
            expect(processor.detectInteractionType(askInteraction)).toBe('ask');
            expect(processor.detectInteractionType(chatInteraction)).toBe('chat');
        });

        it('should calculate appropriate grid size', () => {
            expect(processor.calculateGridSize(0)).toBe(1);
            expect(processor.calculateGridSize(9)).toBe(3);
            expect(processor.calculateGridSize(16)).toBe(5); // With padding
            expect(processor.calculateGridSize(100)).toBe(12);
        });

        it('should apply ZPT filters correctly', () => {
            const interactions = [
                { type: 'tell', concepts: ['AI', 'machine learning'] },
                { type: 'ask', concepts: ['database'] },
                { type: 'chat', concepts: [] }
            ];

            // Test tilt filter for keywords
            const keywordFiltered = processor.applyTiltFilter(interactions, 'keywords');
            expect(keywordFiltered).toHaveLength(2); // Only interactions with concepts

            // Test pan filter for domains
            const panFiltered = processor.applyPanFilter(interactions, { domains: 'AI' });
            expect(panFiltered).toHaveLength(1); // Only the AI interaction
        });

        it('should transform interactions to nodes', async () => {
            const interactions = [
                {
                    id: '1',
                    type: 'tell',
                    content: 'Test content',
                    concepts: ['test'],
                    timestamp: new Date().toISOString()
                }
            ];

            const nodes = await processor.transformToNodes(interactions, {});
            
            expect(nodes).toHaveLength(1);
            expect(nodes[0].type).toBe('tell');
            expect(nodes[0].content).toBe('Test content');
            expect(nodes[0].concepts).toEqual(['test']);
            expect(nodes[0].color).toBeDefined();
        });
    });

    describe('VSOMApiService', () => {
        let apiService;

        beforeEach(() => {
            apiService = new VSOMApiService();
        });

        it('should create instance with default configuration', () => {
            expect(apiService.baseUrl).toBe('/api');
            expect(apiService.sessionId).toBeNull();
        });

        it('should test connection', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ status: 'healthy' })
            });

            const connected = await apiService.testConnection();
            expect(connected).toBe(true);
            expect(fetch).toHaveBeenCalledWith('/api/health', expect.any(Object));
        });

        it('should handle connection failure', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            const connected = await apiService.testConnection();
            expect(connected).toBe(false);
        });

        it('should get interaction history', async () => {
            const mockData = {
                sessionCache: {
                    interactions: [
                        { id: '1', type: 'tell', content: 'Test' },
                        { id: '2', type: 'ask', content: 'Question?' }
                    ]
                }
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            const result = await apiService.getInteractionHistory();
            
            expect(result.success).toBe(true);
            expect(result.interactions).toHaveLength(2);
            expect(result.total).toBe(2);
        });
    });

    describe('VSOMGrid', () => {
        let container, grid;

        beforeEach(() => {
            container = document.getElementById('vsom-grid');
            grid = new VSOMGrid(container);
        });

        it('should create instance with default options', () => {
            expect(grid.container).toBe(container);
            expect(grid.options.nodeSize).toBe(6);
            expect(grid.options.showGrid).toBe(true);
        });

        it('should initialize SVG structure', async () => {
            await grid.init();
            
            expect(grid.svg).toBeDefined();
            expect(grid.mainGroup).toBeDefined();
            expect(grid.gridGroup).toBeDefined();
            expect(grid.nodesGroup).toBeDefined();
            expect(grid.labelsGroup).toBeDefined();
        });

        it('should calculate bounds correctly', async () => {
            await grid.init();
            
            const mockData = {
                nodes: [
                    { x: 0, y: 0 },
                    { x: 2, y: 2 }
                ]
            };

            grid.data = mockData;
            const bounds = grid.calculateBounds();
            
            expect(bounds.minX).toBe(-40); // -gridSpacing
            expect(bounds.maxX).toBe(120); // 2 * gridSpacing + gridSpacing
            expect(bounds.width).toBe(160);
            expect(bounds.height).toBe(160);
        });

        it('should handle empty data', async () => {
            await grid.init();
            await grid.updateData(null);
            
            expect(grid.data).toBeNull();
        });

        it('should update data and render visualization', async () => {
            await grid.init();
            
            const mockData = {
                nodes: [
                    {
                        id: 'node1',
                        x: 1,
                        y: 1,
                        type: 'tell',
                        content: 'Test content',
                        concepts: ['test']
                    }
                ],
                gridSize: 5
            };

            await grid.updateData(mockData);
            
            expect(grid.data).toBe(mockData);
            expect(grid.nodesGroup.children.length).toBe(1);
        });
    });

    describe('DataPanel', () => {
        let container, dataPanel;

        beforeEach(() => {
            container = document.getElementById('data-panel');
            dataPanel = new DataPanel(container);
        });

        it('should create instance with default options', () => {
            expect(dataPanel.container).toBe(container);
            expect(dataPanel.options.maxInteractions).toBe(50);
        });

        it('should initialize successfully', async () => {
            await dataPanel.init();
            expect(dataPanel.initialized).toBe(true);
        });

        it('should update session stats', async () => {
            await dataPanel.init();
            
            const stats = {
                totalInteractions: 10,
                totalConcepts: 25,
                duration: '5m 30s'
            };

            await dataPanel.updateData({ sessionStats: stats });
            
            expect(document.getElementById('total-interactions').textContent).toBe('10');
            expect(document.getElementById('total-concepts').textContent).toBe('25');
            expect(document.getElementById('total-duration').textContent).toBe('5m 30s');
        });

        it('should render interaction list', async () => {
            await dataPanel.init();
            
            const interactions = [
                {
                    id: '1',
                    type: 'tell',
                    content: 'Test interaction',
                    concepts: ['test'],
                    timestamp: new Date().toISOString()
                }
            ];

            await dataPanel.updateData({ interactions });
            
            const listContainer = document.getElementById('interaction-list');
            expect(listContainer.children.length).toBe(1);
            expect(listContainer.querySelector('.interaction-item')).toBeDefined();
        });

        it('should detect interaction types correctly', () => {
            const tellInteraction = { type: 'tell' };
            const askInteraction = { content: 'What is this?' };
            const uploadInteraction = { content: 'uploaded file.pdf' };
            
            expect(dataPanel.detectInteractionType(tellInteraction)).toBe('tell');
            expect(dataPanel.detectInteractionType(askInteraction)).toBe('ask');
            expect(dataPanel.detectInteractionType(uploadInteraction)).toBe('upload');
        });
    });

    describe('ZPTControls', () => {
        let container, zptControls;

        beforeEach(() => {
            container = document.getElementById('zpt-controls');
            zptControls = new ZPTControls(container, {
                onZPTChange: vi.fn()
            });
        });

        it('should create instance with default state', () => {
            expect(zptControls.container).toBe(container);
            expect(zptControls.state.zoom).toBe('entity');
            expect(zptControls.state.tilt).toBe('keywords');
            expect(zptControls.state.threshold).toBe(0.3);
        });

        it('should initialize successfully', async () => {
            await zptControls.init();
            expect(zptControls.initialized).toBe(true);
        });

        it('should handle zoom changes', async () => {
            await zptControls.init();
            
            zptControls.handleZoomChange('unit');
            
            expect(zptControls.state.zoom).toBe('unit');
            expect(zptControls.options.onZPTChange).toHaveBeenCalledWith({ zoom: 'unit' });
        });

        it('should handle tilt changes', async () => {
            await zptControls.init();
            
            zptControls.handleTiltChange('embedding');
            
            expect(zptControls.state.tilt).toBe('embedding');
            expect(zptControls.options.onZPTChange).toHaveBeenCalledWith({ tilt: 'embedding' });
        });

        it('should handle threshold changes', async () => {
            await zptControls.init();
            
            zptControls.handleThresholdChange(0.7);
            
            expect(zptControls.state.threshold).toBe(0.7);
            expect(zptControls.options.onZPTChange).toHaveBeenCalledWith({ threshold: 0.7 });
        });

        it('should update display correctly', async () => {
            await zptControls.init();
            
            zptControls.state.zoom = 'unit';
            zptControls.state.threshold = 0.8;
            zptControls.updateDisplay();
            
            expect(document.getElementById('current-zoom').textContent).toBe('unit');
            expect(document.getElementById('threshold-value').textContent).toBe('0.80');
        });

        it('should reset to defaults', async () => {
            await zptControls.init();
            
            zptControls.state.zoom = 'corpus';
            zptControls.state.threshold = 0.9;
            
            zptControls.resetToDefaults();
            
            expect(zptControls.state.zoom).toBe('entity');
            expect(zptControls.state.threshold).toBe(0.3);
        });

        it('should apply presets correctly', async () => {
            await zptControls.init();
            
            zptControls.applyPreset('overview');
            
            expect(zptControls.state.zoom).toBe('corpus');
            expect(zptControls.state.tilt).toBe('temporal');
            expect(zptControls.state.threshold).toBe(0.1);
        });

        it('should save and load presets', async () => {
            await zptControls.init();
            
            localStorage.getItem.mockReturnValue('[]');
            localStorage.setItem.mockImplementation(() => {});
            
            zptControls.state.zoom = 'unit';
            zptControls.saveAsPreset('myPreset');
            
            expect(localStorage.setItem).toHaveBeenCalled();
            
            localStorage.getItem.mockReturnValue(JSON.stringify([{
                name: 'myPreset',
                config: { zoom: 'unit', pan: { domains: '', keywords: '' }, tilt: 'keywords', threshold: 0.3 }
            }]));
            
            zptControls.state.zoom = 'entity'; // Change state
            zptControls.loadPreset('myPreset');
            
            expect(zptControls.state.zoom).toBe('unit');
        });
    });

    describe('Integration Tests', () => {
        it('should coordinate between components', async () => {
            const processor = new DataProcessor();
            const apiService = new VSOMApiService();
            
            // Mock API response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    sessionCache: {
                        interactions: [
                            { id: '1', type: 'tell', content: 'Test', concepts: ['test'] }
                        ]
                    }
                })
            });
            
            const interactions = await apiService.getInteractionHistory();
            const vsomData = await processor.processInteractions(interactions.interactions);
            
            expect(vsomData.nodes).toHaveLength(1);
            expect(vsomData.nodes[0].type).toBe('tell');
        });

        it('should handle ZPT state changes affecting data processing', async () => {
            const processor = new DataProcessor();
            
            const interactions = [
                { type: 'tell', concepts: ['AI'], content: 'AI content' },
                { type: 'ask', concepts: ['database'], content: 'Database question' }
            ];
            
            // Test with different ZPT settings
            const entityResult = await processor.processInteractions(interactions, {
                zoom: 'entity',
                pan: { domains: '', keywords: '' },
                tilt: 'keywords'
            });
            
            const filteredResult = await processor.processInteractions(interactions, {
                zoom: 'entity',
                pan: { domains: 'AI', keywords: '' },
                tilt: 'keywords'
            });
            
            expect(entityResult.nodes).toHaveLength(2);
            expect(filteredResult.nodes).toHaveLength(1);
            expect(filteredResult.nodes[0].concepts).toContain('AI');
        });
    });
});

describe('VSOM Standalone Server', () => {
    let VSOMStandaloneServer;

    beforeEach(async () => {
        const { default: ServerClass } = await import('../../server.js');
        VSOMStandaloneServer = ServerClass;
    });

    it('should create server instance with default options', () => {
        const server = new VSOMStandaloneServer();
        expect(server.port).toBe(4103);
    });

    it('should create server instance with custom port', () => {
        const server = new VSOMStandaloneServer({ port: 5000 });
        expect(server.port).toBe(5000);
    });
});