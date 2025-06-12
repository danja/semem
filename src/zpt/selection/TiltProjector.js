/**
 * Generates appropriate representations based on tilt parameters
 */
export default class TiltProjector {
    constructor(options = {}) {
        this.config = {
            embeddingDimension: options.embeddingDimension || 1536,
            keywordLimit: options.keywordLimit || 20,
            minKeywordScore: options.minKeywordScore || 0.1,
            graphDepth: options.graphDepth || 3,
            temporalGranularity: options.temporalGranularity || 'day',
            includeMetadata: options.includeMetadata !== false,
            ...options
        };
        
        this.initializeProjectionStrategies();
        this.initializeOutputFormats();
    }

    /**
     * Initialize projection strategies for each tilt representation
     */
    initializeProjectionStrategies() {
        this.projectionStrategies = {
            embedding: {
                name: 'Vector Embedding Projection',
                outputType: 'vector',
                processor: this.projectToEmbedding.bind(this),
                requirements: ['embeddingHandler'],
                metadata: ['similarity', 'dimension', 'model']
            },
            keywords: {
                name: 'Keyword Extraction Projection',
                outputType: 'text',
                processor: this.projectToKeywords.bind(this),
                requirements: ['textAnalyzer'],
                metadata: ['score', 'frequency', 'tfidf']
            },
            graph: {
                name: 'Graph Structure Projection',
                outputType: 'structured',
                processor: this.projectToGraph.bind(this),
                requirements: ['graphAnalyzer'],
                metadata: ['centrality', 'connections', 'communities']
            },
            temporal: {
                name: 'Temporal Sequence Projection',
                outputType: 'sequence',
                processor: this.projectToTemporal.bind(this),
                requirements: ['temporalAnalyzer'],
                metadata: ['timestamp', 'sequence', 'duration']
            }
        };
    }

    /**
     * Initialize output format specifications
     */
    initializeOutputFormats() {
        this.outputFormats = {
            vector: {
                schema: {
                    embedding: 'number[]',
                    dimension: 'number',
                    similarity: 'number?',
                    model: 'string',
                    metadata: 'object?'
                },
                example: {
                    embedding: [0.1, -0.2, 0.3],
                    dimension: 1536,
                    similarity: 0.85,
                    model: 'nomic-embed-text'
                }
            },
            text: {
                schema: {
                    keywords: 'string[]',
                    scores: 'number[]',
                    summary: 'string?',
                    metadata: 'object?'
                },
                example: {
                    keywords: ['machine learning', 'neural networks', 'AI'],
                    scores: [0.9, 0.8, 0.7],
                    summary: 'Key concepts about machine learning and AI'
                }
            },
            structured: {
                schema: {
                    nodes: 'object[]',
                    edges: 'object[]',
                    properties: 'object?',
                    metadata: 'object?'
                },
                example: {
                    nodes: [{ id: 'entity1', type: 'Entity', label: 'Machine Learning' }],
                    edges: [{ source: 'entity1', target: 'entity2', type: 'relatedTo' }]
                }
            },
            sequence: {
                schema: {
                    events: 'object[]',
                    timeline: 'object[]',
                    duration: 'number?',
                    metadata: 'object?'
                },
                example: {
                    events: [{ timestamp: '2024-01-01', event: 'Creation', data: {} }],
                    timeline: [{ start: '2024-01-01', end: '2024-12-31' }]
                }
            }
        };
    }

    /**
     * Main projection method - transforms corpuscles based on tilt representation
     * @param {Array} corpuscles - Selected corpuscles to transform
     * @param {Object} tiltParams - Normalized tilt parameters
     * @param {Object} context - Projection context and dependencies
     * @returns {Promise<Object>} Projected representation
     */
    async project(corpuscles, tiltParams, context = {}) {
        const { representation } = tiltParams;
        const strategy = this.projectionStrategies[representation];
        
        if (!strategy) {
            throw new Error(`Unsupported tilt representation: ${representation}`);
        }

        // Validate requirements
        this.validateRequirements(strategy, context);

        try {
            // Execute projection
            const projection = await strategy.processor(corpuscles, tiltParams, context);
            
            // Enrich with metadata
            const enrichedProjection = this.enrichProjection(projection, strategy, context);
            
            // Format output
            const formattedOutput = this.formatOutput(enrichedProjection, strategy.outputType);
            
            return {
                representation,
                outputType: strategy.outputType,
                data: formattedOutput,
                metadata: {
                    corpuscleCount: corpuscles.length,
                    projectionStrategy: strategy.name,
                    timestamp: new Date().toISOString(),
                    config: this.config
                }
            };
            
        } catch (error) {
            throw new Error(`Projection failed for ${representation}: ${error.message}`);
        }
    }

    /**
     * Project corpuscles to embedding representation
     */
    async projectToEmbedding(corpuscles, tiltParams, context) {
        const { embeddingHandler } = context;
        const embeddings = [];
        const similarities = [];
        
        // Process each corpuscle
        for (const corpuscle of corpuscles) {
            let embedding = null;
            let similarity = corpuscle.similarity || 0;
            
            // Use existing embedding if available
            if (corpuscle.metadata.embedding) {
                embedding = corpuscle.metadata.embedding;
            } else {
                // Generate embedding from content
                const content = this.extractTextContent(corpuscle);
                if (content) {
                    embedding = await embeddingHandler.generateEmbedding(content);
                }
            }
            
            if (embedding) {
                embeddings.push({
                    uri: corpuscle.uri,
                    embedding,
                    similarity,
                    dimension: embedding.length,
                    source: corpuscle.metadata.embedding ? 'cached' : 'generated'
                });
                similarities.push(similarity);
            }
        }

        // Calculate aggregate statistics
        const avgSimilarity = similarities.length > 0 ? 
            similarities.reduce((a, b) => a + b, 0) / similarities.length : 0;

        return {
            embeddings,
            aggregateStats: {
                count: embeddings.length,
                avgSimilarity,
                dimension: this.config.embeddingDimension,
                model: embeddingHandler.model || 'unknown'
            },
            centroid: this.calculateCentroid(embeddings.map(e => e.embedding))
        };
    }

    /**
     * Project corpuscles to keyword representation
     */
    async projectToKeywords(corpuscles, tiltParams, context) {
        const allKeywords = new Map(); // keyword -> { score, frequency, sources }
        const corpuscleKeywords = [];

        // Extract keywords from each corpuscle
        for (const corpuscle of corpuscles) {
            const content = this.extractTextContent(corpuscle);
            if (!content) continue;

            const keywords = this.extractKeywords(content);
            const scoredKeywords = this.scoreKeywords(keywords, content);
            
            corpuscleKeywords.push({
                uri: corpuscle.uri,
                keywords: scoredKeywords,
                content: content.substring(0, 200) + '...'
            });

            // Aggregate keywords globally
            scoredKeywords.forEach(({ keyword, score }) => {
                if (allKeywords.has(keyword)) {
                    const existing = allKeywords.get(keyword);
                    existing.score = Math.max(existing.score, score);
                    existing.frequency += 1;
                    existing.sources.push(corpuscle.uri);
                } else {
                    allKeywords.set(keyword, {
                        score,
                        frequency: 1,
                        sources: [corpuscle.uri]
                    });
                }
            });
        }

        // Convert to sorted arrays
        const globalKeywords = Array.from(allKeywords.entries())
            .map(([keyword, data]) => ({ keyword, ...data }))
            .sort((a, b) => b.score - a.score)
            .slice(0, this.config.keywordLimit);

        // Generate summary
        const topKeywords = globalKeywords.slice(0, 10).map(k => k.keyword);
        const summary = this.generateKeywordSummary(topKeywords);

        return {
            globalKeywords,
            corpuscleKeywords,
            summary,
            stats: {
                totalKeywords: allKeywords.size,
                avgKeywordsPerCorpuscle: corpuscleKeywords.length > 0 ?
                    corpuscleKeywords.reduce((sum, c) => sum + c.keywords.length, 0) / corpuscleKeywords.length : 0,
                coverageScore: this.calculateKeywordCoverage(globalKeywords, corpuscleKeywords)
            }
        };
    }

    /**
     * Project corpuscles to graph representation
     */
    async projectToGraph(corpuscles, tiltParams, context) {
        const nodes = new Map(); // uri -> node
        const edges = [];
        const nodeMetrics = new Map(); // uri -> metrics

        // Build nodes from corpuscles
        for (const corpuscle of corpuscles) {
            const nodeId = corpuscle.uri;
            const node = {
                id: nodeId,
                type: corpuscle.type,
                label: this.extractLabel(corpuscle),
                properties: this.extractNodeProperties(corpuscle),
                score: corpuscle.score || 0
            };
            
            nodes.set(nodeId, node);
        }

        // Extract relationships and build edges
        for (const corpuscle of corpuscles) {
            const relationships = this.extractRelationships(corpuscle);
            
            relationships.forEach(rel => {
                if (nodes.has(rel.target)) {
                    edges.push({
                        id: `${corpuscle.uri}-${rel.type}-${rel.target}`,
                        source: corpuscle.uri,
                        target: rel.target,
                        type: rel.type,
                        weight: rel.weight || 1,
                        properties: rel.properties || {}
                    });
                }
            });
        }

        // Calculate graph metrics
        for (const [nodeId, node] of nodes) {
            const metrics = this.calculateNodeMetrics(nodeId, edges);
            nodeMetrics.set(nodeId, metrics);
            node.metrics = metrics;
        }

        // Detect communities
        const communities = this.detectCommunities(Array.from(nodes.values()), edges);

        // Calculate graph statistics
        const graphStats = this.calculateGraphStatistics(nodes, edges);

        return {
            nodes: Array.from(nodes.values()),
            edges,
            communities,
            metrics: {
                nodeCount: nodes.size,
                edgeCount: edges.length,
                density: edges.length / (nodes.size * (nodes.size - 1)),
                avgDegree: graphStats.avgDegree,
                clusteringCoefficient: graphStats.clusteringCoefficient
            },
            layout: this.generateLayoutHints(Array.from(nodes.values()), edges)
        };
    }

    /**
     * Project corpuscles to temporal representation
     */
    async projectToTemporal(corpuscles, tiltParams, context) {
        const events = [];
        const timeline = [];
        const temporalBuckets = new Map(); // time bucket -> corpuscles

        // Extract temporal information from corpuscles
        for (const corpuscle of corpuscles) {
            const temporalData = this.extractTemporalData(corpuscle);
            
            if (temporalData.timestamp) {
                const event = {
                    id: corpuscle.uri,
                    timestamp: temporalData.timestamp,
                    type: corpuscle.type,
                    label: this.extractLabel(corpuscle),
                    data: temporalData.data,
                    score: corpuscle.score || 0
                };
                
                events.push(event);

                // Group into temporal buckets
                const bucket = this.getTemporalBucket(temporalData.timestamp);
                if (!temporalBuckets.has(bucket)) {
                    temporalBuckets.set(bucket, []);
                }
                temporalBuckets.get(bucket).push(corpuscle);
            }
        }

        // Sort events by timestamp
        events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Create timeline from buckets
        for (const [bucket, corpuscles] of temporalBuckets) {
            const [start, end] = this.getBucketRange(bucket);
            timeline.push({
                period: bucket,
                start,
                end,
                count: corpuscles.length,
                avgScore: corpuscles.reduce((sum, c) => sum + (c.score || 0), 0) / corpuscles.length,
                types: [...new Set(corpuscles.map(c => c.type))]
            });
        }

        // Sort timeline
        timeline.sort((a, b) => new Date(a.start) - new Date(b.start));

        // Calculate temporal statistics
        const duration = this.calculateTemporalDuration(events);
        const frequency = this.calculateEventFrequency(events);

        return {
            events,
            timeline,
            sequences: this.detectTemporalSequences(events),
            stats: {
                eventCount: events.length,
                timelineSpan: timeline.length,
                duration,
                frequency,
                granularity: this.config.temporalGranularity
            },
            patterns: this.detectTemporalPatterns(events, timeline)
        };
    }

    /**
     * Helper methods for content extraction
     */
    extractTextContent(corpuscle) {
        const content = corpuscle.content || {};
        return [
            content.text,
            content.content,
            content.label,
            content.prefLabel,
            content.description
        ].filter(Boolean).join(' ');
    }

    extractLabel(corpuscle) {
        const content = corpuscle.content || {};
        return content.prefLabel || content.label || content.text?.substring(0, 50) || corpuscle.uri;
    }

    extractNodeProperties(corpuscle) {
        return {
            type: corpuscle.type,
            score: corpuscle.score,
            created: corpuscle.metadata.created,
            source: corpuscle.metadata.source
        };
    }

    extractRelationships(corpuscle) {
        // Extract relationships from corpuscle binding data
        const relationships = [];
        const binding = corpuscle.binding || {};
        
        if (binding.entity?.value) {
            relationships.push({
                target: binding.entity.value,
                type: 'relatedTo',
                weight: 1
            });
        }
        
        if (binding.unit?.value) {
            relationships.push({
                target: binding.unit.value,
                type: 'partOf',
                weight: 0.8
            });
        }
        
        return relationships;
    }

    extractTemporalData(corpuscle) {
        const metadata = corpuscle.metadata || {};
        const binding = corpuscle.binding || {};
        
        return {
            timestamp: metadata.created || binding.created?.value,
            modified: metadata.modified || binding.modified?.value,
            data: {
                type: corpuscle.type,
                score: corpuscle.score
            }
        };
    }

    /**
     * Analysis and processing methods
     */
    extractKeywords(text) {
        // Simple keyword extraction - could be enhanced with NLP
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        // Remove common stop words
        const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'been', 'from', 'they', 'them', 'were', 'said', 'each', 'which', 'their', 'time', 'more', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were']);
        
        return words.filter(word => !stopWords.has(word));
    }

    scoreKeywords(keywords, text) {
        const wordFreq = new Map();
        const totalWords = keywords.length;
        
        // Calculate frequency
        keywords.forEach(word => {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        });
        
        // Score keywords by frequency and position
        return Array.from(wordFreq.entries())
            .map(([keyword, freq]) => ({
                keyword,
                score: (freq / totalWords) * (1 + (text.toLowerCase().indexOf(keyword) === -1 ? 0 : 0.1)),
                frequency: freq
            }))
            .filter(k => k.score >= this.config.minKeywordScore)
            .sort((a, b) => b.score - a.score);
    }

    generateKeywordSummary(topKeywords) {
        if (topKeywords.length === 0) return 'No keywords extracted';
        
        const summary = `Key topics include: ${topKeywords.slice(0, 5).join(', ')}`;
        return summary + (topKeywords.length > 5 ? ' and others.' : '.');
    }

    calculateKeywordCoverage(globalKeywords, corpuscleKeywords) {
        const topGlobalKeywords = new Set(globalKeywords.slice(0, 10).map(k => k.keyword));
        let totalCoverage = 0;
        
        corpuscleKeywords.forEach(corpuscle => {
            const corpuscleKeywordSet = new Set(corpuscle.keywords.map(k => k.keyword));
            const intersection = new Set([...topGlobalKeywords].filter(k => corpuscleKeywordSet.has(k)));
            totalCoverage += intersection.size / topGlobalKeywords.size;
        });
        
        return corpuscleKeywords.length > 0 ? totalCoverage / corpuscleKeywords.length : 0;
    }

    calculateNodeMetrics(nodeId, edges) {
        const inEdges = edges.filter(e => e.target === nodeId);
        const outEdges = edges.filter(e => e.source === nodeId);
        const totalEdges = inEdges.length + outEdges.length;
        
        return {
            inDegree: inEdges.length,
            outDegree: outEdges.length,
            degree: totalEdges,
            centrality: totalEdges / Math.max(1, edges.length), // Simplified centrality
            clustering: this.calculateClusteringCoefficient(nodeId, edges)
        };
    }

    calculateClusteringCoefficient(nodeId, edges) {
        // Simplified clustering coefficient calculation
        const neighbors = new Set();
        edges.forEach(edge => {
            if (edge.source === nodeId) neighbors.add(edge.target);
            if (edge.target === nodeId) neighbors.add(edge.source);
        });
        
        if (neighbors.size < 2) return 0;
        
        let neighborConnections = 0;
        const neighborArray = Array.from(neighbors);
        
        for (let i = 0; i < neighborArray.length; i++) {
            for (let j = i + 1; j < neighborArray.length; j++) {
                if (edges.some(e => 
                    (e.source === neighborArray[i] && e.target === neighborArray[j]) ||
                    (e.source === neighborArray[j] && e.target === neighborArray[i])
                )) {
                    neighborConnections++;
                }
            }
        }
        
        const maxPossibleConnections = neighbors.size * (neighbors.size - 1) / 2;
        return maxPossibleConnections > 0 ? neighborConnections / maxPossibleConnections : 0;
    }

    detectCommunities(nodes, edges) {
        // Simple community detection based on connected components
        const communities = [];
        const visited = new Set();
        
        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                const community = this.findConnectedComponent(node.id, edges, visited);
                if (community.length > 1) {
                    communities.push({
                        id: `community_${communities.length}`,
                        members: community,
                        size: community.length
                    });
                }
            }
        });
        
        return communities;
    }

    findConnectedComponent(startNode, edges, visited) {
        const component = [];
        const queue = [startNode];
        
        while (queue.length > 0) {
            const node = queue.shift();
            if (visited.has(node)) continue;
            
            visited.add(node);
            component.push(node);
            
            // Find neighbors
            edges.forEach(edge => {
                if (edge.source === node && !visited.has(edge.target)) {
                    queue.push(edge.target);
                }
                if (edge.target === node && !visited.has(edge.source)) {
                    queue.push(edge.source);
                }
            });
        }
        
        return component;
    }

    calculateGraphStatistics(nodes, edges) {
        const nodeCount = nodes.size;
        const edgeCount = edges.length;
        
        let totalDegree = 0;
        let totalClustering = 0;
        
        for (const [nodeId, node] of nodes) {
            if (node.metrics) {
                totalDegree += node.metrics.degree;
                totalClustering += node.metrics.clustering;
            }
        }
        
        return {
            avgDegree: nodeCount > 0 ? totalDegree / nodeCount : 0,
            clusteringCoefficient: nodeCount > 0 ? totalClustering / nodeCount : 0
        };
    }

    generateLayoutHints(nodes, edges) {
        // Generate layout hints for graph visualization
        return {
            algorithm: 'force-directed',
            parameters: {
                attraction: 0.1,
                repulsion: 100,
                iterations: 100
            },
            clusters: nodes.length > 20 ? 'detect' : 'none',
            nodeSize: 'score',
            edgeWidth: 'weight'
        };
    }

    getTemporalBucket(timestamp) {
        const date = new Date(timestamp);
        const granularity = this.config.temporalGranularity;
        
        switch (granularity) {
            case 'year':
                return date.getFullYear().toString();
            case 'month':
                return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            case 'day':
                return date.toISOString().split('T')[0];
            case 'hour':
                return `${date.toISOString().split('T')[0]}T${date.getHours().toString().padStart(2, '0')}`;
            default:
                return date.toISOString().split('T')[0];
        }
    }

    getBucketRange(bucket) {
        const granularity = this.config.temporalGranularity;
        
        switch (granularity) {
            case 'year':
                return [`${bucket}-01-01T00:00:00Z`, `${bucket}-12-31T23:59:59Z`];
            case 'month':
                const [year, month] = bucket.split('-');
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                return [`${bucket}-01T00:00:00Z`, `${bucket}-${lastDay}T23:59:59Z`];
            case 'day':
                return [`${bucket}T00:00:00Z`, `${bucket}T23:59:59Z`];
            case 'hour':
                return [`${bucket}:00:00Z`, `${bucket}:59:59Z`];
            default:
                return [`${bucket}T00:00:00Z`, `${bucket}T23:59:59Z`];
        }
    }

    detectTemporalSequences(events) {
        // Detect sequences of related events
        const sequences = [];
        const sortedEvents = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        let currentSequence = [];
        let lastTimestamp = null;
        const maxGap = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        for (const event of sortedEvents) {
            const currentTimestamp = new Date(event.timestamp).getTime();
            
            if (lastTimestamp && currentTimestamp - lastTimestamp > maxGap) {
                if (currentSequence.length > 1) {
                    sequences.push({
                        id: `sequence_${sequences.length}`,
                        events: [...currentSequence],
                        duration: currentSequence[currentSequence.length - 1].timestamp - currentSequence[0].timestamp
                    });
                }
                currentSequence = [];
            }
            
            currentSequence.push(event);
            lastTimestamp = currentTimestamp;
        }
        
        if (currentSequence.length > 1) {
            sequences.push({
                id: `sequence_${sequences.length}`,
                events: currentSequence,
                duration: new Date(currentSequence[currentSequence.length - 1].timestamp) - 
                         new Date(currentSequence[0].timestamp)
            });
        }
        
        return sequences;
    }

    calculateTemporalDuration(events) {
        if (events.length < 2) return 0;
        
        const timestamps = events.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
        return timestamps[timestamps.length - 1] - timestamps[0];
    }

    calculateEventFrequency(events) {
        if (events.length < 2) return 0;
        
        const duration = this.calculateTemporalDuration(events);
        return duration > 0 ? events.length / (duration / (24 * 60 * 60 * 1000)) : 0; // events per day
    }

    detectTemporalPatterns(events, timeline) {
        // Detect patterns in temporal data
        const patterns = [];
        
        // Detect periodic patterns
        const periods = this.detectPeriodicPatterns(timeline);
        if (periods.length > 0) {
            patterns.push({
                type: 'periodic',
                description: 'Regular temporal patterns detected',
                periods
            });
        }
        
        // Detect bursts
        const bursts = this.detectBurstPatterns(events);
        if (bursts.length > 0) {
            patterns.push({
                type: 'burst',
                description: 'Event burst patterns detected',
                bursts
            });
        }
        
        return patterns;
    }

    detectPeriodicPatterns(timeline) {
        // Simple periodic pattern detection
        if (timeline.length < 3) return [];
        
        const intervals = [];
        for (let i = 1; i < timeline.length; i++) {
            const interval = new Date(timeline[i].start) - new Date(timeline[i-1].start);
            intervals.push(interval);
        }
        
        // Check for regular intervals
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev / avgInterval < 0.2) { // Low relative standard deviation indicates regularity
            return [{
                interval: avgInterval,
                confidence: 1 - (stdDev / avgInterval),
                description: `Regular interval of ${Math.round(avgInterval / (24 * 60 * 60 * 1000))} days`
            }];
        }
        
        return [];
    }

    detectBurstPatterns(events) {
        // Detect event bursts (periods of high activity)
        const bursts = [];
        const sortedEvents = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        let currentBurst = [];
        let lastTimestamp = null;
        const burstThreshold = 3; // Minimum events for a burst
        const burstWindow = 60 * 60 * 1000; // 1 hour window
        
        for (const event of sortedEvents) {
            const currentTimestamp = new Date(event.timestamp).getTime();
            
            if (lastTimestamp && currentTimestamp - lastTimestamp <= burstWindow) {
                currentBurst.push(event);
            } else {
                if (currentBurst.length >= burstThreshold) {
                    bursts.push({
                        start: currentBurst[0].timestamp,
                        end: currentBurst[currentBurst.length - 1].timestamp,
                        eventCount: currentBurst.length,
                        intensity: currentBurst.length / burstWindow * (60 * 60 * 1000) // events per hour
                    });
                }
                currentBurst = [event];
            }
            
            lastTimestamp = currentTimestamp;
        }
        
        if (currentBurst.length >= burstThreshold) {
            bursts.push({
                start: currentBurst[0].timestamp,
                end: currentBurst[currentBurst.length - 1].timestamp,
                eventCount: currentBurst.length,
                intensity: currentBurst.length / burstWindow * (60 * 60 * 1000)
            });
        }
        
        return bursts;
    }

    /**
     * Utility methods
     */
    calculateCentroid(embeddings) {
        if (embeddings.length === 0) return null;
        
        const dimension = embeddings[0].length;
        const centroid = new Array(dimension).fill(0);
        
        embeddings.forEach(embedding => {
            embedding.forEach((value, index) => {
                centroid[index] += value;
            });
        });
        
        return centroid.map(value => value / embeddings.length);
    }

    validateRequirements(strategy, context) {
        const missing = strategy.requirements.filter(req => !context[req]);
        if (missing.length > 0) {
            throw new Error(`Missing required dependencies for ${strategy.name}: ${missing.join(', ')}`);
        }
    }

    enrichProjection(projection, strategy, context) {
        if (!this.config.includeMetadata) return projection;
        
        return {
            ...projection,
            enrichment: {
                strategy: strategy.name,
                outputType: strategy.outputType,
                requiredMetadata: strategy.metadata,
                processingTime: Date.now(),
                config: this.config
            }
        };
    }

    formatOutput(projection, outputType) {
        const format = this.outputFormats[outputType];
        if (!format) return projection;
        
        // Validate against schema (simplified validation)
        return this.validateAndFormat(projection, format);
    }

    validateAndFormat(data, format) {
        // Simplified validation and formatting
        // In a full implementation, would use JSON Schema validation
        return data;
    }

    /**
     * Get projection documentation
     */
    getProjectionDocumentation() {
        return {
            strategies: Object.entries(this.projectionStrategies).map(([key, strategy]) => ({
                name: key,
                description: strategy.name,
                outputType: strategy.outputType,
                requirements: strategy.requirements,
                metadata: strategy.metadata
            })),
            outputFormats: this.outputFormats,
            config: this.config
        };
    }
}