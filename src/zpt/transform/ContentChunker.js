/**
 * Intelligent content chunking with semantic boundaries and size limits
 */
export default class ContentChunker {
    constructor(options = {}) {
        this.config = {
            defaultChunkSize: options.defaultChunkSize || 1000,
            maxChunkSize: options.maxChunkSize || 4000,
            minChunkSize: options.minChunkSize || 100,
            overlapSize: options.overlapSize || 100,
            preserveStructure: options.preserveStructure !== false,
            semanticBoundaries: options.semanticBoundaries !== false,
            balanceChunks: options.balanceChunks !== false,
            ...options
        };

        this.initializeChunkingStrategies();
        this.initializeBoundaryDetectors();
        this.chunkingStats = {
            totalChunks: 0,
            avgChunkSize: 0,
            chunksCreated: 0
        };
    }

    /**
     * Initialize different chunking strategies
     */
    initializeChunkingStrategies() {
        this.strategies = {
            fixed: {
                name: 'Fixed Size Chunking',
                handler: this.fixedSizeChunking.bind(this),
                description: 'Split content into fixed-size chunks',
                preservesBoundaries: false,
                efficiency: 'high'
            },
            semantic: {
                name: 'Semantic Boundary Chunking',
                handler: this.semanticChunking.bind(this),
                description: 'Split content at semantic boundaries',
                preservesBoundaries: true,
                efficiency: 'medium'
            },
            adaptive: {
                name: 'Adaptive Size Chunking',
                handler: this.adaptiveChunking.bind(this),
                description: 'Dynamically adjust chunk sizes based on content',
                preservesBoundaries: true,
                efficiency: 'low'
            },
            hierarchical: {
                name: 'Hierarchical Structure Chunking',
                handler: this.hierarchicalChunking.bind(this),
                description: 'Respect document structure hierarchy',
                preservesBoundaries: true,
                efficiency: 'medium'
            },
            token_aware: {
                name: 'Token-Aware Chunking',
                handler: this.tokenAwareChunking.bind(this),
                description: 'Chunk based on actual token counts',
                preservesBoundaries: true,
                efficiency: 'low'
            }
        };
    }

    /**
     * Initialize boundary detection patterns
     */
    initializeBoundaryDetectors() {
        this.boundaryDetectors = {
            paragraph: {
                pattern: /\n\s*\n/,
                priority: 5,
                description: 'Paragraph breaks'
            },
            sentence: {
                pattern: /[.!?]+\s+(?=[A-Z])/,
                priority: 3,
                description: 'Sentence boundaries'
            },
            section: {
                pattern: /\n#+\s+/,
                priority: 8,
                description: 'Markdown section headers'
            },
            list: {
                pattern: /\n\s*[-*+]\s+/,
                priority: 4,
                description: 'List items'
            },
            code: {
                pattern: /```[\s\S]*?```/,
                priority: 9,
                description: 'Code blocks'
            },
            quote: {
                pattern: /\n>\s+/,
                priority: 6,
                description: 'Quote blocks'
            }
        };
    }

    /**
     * Main chunking method - splits content based on strategy and constraints
     * @param {string|Array} content - Content to chunk (string or array of corpuscles)
     * @param {Object} options - Chunking options
     * @returns {Promise<Object>} Chunking result
     */
    async chunk(content, options = {}) {
        const startTime = Date.now();
        const opts = { ...this.config, ...options };

        try {
            // Normalize input
            const normalizedContent = this.normalizeContent(content);
            
            // Select chunking strategy
            const strategy = opts.strategy || this.selectOptimalStrategy(normalizedContent, opts);
            const strategyHandler = this.strategies[strategy];
            
            if (!strategyHandler) {
                throw new Error(`Unknown chunking strategy: ${strategy}`);
            }

            // Perform chunking
            const chunks = await strategyHandler.handler(normalizedContent, opts);
            
            // Post-process chunks
            const processedChunks = this.postProcessChunks(chunks, opts);
            
            // Validate chunks
            this.validateChunks(processedChunks, opts);
            
            // Update statistics
            this.updateChunkingStats(processedChunks);
            
            const result = {
                chunks: processedChunks,
                metadata: {
                    strategy,
                    totalChunks: processedChunks.length,
                    originalSize: this.getContentSize(normalizedContent),
                    avgChunkSize: this.calculateAverageChunkSize(processedChunks),
                    processingTime: Date.now() - startTime,
                    options: opts
                },
                statistics: this.getChunkingStatistics(processedChunks)
            };

            return result;

        } catch (error) {
            throw new Error(`Chunking failed: ${error.message}`);
        }
    }

    /**
     * Normalize content input to a standard format
     */
    normalizeContent(content) {
        if (typeof content === 'string') {
            return {
                type: 'text',
                content: content,
                metadata: {}
            };
        }

        if (Array.isArray(content)) {
            return {
                type: 'corpuscles',
                content: content,
                metadata: {
                    count: content.length,
                    types: [...new Set(content.map(c => c.type))]
                }
            };
        }

        if (content && typeof content === 'object') {
            return content;
        }

        throw new Error('Invalid content type for chunking');
    }

    /**
     * Select optimal chunking strategy based on content analysis
     */
    selectOptimalStrategy(normalizedContent, options) {
        const { type, content } = normalizedContent;
        
        // Token-aware strategy for precise token management
        if (options.tokenCounter && options.maxTokens) {
            return 'token_aware';
        }
        
        // Hierarchical for structured content
        if (type === 'corpuscles' || this.hasStructure(content)) {
            return 'hierarchical';
        }
        
        // Semantic for text content when boundaries matter
        if (this.config.semanticBoundaries && typeof content === 'string') {
            return 'semantic';
        }
        
        // Adaptive for variable content sizes
        if (options.balanceChunks) {
            return 'adaptive';
        }
        
        // Default to fixed size for efficiency
        return 'fixed';
    }

    /**
     * Fixed size chunking strategy
     */
    async fixedSizeChunking(normalizedContent, options) {
        const { content } = normalizedContent;
        const chunkSize = options.chunkSize || this.config.defaultChunkSize;
        const overlap = options.overlapSize || this.config.overlapSize;
        
        if (typeof content !== 'string') {
            throw new Error('Fixed size chunking requires string content');
        }

        const chunks = [];
        let position = 0;
        let chunkId = 0;

        while (position < content.length) {
            const endPosition = Math.min(position + chunkSize, content.length);
            const chunkContent = content.slice(position, endPosition);
            
            chunks.push({
                id: `chunk_${chunkId++}`,
                content: chunkContent,
                position: { start: position, end: endPosition },
                size: chunkContent.length,
                type: 'fixed',
                metadata: {
                    strategy: 'fixed',
                    overlap: position > 0 ? overlap : 0
                }
            });
            
            position = Math.max(position + chunkSize - overlap, position + 1);
        }

        return chunks;
    }

    /**
     * Semantic boundary chunking strategy
     */
    async semanticChunking(normalizedContent, options) {
        const { content } = normalizedContent;
        
        if (typeof content !== 'string') {
            throw new Error('Semantic chunking requires string content');
        }

        // Find semantic boundaries
        const boundaries = this.findSemanticBoundaries(content);
        const targetSize = options.chunkSize || this.config.defaultChunkSize;
        const chunks = [];
        
        let currentChunk = '';
        let chunkStart = 0;
        let chunkId = 0;

        for (const boundary of boundaries) {
            const segment = content.slice(chunkStart, boundary.position);
            
            if (currentChunk.length + segment.length <= targetSize || currentChunk.length === 0) {
                // Add to current chunk
                currentChunk += segment;
            } else {
                // Finalize current chunk and start new one
                if (currentChunk.length > 0) {
                    chunks.push(this.createSemanticChunk(
                        currentChunk, 
                        chunkStart, 
                        chunkStart + currentChunk.length, 
                        chunkId++,
                        boundary
                    ));
                }
                
                currentChunk = segment;
                chunkStart = boundary.position - segment.length;
            }
        }

        // Handle remaining content
        if (currentChunk.length > 0) {
            chunks.push(this.createSemanticChunk(
                currentChunk,
                chunkStart,
                chunkStart + currentChunk.length,
                chunkId++
            ));
        }

        return chunks;
    }

    /**
     * Adaptive chunking strategy
     */
    async adaptiveChunking(normalizedContent, options) {
        const { content } = normalizedContent;
        const minSize = options.minChunkSize || this.config.minChunkSize;
        const maxSize = options.maxChunkSize || this.config.maxChunkSize;
        
        if (typeof content !== 'string') {
            throw new Error('Adaptive chunking requires string content');
        }

        const boundaries = this.findSemanticBoundaries(content);
        const chunks = [];
        let chunkId = 0;
        
        // Group boundaries into optimal chunks
        let currentGroup = [];
        let currentSize = 0;

        for (const boundary of boundaries) {
            const segmentSize = boundary.segmentSize || 50; // Estimate
            
            if (currentSize + segmentSize > maxSize && currentGroup.length > 0) {
                // Create chunk from current group
                const chunk = await this.createAdaptiveChunk(content, currentGroup, chunkId++);
                chunks.push(chunk);
                
                currentGroup = [boundary];
                currentSize = segmentSize;
            } else {
                currentGroup.push(boundary);
                currentSize += segmentSize;
            }
        }

        // Handle remaining group
        if (currentGroup.length > 0) {
            const chunk = await this.createAdaptiveChunk(content, currentGroup, chunkId++);
            chunks.push(chunk);
        }

        return chunks;
    }

    /**
     * Hierarchical chunking strategy
     */
    async hierarchicalChunking(normalizedContent, options) {
        const { type, content } = normalizedContent;
        
        if (type === 'corpuscles') {
            return this.chunkCorpuscles(content, options);
        } else {
            return this.chunkHierarchicalText(content, options);
        }
    }

    /**
     * Token-aware chunking strategy
     */
    async tokenAwareChunking(normalizedContent, options) {
        const { content } = normalizedContent;
        const tokenCounter = options.tokenCounter;
        const maxTokens = options.maxTokens || 1000;
        
        if (!tokenCounter) {
            throw new Error('Token-aware chunking requires tokenCounter');
        }

        if (typeof content !== 'string') {
            throw new Error('Token-aware chunking requires string content');
        }

        const chunks = [];
        const boundaries = this.findSemanticBoundaries(content);
        let currentChunk = '';
        let chunkStart = 0;
        let chunkId = 0;

        for (const boundary of boundaries) {
            const segment = content.slice(chunkStart, boundary.position);
            const testChunk = currentChunk + segment;
            
            // Count tokens in test chunk
            const tokenCount = await tokenCounter.countTokens(testChunk, options.tokenizer);
            
            if (tokenCount.count <= maxTokens || currentChunk.length === 0) {
                currentChunk = testChunk;
            } else {
                // Current chunk exceeds token limit, finalize it
                if (currentChunk.length > 0) {
                    const chunkTokens = await tokenCounter.countTokens(currentChunk, options.tokenizer);
                    chunks.push({
                        id: `chunk_${chunkId++}`,
                        content: currentChunk,
                        position: { start: chunkStart, end: chunkStart + currentChunk.length },
                        size: currentChunk.length,
                        tokenCount: chunkTokens.count,
                        type: 'token_aware',
                        metadata: {
                            strategy: 'token_aware',
                            tokenizer: options.tokenizer,
                            boundary: boundary.type
                        }
                    });
                }
                
                currentChunk = segment;
                chunkStart = boundary.position - segment.length;
            }
        }

        // Handle remaining content
        if (currentChunk.length > 0) {
            const chunkTokens = await tokenCounter.countTokens(currentChunk, options.tokenizer);
            chunks.push({
                id: `chunk_${chunkId++}`,
                content: currentChunk,
                position: { start: chunkStart, end: chunkStart + currentChunk.length },
                size: currentChunk.length,
                tokenCount: chunkTokens.count,
                type: 'token_aware',
                metadata: {
                    strategy: 'token_aware',
                    tokenizer: options.tokenizer
                }
            });
        }

        return chunks;
    }

    /**
     * Find semantic boundaries in text
     */
    findSemanticBoundaries(text) {
        const boundaries = [];
        
        // Find all boundary types
        for (const [type, detector] of Object.entries(this.boundaryDetectors)) {
            const matches = [...text.matchAll(new RegExp(detector.pattern, 'g'))];
            
            matches.forEach(match => {
                boundaries.push({
                    position: match.index,
                    type,
                    priority: detector.priority,
                    length: match[0].length,
                    segmentSize: this.estimateSegmentSize(text, match.index)
                });
            });
        }

        // Sort by position, then by priority
        boundaries.sort((a, b) => {
            if (a.position !== b.position) {
                return a.position - b.position;
            }
            return b.priority - a.priority; // Higher priority first
        });

        // Remove duplicates at same position (keep highest priority)
        const uniqueBoundaries = [];
        let lastPosition = -1;
        
        for (const boundary of boundaries) {
            if (boundary.position !== lastPosition) {
                uniqueBoundaries.push(boundary);
                lastPosition = boundary.position;
            }
        }

        return uniqueBoundaries;
    }

    /**
     * Estimate segment size between boundaries
     */
    estimateSegmentSize(text, position) {
        const nextBoundary = this.findNextBoundary(text, position);
        return nextBoundary ? nextBoundary - position : text.length - position;
    }

    /**
     * Find next boundary position
     */
    findNextBoundary(text, currentPosition) {
        for (const detector of Object.values(this.boundaryDetectors)) {
            const regex = new RegExp(detector.pattern, 'g');
            regex.lastIndex = currentPosition + 1;
            const match = regex.exec(text);
            if (match) {
                return match.index;
            }
        }
        return null;
    }

    /**
     * Create semantic chunk object
     */
    createSemanticChunk(content, start, end, id, boundary = null) {
        return {
            id: `chunk_${id}`,
            content: content.trim(),
            position: { start, end },
            size: content.length,
            type: 'semantic',
            metadata: {
                strategy: 'semantic',
                boundary: boundary ? boundary.type : 'end',
                boundaryPriority: boundary ? boundary.priority : 0
            }
        };
    }

    /**
     * Create adaptive chunk from boundary group
     */
    async createAdaptiveChunk(text, boundaryGroup, id) {
        const start = boundaryGroup[0].position;
        const end = boundaryGroup[boundaryGroup.length - 1].position;
        const content = text.slice(start, end);
        
        return {
            id: `chunk_${id}`,
            content: content.trim(),
            position: { start, end },
            size: content.length,
            type: 'adaptive',
            metadata: {
                strategy: 'adaptive',
                boundaries: boundaryGroup.map(b => b.type),
                avgBoundaryPriority: boundaryGroup.reduce((sum, b) => sum + b.priority, 0) / boundaryGroup.length
            }
        };
    }

    /**
     * Chunk corpuscles hierarchically
     */
    chunkCorpuscles(corpuscles, options) {
        const targetSize = options.chunkSize || this.config.defaultChunkSize;
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;
        let chunkId = 0;

        // Group corpuscles by type for better organization
        const groupedCorpuscles = this.groupCorpusclesByType(corpuscles);
        
        for (const [type, typeCorpuscles] of groupedCorpuscles) {
            for (const corpuscle of typeCorpuscles) {
                const corpuscleSize = this.estimateCorpuscleSize(corpuscle);
                
                if (currentSize + corpuscleSize > targetSize && currentChunk.length > 0) {
                    // Finalize current chunk
                    chunks.push({
                        id: `chunk_${chunkId++}`,
                        content: currentChunk,
                        size: currentSize,
                        type: 'hierarchical_corpuscles',
                        metadata: {
                            strategy: 'hierarchical',
                            corpuscleCount: currentChunk.length,
                            dominantType: this.getDominantType(currentChunk)
                        }
                    });
                    
                    currentChunk = [];
                    currentSize = 0;
                }
                
                currentChunk.push(corpuscle);
                currentSize += corpuscleSize;
            }
        }

        // Handle remaining corpuscles
        if (currentChunk.length > 0) {
            chunks.push({
                id: `chunk_${chunkId++}`,
                content: currentChunk,
                size: currentSize,
                type: 'hierarchical_corpuscles',
                metadata: {
                    strategy: 'hierarchical',
                    corpuscleCount: currentChunk.length,
                    dominantType: this.getDominantType(currentChunk)
                }
            });
        }

        return chunks;
    }

    /**
     * Chunk hierarchical text based on structure
     */
    chunkHierarchicalText(text, options) {
        // Find structural elements (headers, sections, etc.)
        const structure = this.analyzeTextStructure(text);
        const chunks = [];
        let chunkId = 0;

        for (const section of structure.sections) {
            const sectionContent = text.slice(section.start, section.end);
            const sectionSize = sectionContent.length;
            const maxSize = options.maxChunkSize || this.config.maxChunkSize;

            if (sectionSize <= maxSize) {
                // Section fits in one chunk
                chunks.push({
                    id: `chunk_${chunkId++}`,
                    content: sectionContent.trim(),
                    position: { start: section.start, end: section.end },
                    size: sectionSize,
                    type: 'hierarchical_section',
                    metadata: {
                        strategy: 'hierarchical',
                        sectionType: section.type,
                        level: section.level,
                        title: section.title
                    }
                });
            } else {
                // Split large section into sub-chunks
                const subChunks = await this.splitLargeSection(sectionContent, section, maxSize, chunkId);
                chunks.push(...subChunks);
                chunkId += subChunks.length;
            }
        }

        return chunks;
    }

    /**
     * Analyze text structure for hierarchical chunking
     */
    analyzeTextStructure(text) {
        const sections = [];
        const headerPattern = /^(#{1,6})\s+(.+)$/gm;
        let match;
        let lastPosition = 0;

        while ((match = headerPattern.exec(text)) !== null) {
            // Close previous section if exists
            if (sections.length > 0) {
                sections[sections.length - 1].end = match.index;
            }

            // Start new section
            sections.push({
                start: match.index,
                end: text.length, // Will be updated
                level: match[1].length,
                title: match[2].trim(),
                type: 'header'
            });
        }

        // If no headers found, treat as single section
        if (sections.length === 0) {
            sections.push({
                start: 0,
                end: text.length,
                level: 1,
                title: 'Content',
                type: 'content'
            });
        }

        return { sections };
    }

    /**
     * Split large section into sub-chunks
     */
    async splitLargeSection(sectionContent, section, maxSize, startId) {
        // Use semantic chunking for large sections
        const semanticChunks = await this.semanticChunking(
            { type: 'text', content: sectionContent },
            { chunkSize: maxSize }
        );

        return semanticChunks.map((chunk, index) => ({
            ...chunk,
            id: `chunk_${startId + index}`,
            type: 'hierarchical_subsection',
            metadata: {
                ...chunk.metadata,
                parentSection: section.title,
                parentLevel: section.level,
                subsectionIndex: index
            }
        }));
    }

    /**
     * Post-process chunks for optimization
     */
    postProcessChunks(chunks, options) {
        let processed = [...chunks];

        // Balance chunk sizes if requested
        if (options.balanceChunks) {
            processed = this.balanceChunkSizes(processed, options);
        }

        // Add overlap if specified
        if (options.addOverlap && options.overlapSize > 0) {
            processed = this.addChunkOverlap(processed, options);
        }

        // Merge small chunks if beneficial
        if (options.mergeSmallChunks) {
            processed = this.mergeSmallChunks(processed, options);
        }

        // Add chunk relationships
        processed = this.addChunkRelationships(processed);

        return processed;
    }

    /**
     * Balance chunk sizes for more uniform distribution
     */
    balanceChunkSizes(chunks, options) {
        const targetSize = options.chunkSize || this.config.defaultChunkSize;
        const tolerance = 0.2; // 20% tolerance
        const balanced = [];

        for (const chunk of chunks) {
            if (chunk.size > targetSize * (1 + tolerance)) {
                // Split large chunk
                const subChunks = this.splitChunk(chunk, targetSize);
                balanced.push(...subChunks);
            } else if (chunk.size < targetSize * (1 - tolerance)) {
                // Mark for potential merging
                chunk.needsMerging = true;
                balanced.push(chunk);
            } else {
                balanced.push(chunk);
            }
        }

        return balanced;
    }

    /**
     * Add overlap between consecutive chunks
     */
    addChunkOverlap(chunks, options) {
        const overlapSize = options.overlapSize;
        const overlapped = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = { ...chunks[i] };
            
            if (i > 0 && typeof chunk.content === 'string') {
                // Add overlap from previous chunk
                const prevChunk = chunks[i - 1];
                if (typeof prevChunk.content === 'string') {
                    const overlap = prevChunk.content.slice(-overlapSize);
                    chunk.content = overlap + chunk.content;
                    chunk.metadata = {
                        ...chunk.metadata,
                        hasOverlap: true,
                        overlapSize: overlap.length
                    };
                }
            }
            
            overlapped.push(chunk);
        }

        return overlapped;
    }

    /**
     * Merge small consecutive chunks
     */
    mergeSmallChunks(chunks, options) {
        const minSize = options.minChunkSize || this.config.minChunkSize;
        const merged = [];
        let currentMergeGroup = [];

        for (const chunk of chunks) {
            if (chunk.needsMerging || chunk.size < minSize) {
                currentMergeGroup.push(chunk);
            } else {
                // Finalize merge group if any
                if (currentMergeGroup.length > 0) {
                    if (currentMergeGroup.length === 1) {
                        merged.push(currentMergeGroup[0]);
                    } else {
                        merged.push(this.mergeChunkGroup(currentMergeGroup));
                    }
                    currentMergeGroup = [];
                }
                merged.push(chunk);
            }
        }

        // Handle remaining merge group
        if (currentMergeGroup.length > 0) {
            if (currentMergeGroup.length === 1) {
                merged.push(currentMergeGroup[0]);
            } else {
                merged.push(this.mergeChunkGroup(currentMergeGroup));
            }
        }

        return merged;
    }

    /**
     * Add relationships between chunks
     */
    addChunkRelationships(chunks) {
        return chunks.map((chunk, index) => ({
            ...chunk,
            relationships: {
                previous: index > 0 ? chunks[index - 1].id : null,
                next: index < chunks.length - 1 ? chunks[index + 1].id : null,
                sequence: index,
                total: chunks.length
            }
        }));
    }

    /**
     * Utility methods
     */
    hasStructure(content) {
        if (typeof content !== 'string') return false;
        
        // Check for structural elements
        const structurePatterns = [
            /^#{1,6}\s+/m, // Headers
            /^\s*[-*+]\s+/m, // Lists
            /```[\s\S]*?```/, // Code blocks
            /^\s*\d+\.\s+/m // Numbered lists
        ];
        
        return structurePatterns.some(pattern => pattern.test(content));
    }

    getContentSize(normalizedContent) {
        const { type, content } = normalizedContent;
        
        if (type === 'text') {
            return content.length;
        } else if (type === 'corpuscles') {
            return content.reduce((sum, c) => sum + this.estimateCorpuscleSize(c), 0);
        }
        
        return 0;
    }

    estimateCorpuscleSize(corpuscle) {
        // Estimate size based on content fields
        const content = corpuscle.content || {};
        return Object.values(content).join(' ').length;
    }

    groupCorpusclesByType(corpuscles) {
        const groups = new Map();
        
        corpuscles.forEach(corpuscle => {
            const type = corpuscle.type || 'unknown';
            if (!groups.has(type)) {
                groups.set(type, []);
            }
            groups.get(type).push(corpuscle);
        });
        
        return groups;
    }

    getDominantType(corpuscles) {
        const typeCounts = new Map();
        
        corpuscles.forEach(corpuscle => {
            const type = corpuscle.type || 'unknown';
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
        });
        
        let dominantType = 'unknown';
        let maxCount = 0;
        
        for (const [type, count] of typeCounts) {
            if (count > maxCount) {
                maxCount = count;
                dominantType = type;
            }
        }
        
        return dominantType;
    }

    splitChunk(chunk, targetSize) {
        // Simple splitting - could be enhanced with semantic boundaries
        if (typeof chunk.content !== 'string') {
            return [chunk]; // Can't split non-string content easily
        }

        const subChunks = [];
        const content = chunk.content;
        let position = 0;
        let subId = 0;

        while (position < content.length) {
            const endPos = Math.min(position + targetSize, content.length);
            const subContent = content.slice(position, endPos);
            
            subChunks.push({
                id: `${chunk.id}_sub_${subId++}`,
                content: subContent,
                position: { start: position, end: endPos },
                size: subContent.length,
                type: `${chunk.type}_split`,
                metadata: {
                    ...chunk.metadata,
                    parentChunk: chunk.id,
                    splitIndex: subId - 1
                }
            });
            
            position = endPos;
        }

        return subChunks;
    }

    mergeChunkGroup(chunkGroup) {
        const mergedContent = chunkGroup.map(c => 
            typeof c.content === 'string' ? c.content : JSON.stringify(c.content)
        ).join('\n\n');
        
        const totalSize = chunkGroup.reduce((sum, c) => sum + c.size, 0);
        
        return {
            id: `merged_${chunkGroup.map(c => c.id).join('_')}`,
            content: mergedContent,
            size: totalSize,
            type: 'merged',
            metadata: {
                strategy: 'merged',
                originalChunks: chunkGroup.map(c => c.id),
                mergedCount: chunkGroup.length
            }
        };
    }

    calculateAverageChunkSize(chunks) {
        if (chunks.length === 0) return 0;
        return chunks.reduce((sum, chunk) => sum + chunk.size, 0) / chunks.length;
    }

    validateChunks(chunks, options) {
        const maxSize = options.maxChunkSize || this.config.maxChunkSize;
        const minSize = options.minChunkSize || this.config.minChunkSize;
        
        for (const chunk of chunks) {
            if (chunk.size > maxSize) {
                console.warn(`Chunk ${chunk.id} exceeds maximum size: ${chunk.size} > ${maxSize}`);
            }
            
            if (chunk.size < minSize && chunks.length > 1) {
                console.warn(`Chunk ${chunk.id} below minimum size: ${chunk.size} < ${minSize}`);
            }
        }
    }

    updateChunkingStats(chunks) {
        this.chunkingStats.totalChunks += chunks.length;
        this.chunkingStats.chunksCreated += chunks.length;
        
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
        this.chunkingStats.avgChunkSize = totalSize / chunks.length;
    }

    getChunkingStatistics(chunks) {
        const sizes = chunks.map(c => c.size);
        const types = chunks.map(c => c.type);
        
        return {
            count: chunks.length,
            totalSize: sizes.reduce((a, b) => a + b, 0),
            avgSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
            minSize: Math.min(...sizes),
            maxSize: Math.max(...sizes),
            sizeVariance: this.calculateVariance(sizes),
            typeDistribution: this.getTypeDistribution(types)
        };
    }

    calculateVariance(numbers) {
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
    }

    getTypeDistribution(types) {
        const distribution = new Map();
        types.forEach(type => {
            distribution.set(type, (distribution.get(type) || 0) + 1);
        });
        return Object.fromEntries(distribution);
    }

    /**
     * Get available chunking strategies
     */
    getAvailableStrategies() {
        return Object.keys(this.strategies);
    }

    /**
     * Get strategy information
     */
    getStrategyInfo(strategyName) {
        return this.strategies[strategyName] ? { ...this.strategies[strategyName] } : null;
    }

    /**
     * Get chunking statistics
     */
    getStats() {
        return { ...this.chunkingStats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.chunkingStats = {
            totalChunks: 0,
            avgChunkSize: 0,
            chunksCreated: 0
        };
    }
}