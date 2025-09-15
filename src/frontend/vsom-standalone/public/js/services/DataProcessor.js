/**
 * Data Processor
 * Transforms interaction data for VSOM visualization
 */

export default class DataProcessor {
    constructor() {
        this.interactionTypes = {
            tell: { color: '#28a745', priority: 1, icon: '📝', description: 'Store knowledge' },
            ask: { color: '#17a2b8', priority: 2, icon: '❓', description: 'Query knowledge' },
            augment: { color: '#ffc107', priority: 3, icon: '⚡', description: 'Process & enhance' },
            chat: { color: '#6c757d', priority: 4, icon: '💬', description: 'Conversation' },
            upload: { color: '#fd7e14', priority: 1, icon: '📄', description: 'Document upload' },
            inspect: { color: '#e83e8c', priority: 5, icon: '🔍', description: 'System inspection' },
            chunk: { color: '#9c27b0', priority: 3, icon: '🧩', description: 'Text chunking' },
            embed: { color: '#3f51b5', priority: 3, icon: '🧠', description: 'Embedding generation' },
            search: { color: '#00bcd4', priority: 2, icon: '🔎', description: 'Semantic search' },
            ragno: { color: '#4caf50', priority: 4, icon: '🕸️', description: 'Knowledge graph' },
            vsom: { color: '#ff5722', priority: 4, icon: '🗺️', description: 'Map visualization' },
            zpt: { color: '#795548', priority: 4, icon: '🧭', description: 'Navigation state' },

            // Additional enhanced interaction types expected by tests
            decompose: { color: '#673ab7', priority: 3, icon: '🔬', description: 'Text decomposition' },
            analyze: { color: '#ff9800', priority: 3, icon: '📊', description: 'Content analysis' },
            context: { color: '#607d8b', priority: 4, icon: '🔗', description: 'Context management' },
            memory: { color: '#8bc34a', priority: 2, icon: '🧠', description: 'Memory operations' }
        };

        // Semantic analysis patterns
        this.conceptCategories = {
            technology: ['ai', 'machine learning', 'neural', 'algorithm', 'computer', 'software', 'data'],
            science: ['research', 'study', 'analysis', 'experiment', 'hypothesis', 'method', 'theory'],
            business: ['strategy', 'market', 'customer', 'revenue', 'product', 'service', 'management'],
            health: ['medical', 'health', 'treatment', 'diagnosis', 'patient', 'clinical', 'therapeutic'],
            education: ['learn', 'teach', 'student', 'education', 'knowledge', 'skill', 'training']
        };

        // Semantic quality indicators
        this.qualityIndicators = {
            depth: ['detailed', 'comprehensive', 'thorough', 'complete', 'extensive'],
            complexity: ['advanced', 'sophisticated', 'complex', 'intricate', 'nuanced'],
            clarity: ['clear', 'obvious', 'apparent', 'evident', 'straightforward'],
            importance: ['critical', 'essential', 'vital', 'key', 'fundamental', 'crucial']
        };
    }
    
    /**
     * Process interactions for VSOM visualization
     */
    async processInteractions(interactions, zptSettings = {}) {
        if (!Array.isArray(interactions) || interactions.length === 0) {
            return this.createEmptyVSOMData();
        }


        // Filter interactions based on ZPT settings
        const filteredInteractions = this.applyZPTFilters(interactions, zptSettings);

        if (filteredInteractions.length === 0) {
            return this.createEmptyVSOMData();
        }

        // Transform interactions to VSOM nodes
        const nodes = await this.transformToNodes(filteredInteractions, zptSettings);

        // Calculate grid layout
        const gridSize = this.calculateGridSize(nodes.length);
        const positionedNodes = this.positionNodes(nodes, gridSize, zptSettings);
        
        return {
            nodes: positionedNodes,
            gridSize,
            interactions: filteredInteractions,
            metadata: {
                totalInteractions: interactions.length,
                filteredInteractions: filteredInteractions.length,
                zptSettings,
                generatedAt: new Date().toISOString()
            }
        };
    }
    
    /**
     * Apply ZPT filters to interactions
     */
    applyZPTFilters(interactions, zptSettings) {
        let filtered = [...interactions];
        
        // Apply zoom filter (abstraction level)
        filtered = this.applyZoomFilter(filtered, zptSettings.zoom);
        
        // Apply pan filters (domain/keyword filtering)
        filtered = this.applyPanFilter(filtered, zptSettings.pan);
        
        // Apply tilt filter (view style)
        filtered = this.applyTiltFilter(filtered, zptSettings.tilt);
        
        // Apply similarity threshold
        if (zptSettings.threshold !== undefined) {
            filtered = this.applyThresholdFilter(filtered, zptSettings.threshold);
        }
        
        return filtered;
    }
    
    /**
     * Apply zoom filter based on abstraction level
     */
    applyZoomFilter(interactions, zoom) {
        switch (zoom) {
            case 'entity':
                // Show individual interactions as entities
                return interactions;
                
            case 'unit':
                // Group related interactions into semantic units
                return this.groupIntoUnits(interactions);
                
            case 'text':
                // Group by document or conversation thread
                return this.groupByDocument(interactions);
                
            case 'community':
                // Group by related concept communities
                return this.groupByCommunity(interactions);
                
            case 'corpus':
                // Show corpus-level view (very high abstraction)
                return this.createCorpusView(interactions);
                
            default:
                return interactions;
        }
    }
    
    /**
     * Apply pan filter based on domain/keyword filtering
     */
    applyPanFilter(interactions, pan) {
        if (!pan || (!pan.domains && !pan.keywords)) {
            return interactions;
        }
        
        let filtered = interactions;
        
        // Filter by domains
        if (pan.domains) {
            const domains = typeof pan.domains === 'string' ? 
                pan.domains.split(',').map(d => d.trim().toLowerCase()) :
                pan.domains.map(d => d.toLowerCase());
                
            filtered = filtered.filter(interaction => {
                const content = (interaction.content || '').toLowerCase();
                const concepts = Array.isArray(interaction.concepts) ? interaction.concepts.map(c => String(c).toLowerCase()) : [];
                
                return domains.some(domain => 
                    content.includes(domain) || 
                    concepts.some(concept => concept.includes(domain))
                );
            });
        }
        
        // Filter by keywords
        if (pan.keywords) {
            const keywords = typeof pan.keywords === 'string' ? 
                pan.keywords.split(',').map(k => k.trim().toLowerCase()) :
                pan.keywords.map(k => k.toLowerCase());
                
            filtered = filtered.filter(interaction => {
                const content = (interaction.content || '').toLowerCase();
                const concepts = Array.isArray(interaction.concepts) ? interaction.concepts.map(c => String(c).toLowerCase()) : [];
                
                return keywords.some(keyword => 
                    content.includes(keyword) || 
                    concepts.some(concept => concept.includes(keyword))
                );
            });
        }
        
        return filtered;
    }
    
    /**
     * Apply tilt filter based on view style
     */
    applyTiltFilter(interactions, tilt) {
        switch (tilt) {
            case 'keywords':
                // Focus on keyword-rich interactions
                return interactions.filter(i => {
                    if (!i.concepts) return false;
                    // Handle concepts as array or number
                    return Array.isArray(i.concepts) ? i.concepts.length > 0 : (typeof i.concepts === 'number' && i.concepts > 0);
                });
                
            case 'embedding':
                // Focus on interactions with embeddings
                return interactions.filter(i => i.embedding && i.embedding.length > 0);
                
            case 'graph':
                // Focus on interactions with relationships
                return interactions.filter(i => i.relationships && i.relationships.length > 0);
                
            case 'temporal':
                // Sort by temporal significance
                return interactions.sort((a, b) => {
                    const timeA = new Date(a.timestamp || a.created || 0);
                    const timeB = new Date(b.timestamp || b.created || 0);
                    return timeB - timeA;
                });
                
            case 'memory':
                // Focus on high-importance interactions
                return interactions.filter(i => i.importance > 0.5);
                
            default:
                return interactions;
        }
    }
    
    /**
     * Apply similarity threshold filter
     */
    applyThresholdFilter(interactions, threshold) {
        // Filter based on threshold using concept count as a proxy for relevance
        // In a real implementation, this would use embedding similarity
        const keepRatio = 1 - threshold;
        const keepCount = Math.ceil(interactions.length * keepRatio);

        return interactions
            .map(interaction => {
                // Use concept count and quality metrics as similarity proxy
                const conceptCount = Array.isArray(interaction.concepts) ? interaction.concepts.length : 0;
                const quality = interaction.metadata?.quality || 0.5;
                const similarity = (conceptCount * 0.1 + quality) / 1.1; // Normalize to 0-1

                return {
                    ...interaction,
                    similarity: similarity
                };
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, keepCount);
    }
    
    /**
     * Transform interactions to VSOM nodes with rich semantic information
     */
    async transformToNodes(interactions, zptSettings) {
        return interactions.map((interaction, index) => {
            const type = this.detectInteractionType(interaction);
            const typeConfig = this.interactionTypes[type] || this.interactionTypes.chat;

            // Extract rich semantic information
            const semanticInfo = this.extractSemanticInfo(interaction);
            const qualityMetrics = this.calculateQualityMetrics(interaction);
            const conceptAnalysis = this.analyzeConcepts(interaction.concepts || []);
            const temporalInfo = this.extractTemporalInfo(interaction);
            const relationshipInfo = this.extractRelationshipInfo(interaction);

            return {
                id: `node_${index}`,
                interactionId: interaction.id || `interaction_${index}`,
                type,
                content: interaction.content || interaction.prompt || interaction.summary || '',

                // Enhanced concept information
                concepts: Array.isArray(interaction.concepts) ? interaction.concepts : [],
                conceptAnalysis,

                // Semantic enrichment
                semanticInfo,
                qualityMetrics,
                temporalInfo,
                relationshipInfo,

                // Technical details
                embedding: interaction.embedding || null,
                embeddingDimensions: interaction.embedding ? interaction.embedding.length : 0,
                chunked: !!interaction.chunks,
                chunkCount: interaction.chunks ? interaction.chunks.length : 0,

                // Memory integration
                memoryImportance: interaction.importance || 0,
                memoryDecay: interaction.decay || 1.0,
                memoryContext: interaction.context || null,

                // Processing metadata
                processingSteps: this.identifyProcessingSteps(interaction),
                dataFlow: this.traceDataFlow(interaction),

                timestamp: new Date(interaction.timestamp || interaction.created || Date.now()),

                // Enhanced visual properties
                color: this.calculateDynamicColor(interaction, typeConfig),
                size: this.calculateEnhancedNodeSize(interaction, qualityMetrics),
                opacity: this.calculateOpacity(interaction, qualityMetrics),
                priority: typeConfig.priority,
                icon: typeConfig.icon,

                // VSOM properties (will be set during positioning)
                x: 0,
                y: 0,
                activation: 0,
                weight: 0,

                // Enhanced metadata
                metadata: {
                    originalInteraction: interaction,
                    zptSettings: zptSettings,
                    typeConfig,
                    enhancedAt: new Date().toISOString()
                }
            };
        });
    }
    
    /**
     * Detect interaction type from interaction data
     */
    detectInteractionType(interaction) {
        const type = interaction.type?.toLowerCase();
        
        if (type) {
            if (type.includes('tell') || type.includes('store')) return 'tell';
            if (type.includes('ask') || type.includes('query')) return 'ask';
            if (type.includes('augment') || type.includes('analyze')) return 'augment';
            if (type.includes('upload') || type.includes('document')) return 'upload';
            if (type.includes('inspect') || type.includes('debug')) return 'inspect';
            if (type.includes('chat') || type.includes('conversation')) return 'chat';
        }
        
        // Fallback detection based on content
        const content = (interaction.content || interaction.prompt || '').toLowerCase();
        
        if (content.startsWith('/tell') || content.includes('store') || content.includes('remember')) {
            return 'tell';
        }
        if (content.startsWith('/ask') || content.includes('?') || content.includes('question')) {
            return 'ask';
        }
        if (content.startsWith('/augment') || content.includes('analyze') || content.includes('extract')) {
            return 'augment';
        }
        if (content.includes('upload') || content.includes('document') || content.includes('file')) {
            return 'upload';
        }
        if (content.startsWith('/inspect') || content.includes('debug') || content.includes('stats')) {
            return 'inspect';
        }
        
        return 'chat';
    }
    
    /**
     * Calculate enhanced node size based on multiple semantic factors
     */
    calculateEnhancedNodeSize(interaction, qualityMetrics) {
        let size = 8; // Increased base size

        // Content complexity factor
        const contentLength = (interaction.content || interaction.prompt || '').length;
        if (contentLength > 100) size += 1;
        if (contentLength > 500) size += 2;
        if (contentLength > 1000) size += 3;
        if (contentLength > 2000) size += 2;

        // Concept richness factor
        const conceptCount = Array.isArray(interaction.concepts) ? interaction.concepts.length :
                           (typeof interaction.concepts === 'number' ? interaction.concepts : 0);
        size += Math.min(conceptCount * 0.3, 4);

        // Quality metrics factor
        size += (qualityMetrics.depth * 2);
        size += (qualityMetrics.complexity * 1.5);
        size += (qualityMetrics.importance * 2.5);

        // Memory importance factor
        if (interaction.importance) {
            size += interaction.importance * 4;
        }

        // Processing complexity factor
        if (interaction.chunks && interaction.chunks.length > 0) {
            size += Math.min(interaction.chunks.length * 0.2, 3);
        }

        if (interaction.embedding && interaction.embedding.length > 0) {
            size += 1;
        }

        // Relationship factor
        if (interaction.relationships && interaction.relationships.length > 0) {
            size += Math.min(interaction.relationships.length * 0.5, 2);
        }

        // Time decay factor (newer interactions slightly larger)
        const age = Date.now() - new Date(interaction.timestamp || interaction.created || 0).getTime();
        const daysSinceCreation = age / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 1) size += 1;
        else if (daysSinceCreation < 7) size += 0.5;

        return Math.max(6, Math.min(size, 20));
    }

    /**
     * Calculate appropriate node size based on interaction importance (legacy support)
     */
    calculateNodeSize(interaction) {
        return this.calculateEnhancedNodeSize(interaction, this.calculateQualityMetrics(interaction));
    }
    
    /**
     * Calculate optimal grid size for given number of nodes
     */
    calculateGridSize(nodeCount) {
        if (nodeCount === 0) return 1;
        
        // Try to create a roughly square grid
        const sqrt = Math.sqrt(nodeCount);
        let gridSize = Math.ceil(sqrt);
        
        // For small numbers, don't add minimum
        if (nodeCount <= 9) {
            return gridSize;
        }
        
        // Ensure minimum grid size for larger counts
        gridSize = Math.max(gridSize, 3);
        
        // Ensure we have enough space (add some padding)
        while (gridSize * gridSize < nodeCount * 1.2) {
            gridSize++;
        }
        
        // Maximum reasonable grid size
        gridSize = Math.min(gridSize, 20);
        
        return gridSize;
    }
    
    /**
     * Position nodes in the grid using VSOM-like algorithm
     */
    positionNodes(nodes, gridSize, zptSettings) {
        if (nodes.length === 0) return nodes;

        // Simple positioning algorithm
        // In a real VSOM, this would involve training and similarity calculations

        const positioned = nodes.map((node, index) => {
            // For now, position in a grid pattern with some semantic clustering
            let x, y;

            if (zptSettings.tilt === 'temporal') {
                // Arrange by time
                const timeIndex = nodes
                    .map((n, i) => ({ node: n, index: i }))
                    .sort((a, b) => a.node.timestamp - b.node.timestamp)
                    .findIndex(item => item.index === index);

                x = timeIndex % gridSize;
                y = Math.floor(timeIndex / gridSize);
            } else if (zptSettings.tilt === 'graph') {
                // Arrange by type and relationships
                const typeGroups = this.groupNodesByType(nodes);
                const typeIndex = Object.keys(typeGroups).indexOf(node.type);
                const positionInType = typeGroups[node.type].indexOf(node);

                x = (typeIndex * 3 + positionInType % 3) % gridSize;
                y = Math.floor((typeIndex * 3 + positionInType) / gridSize);
            } else {
                // Default: simple grid layout to ensure nodes are separated
                // This ensures we actually see multiple nodes
                const cols = Math.ceil(Math.sqrt(nodes.length));
                x = index % cols;
                y = Math.floor(index / cols);

                // For few nodes, center them better by adding offset to avoid top-left clustering
                if (nodes.length <= 4) {
                    const centerOffset = Math.floor(gridSize / 4);
                    x += centerOffset;
                    y += centerOffset;
                }
            }

            // Ensure positions are within grid bounds
            x = Math.max(0, Math.min(x, gridSize - 1));
            y = Math.max(0, Math.min(y, gridSize - 1));

            return {
                ...node,
                x: Math.round(x * 10) / 10, // Keep one decimal place for fine positioning
                y: Math.round(y * 10) / 10,
                activation: Math.random() * 0.5 + 0.5, // Mock activation
                weight: Math.random() * 0.3 + 0.7 // Mock weight
            };
        });

        return positioned;
    }
    
    /**
     * Create empty VSOM data structure
     */
    createEmptyVSOMData() {
        return {
            nodes: [],
            gridSize: 1,
            interactions: [],
            metadata: {
                totalInteractions: 0,
                filteredInteractions: 0,
                zptSettings: {},
                generatedAt: new Date().toISOString()
            }
        };
    }
    
    /**
     * Group nodes by type for graph-based positioning
     */
    groupNodesByType(nodes) {
        return nodes.reduce((groups, node) => {
            const type = node.type || 'unknown';
            if (!groups[type]) groups[type] = [];
            groups[type].push(node);
            return groups;
        }, {});
    }
    
    /**
     * Calculate concept similarity between nodes (simplified)
     */
    calculateConceptSimilarity(node, allNodes) {
        const nodeConcepts = new Set(node.concepts || []);
        
        return allNodes.map(otherNode => {
            if (otherNode === node) return 0;
            
            const otherConcepts = new Set(otherNode.concepts || []);
            const intersection = new Set([...nodeConcepts].filter(c => otherConcepts.has(c)));
            const union = new Set([...nodeConcepts, ...otherConcepts]);
            
            return union.size > 0 ? intersection.size / union.size : 0;
        });
    }
    
    /**
     * Find cluster center for positioning
     */
    findClusterCenter(node, allNodes, similarities) {
        // Find the most similar nodes and position near them
        const similarNodes = allNodes
            .map((n, i) => ({ node: n, similarity: similarities[i] }))
            .filter(item => item.similarity > 0.2)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3);
            
        if (similarNodes.length === 0) {
            // No similar nodes, return center position
            return {
                x: 5,
                y: 5
            };
        }

        // Average position of similar nodes
        const avgX = similarNodes.reduce((sum, item) => sum + (item.node.x || 5), 0) / similarNodes.length;
        const avgY = similarNodes.reduce((sum, item) => sum + (item.node.y || 5), 0) / similarNodes.length;
        
        return { x: avgX, y: avgY };
    }
    
    /**
     * Extract semantic information from interaction
     */
    extractSemanticInfo(interaction) {
        const content = (interaction.content || interaction.prompt || '');
        const concepts = Array.isArray(interaction.concepts) ? interaction.concepts : [];
        const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const uniqueWords = [...new Set(words)];

        return {
            // Test-expected properties
            conceptCount: concepts.length,
            contentLength: content.length,
            averageWordLength: words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0,
            uniqueWords: uniqueWords.length,

            // Enhanced semantic analysis
            categories: this.categorizeContent(content, concepts),
            entityCount: this.countEntities(interaction),
            abstractionLevel: this.determineAbstractionLevel(content),
            semanticComplexity: this.calculateSemanticComplexity(content, concepts),
            languageFeatures: this.extractLanguageFeatures(content),
            domainSpecificity: this.calculateDomainSpecificity(content, concepts)
        };
    }

    /**
     * Calculate quality metrics for interaction
     */
    calculateQualityMetrics(interaction) {
        const content = (interaction.content || interaction.prompt || '').toLowerCase();
        const concepts = interaction.concepts || [];
        const metadata = interaction.metadata || {};

        // Use metadata values if available, otherwise calculate
        const quality = metadata.quality !== undefined ? metadata.quality : this.calculateDepthScore(content);
        const importance = metadata.importance !== undefined ? metadata.importance : this.calculateImportanceScore(interaction);
        const depth = metadata.depth !== undefined ? metadata.depth : this.calculateDepthScore(content);
        const complexity = metadata.complexity !== undefined ? metadata.complexity : this.calculateComplexityScore(content, concepts);

        // Calculate overall as average of main metrics
        const overall = (quality + importance + depth + complexity) / 4;

        return {
            // Test-expected properties
            overall,
            quality,
            importance,
            depth,
            complexity,

            // Additional metrics
            clarity: this.calculateClarityScore(content),
            completeness: this.calculateCompletenessScore(interaction),
            novelty: this.calculateNoveltyScore(interaction)
        };
    }

    /**
     * Analyze concepts for categorization and insights
     */
    analyzeConcepts(concepts) {
        if (!Array.isArray(concepts)) return {
            total: 0,
            unique: 0,
            frequencies: {},
            topConcepts: [],
            categories: [],
            diversity: 0,
            abstractions: []
        };

        // Calculate frequency distribution
        const frequencies = {};
        concepts.forEach(concept => {
            frequencies[concept] = (frequencies[concept] || 0) + 1;
        });

        // Get top concepts sorted by frequency
        const topConcepts = Object.entries(frequencies)
            .map(([concept, count]) => ({ concept, count }))
            .sort((a, b) => b.count - a.count);

        const uniqueConcepts = [...new Set(concepts)];
        const categories = this.categorizeConceptList(concepts);
        const diversity = this.calculateConceptDiversity(concepts);
        const abstractions = this.identifyAbstractions(concepts);
        const relationships = this.inferConceptRelationships(concepts);

        return {
            // Test-expected properties
            total: concepts.length,
            unique: uniqueConcepts.length,
            frequencies,
            topConcepts,

            // Additional analysis
            categories,
            diversity,
            abstractions,
            relationships,
            totalCount: concepts.length,
            uniqueCount: uniqueConcepts.length
        };
    }

    /**
     * Extract temporal information
     */
    extractTemporalInfo(interaction) {
        const timestamp = new Date(interaction.timestamp || interaction.created || Date.now());
        const now = new Date();
        const age = now - timestamp;
        const metadata = interaction.metadata || {};

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = dayNames[timestamp.getDay()];
        const timeOfDay = this.categorizeTimeOfDay(timestamp);

        return {
            // Test-expected properties
            timestamp: interaction.timestamp || timestamp.toISOString(),
            processingTime: metadata.processingTime || 0,
            timeOfDay,
            dayOfWeek,

            // Additional temporal analysis
            timestampObject: timestamp,
            age,
            ageCategory: this.categorizeAge(age),
            recency: this.calculateRecency(age),
            temporalRelevance: this.calculateTemporalRelevance(age)
        };
    }

    /**
     * Extract relationship information
     */
    extractRelationshipInfo(interaction) {
        const concepts = Array.isArray(interaction.concepts) ? interaction.concepts : [];
        const metadata = interaction.metadata || {};
        const relatedInteractions = metadata.relatedInteractions || [];
        const similarityScores = metadata.similarityScores || [];

        // Generate concept pairs
        const conceptPairs = [];
        for (let i = 0; i < concepts.length; i++) {
            for (let j = i + 1; j < concepts.length; j++) {
                conceptPairs.push([concepts[i], concepts[j]]);
            }
        }

        // Calculate average similarity
        const averageSimilarity = similarityScores.length > 0
            ? similarityScores.reduce((sum, score) => sum + score, 0) / similarityScores.length
            : 0;

        return {
            // Test-expected properties
            conceptPairs,
            relatedCount: relatedInteractions.length,
            averageSimilarity,

            // Additional relationship analysis
            hasRelationships: !!(interaction.relationships && interaction.relationships.length > 0),
            relationshipCount: interaction.relationships ? interaction.relationships.length : 0,
            relationshipTypes: this.identifyRelationshipTypes(interaction.relationships),
            contextualConnections: this.identifyContextualConnections(interaction),
            semanticSimilarity: this.estimateSemanticSimilarity(interaction)
        };
    }

    /**
     * Identify processing steps that occurred
     */
    identifyProcessingSteps(interaction) {
        const steps = [];

        if (interaction.content || interaction.prompt) steps.push('content_ingestion');
        if (interaction.concepts) steps.push('concept_extraction');
        if (interaction.embedding) steps.push('embedding_generation');
        if (interaction.chunks) steps.push('text_chunking');
        if (interaction.relationships) steps.push('relationship_analysis');
        if (interaction.context) steps.push('context_integration');
        if (interaction.importance !== undefined) steps.push('importance_scoring');

        return steps;
    }

    /**
     * Trace data flow through the system
     */
    traceDataFlow(interaction) {
        const flow = {
            source: this.identifyDataSource(interaction),
            transformations: this.identifyTransformations(interaction),
            storage: this.identifyStorageLocations(interaction),
            outputs: this.identifyOutputs(interaction)
        };

        return flow;
    }

    /**
     * Calculate dynamic color based on semantic properties
     */
    calculateDynamicColor(interaction, typeConfig) {
        const baseColor = typeConfig.color;
        const concepts = interaction.concepts || [];

        // Modify color based on semantic category
        const categories = this.categorizeContent(
            (interaction.content || interaction.prompt || '').toLowerCase(),
            concepts
        );

        if (categories.includes('technology')) {
            return this.adjustColorForCategory(baseColor, 'blue');
        } else if (categories.includes('science')) {
            return this.adjustColorForCategory(baseColor, 'green');
        } else if (categories.includes('business')) {
            return this.adjustColorForCategory(baseColor, 'orange');
        } else if (categories.includes('health')) {
            return this.adjustColorForCategory(baseColor, 'red');
        }

        return baseColor;
    }

    /**
     * Calculate node opacity based on quality and relevance
     */
    calculateOpacity(interaction, qualityMetrics) {
        let opacity = 0.8; // Base opacity

        // Reduce opacity for low-quality interactions
        if (qualityMetrics.importance < 0.3) opacity -= 0.2;
        if (qualityMetrics.depth < 0.2) opacity -= 0.1;
        if (qualityMetrics.completeness < 0.3) opacity -= 0.1;

        // Age-based opacity (older = more transparent)
        const age = Date.now() - new Date(interaction.timestamp || interaction.created || 0).getTime();
        const daysSinceCreation = age / (1000 * 60 * 60 * 24);
        if (daysSinceCreation > 30) opacity -= 0.1;
        if (daysSinceCreation > 90) opacity -= 0.2;

        return Math.max(0.3, Math.min(opacity, 1.0));
    }

    // Helper methods for semantic analysis

    categorizeContent(content, concepts) {
        const categories = [];
        const conceptsArray = Array.isArray(concepts) ? concepts : [];
        const allText = (content + ' ' + conceptsArray.join(' ')).toLowerCase();

        for (const [category, keywords] of Object.entries(this.conceptCategories)) {
            if (keywords.some(keyword => allText.includes(keyword))) {
                categories.push(category);
            }
        }

        return categories.length > 0 ? categories : ['general'];
    }

    countEntities(interaction) {
        // Simple entity counting based on capitalized words
        const content = interaction.content || interaction.prompt || '';
        const entities = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
        return entities.length;
    }

    determineAbstractionLevel(content) {
        const abstractWords = ['concept', 'theory', 'principle', 'framework', 'model', 'approach'];
        const concreteWords = ['specific', 'example', 'instance', 'case', 'particular', 'actual'];

        const abstractCount = abstractWords.reduce((count, word) =>
            content.includes(word) ? count + 1 : count, 0);
        const concreteCount = concreteWords.reduce((count, word) =>
            content.includes(word) ? count + 1 : count, 0);

        if (abstractCount > concreteCount) return 'abstract';
        if (concreteCount > abstractCount) return 'concrete';
        return 'mixed';
    }

    calculateSemanticComplexity(content, concepts) {
        const conceptCount = Array.isArray(concepts) ? concepts.length : 0;
        const contentLength = content.length;
        const uniqueWords = new Set(content.split(/\s+/)).size;

        return Math.min((conceptCount * 0.3 + contentLength * 0.001 + uniqueWords * 0.01), 1.0);
    }

    extractLanguageFeatures(content) {
        return {
            hasQuestions: /\?/.test(content),
            hasExclamations: /!/.test(content),
            hasNegations: /\b(not|no|never|nothing)\b/i.test(content),
            hasComparisons: /\b(than|compared|versus|vs)\b/i.test(content),
            hasNumbers: /\d+/.test(content),
            averageWordLength: this.calculateAverageWordLength(content)
        };
    }

    calculateDomainSpecificity(content, concepts) {
        // Higher scores for content that uses domain-specific terminology
        const technicalTerms = ['algorithm', 'optimization', 'framework', 'methodology', 'implementation'];
        const technicalCount = technicalTerms.reduce((count, term) =>
            content.includes(term) ? count + 1 : count, 0);

        return Math.min(technicalCount / technicalTerms.length + (concepts.length * 0.1), 1.0);
    }

    calculateDepthScore(content) {
        const depthIndicators = this.qualityIndicators.depth;
        const score = depthIndicators.reduce((score, indicator) =>
            content.includes(indicator) ? score + 0.2 : score, 0);
        return Math.min(score + (content.length / 1000 * 0.1), 1.0);
    }

    calculateComplexityScore(content, concepts) {
        const complexityIndicators = this.qualityIndicators.complexity;
        const indicatorScore = complexityIndicators.reduce((score, indicator) =>
            content.includes(indicator) ? score + 0.2 : score, 0);
        const conceptScore = Array.isArray(concepts) ? concepts.length * 0.05 : 0;
        return Math.min(indicatorScore + conceptScore, 1.0);
    }

    calculateClarityScore(content) {
        const clarityIndicators = this.qualityIndicators.clarity;
        const score = clarityIndicators.reduce((score, indicator) =>
            content.includes(indicator) ? score + 0.2 : score, 0);
        // Penalty for very long or very short content
        const lengthPenalty = content.length < 50 ? 0.2 : (content.length > 2000 ? 0.1 : 0);
        return Math.max(0, Math.min(score - lengthPenalty, 1.0));
    }

    calculateImportanceScore(interaction) {
        if (interaction.importance !== undefined) {
            return interaction.importance;
        }

        const content = (interaction.content || interaction.prompt || '').toLowerCase();
        const importanceIndicators = this.qualityIndicators.importance;
        const score = importanceIndicators.reduce((score, indicator) =>
            content.includes(indicator) ? score + 0.2 : score, 0);

        // Boost for certain interaction types
        const type = this.detectInteractionType(interaction);
        if (['tell', 'upload', 'augment'].includes(type)) {
            return Math.min(score + 0.3, 1.0);
        }

        return score;
    }

    calculateCompletenessScore(interaction) {
        let score = 0.5; // Base score

        if (interaction.content || interaction.prompt) score += 0.2;
        if (interaction.concepts && interaction.concepts.length > 0) score += 0.2;
        if (interaction.embedding) score += 0.1;
        if (interaction.relationships && interaction.relationships.length > 0) score += 0.1;
        if (interaction.context) score += 0.1;

        return Math.min(score, 1.0);
    }

    calculateNoveltyScore(interaction) {
        // Simple novelty based on content uniqueness
        // In a real implementation, this would compare against existing knowledge
        const content = interaction.content || interaction.prompt || '';
        const uniqueWords = new Set(content.toLowerCase().split(/\s+/));
        return Math.min(uniqueWords.size / 100, 1.0);
    }

    categorizeConceptList(concepts) {
        const categories = new Set();

        for (const concept of concepts) {
            const conceptLower = String(concept).toLowerCase();
            for (const [category, keywords] of Object.entries(this.conceptCategories)) {
                if (keywords.some(keyword => conceptLower.includes(keyword))) {
                    categories.add(category);
                }
            }
        }

        return Array.from(categories);
    }

    calculateConceptDiversity(concepts) {
        const uniqueConcepts = new Set(concepts);
        return uniqueConcepts.size / Math.max(concepts.length, 1);
    }

    identifyAbstractions(concepts) {
        const abstractionKeywords = ['concept', 'principle', 'theory', 'framework', 'model'];
        return concepts.filter(concept =>
            abstractionKeywords.some(keyword => String(concept).toLowerCase().includes(keyword))
        );
    }

    inferConceptRelationships(concepts) {
        // Simple relationship inference based on co-occurrence
        const relationships = [];
        for (let i = 0; i < concepts.length; i++) {
            for (let j = i + 1; j < concepts.length; j++) {
                relationships.push({ from: concepts[i], to: concepts[j], type: 'co-occurs' });
            }
        }
        return relationships;
    }

    categorizeAge(ageMs) {
        const minutes = ageMs / (1000 * 60);
        const hours = minutes / 60;
        const days = hours / 24;

        if (minutes < 5) return 'just_now';
        if (minutes < 60) return 'recent';
        if (hours < 24) return 'today';
        if (days < 7) return 'this_week';
        if (days < 30) return 'this_month';
        return 'older';
    }

    categorizeTimeOfDay(timestamp) {
        const hour = timestamp.getHours();
        if (hour < 6) return 'night';
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    calculateRecency(ageMs) {
        const days = ageMs / (1000 * 60 * 60 * 24);
        return Math.max(0, 1 - (days / 30)); // Linear decay over 30 days
    }

    calculateTemporalRelevance(ageMs) {
        // Exponential decay for temporal relevance
        const days = ageMs / (1000 * 60 * 60 * 24);
        return Math.exp(-days / 7); // Half-life of 7 days
    }

    identifyRelationshipTypes(relationships) {
        if (!relationships) return [];

        const types = new Set();
        relationships.forEach(rel => {
            if (rel.type) types.add(rel.type);
        });
        return Array.from(types);
    }

    identifyContextualConnections(interaction) {
        const connections = [];

        if (interaction.context) {
            connections.push({ type: 'context', value: interaction.context });
        }
        if (interaction.documentId) {
            connections.push({ type: 'document', value: interaction.documentId });
        }
        if (interaction.conversationId) {
            connections.push({ type: 'conversation', value: interaction.conversationId });
        }

        return connections;
    }

    estimateSemanticSimilarity(interaction) {
        // Placeholder for semantic similarity estimation
        // In a real implementation, this would use embeddings
        return Math.random() * 0.5 + 0.3; // Random similarity between 0.3-0.8
    }

    identifyDataSource(interaction) {
        if (interaction.source) return interaction.source;
        if (interaction.documentId) return 'document';
        if (interaction.conversationId) return 'conversation';
        return 'unknown';
    }

    identifyTransformations(interaction) {
        const transformations = [];

        if (interaction.originalContent && interaction.content !== interaction.originalContent) {
            transformations.push('content_processing');
        }
        if (interaction.concepts) transformations.push('concept_extraction');
        if (interaction.embedding) transformations.push('vectorization');
        if (interaction.summary) transformations.push('summarization');

        return transformations;
    }

    identifyStorageLocations(interaction) {
        const locations = [];

        if (interaction.sparqlStored) locations.push('sparql_store');
        if (interaction.memoryCached) locations.push('memory_cache');
        if (interaction.documentStore) locations.push('document_store');

        return locations.length > 0 ? locations : ['unknown'];
    }

    identifyOutputs(interaction) {
        const outputs = [];

        if (interaction.response) outputs.push('response');
        if (interaction.concepts) outputs.push('concepts');
        if (interaction.embedding) outputs.push('embedding');
        if (interaction.relationships) outputs.push('relationships');

        return outputs;
    }

    adjustColorForCategory(baseColor, category) {
        // Simple color adjustment based on category
        const adjustments = {
            blue: (color) => color.replace(/#[0-9a-f]{6}/i, '#4285f4'),
            green: (color) => color.replace(/#[0-9a-f]{6}/i, '#34a853'),
            orange: (color) => color.replace(/#[0-9a-f]{6}/i, '#ff9800'),
            red: (color) => color.replace(/#[0-9a-f]{6}/i, '#ea4335')
        };

        return adjustments[category] ? adjustments[category](baseColor) : baseColor;
    }

    calculateAverageWordLength(content) {
        const words = content.split(/\s+/).filter(word => word.length > 0);
        if (words.length === 0) return 0;

        const totalLength = words.reduce((sum, word) => sum + word.length, 0);
        return totalLength / words.length;
    }

    /**
     * Get or create embedding vector for content
     * In a live system, this would call an embedding service
     */
    getContentEmbedding(content) {
        // Return null to indicate no embedding available
        // The live system should integrate with embedding services
        return null;
    }
    
    /**
     * Group interactions into semantic units (zoom level: unit)
     */
    groupIntoUnits(interactions) {
        // Simple grouping by time windows and concept similarity
        const units = [];
        const timeWindow = 5 * 60 * 1000; // 5 minutes
        
        let currentUnit = [];
        let lastTime = 0;
        
        for (const interaction of interactions) {
            const time = new Date(interaction.timestamp || interaction.created || 0).getTime();
            
            if (time - lastTime > timeWindow && currentUnit.length > 0) {
                units.push(this.mergeInteractionsToUnit(currentUnit));
                currentUnit = [];
            }
            
            currentUnit.push(interaction);
            lastTime = time;
        }
        
        if (currentUnit.length > 0) {
            units.push(this.mergeInteractionsToUnit(currentUnit));
        }
        
        return units;
    }
    
    /**
     * Merge multiple interactions into a single unit
     */
    mergeInteractionsToUnit(interactions) {
        if (interactions.length === 1) return interactions[0];
        
        const allConcepts = [...new Set(interactions.flatMap(i => i.concepts || []))];
        const combinedContent = interactions.map(i => i.content || i.prompt || '').join(' | ');
        
        return {
            id: `unit_${interactions.map(i => i.id).join('_')}`,
            type: 'unit',
            content: combinedContent,
            concepts: allConcepts,
            timestamp: interactions[0].timestamp || interactions[0].created,
            unitSize: interactions.length,
            interactions: interactions
        };
    }
    
    /**
     * Group interactions by document/conversation (zoom level: text)
     */
    groupByDocument(interactions) {
        // Group by document ID or conversation thread
        const groups = new Map();
        
        for (const interaction of interactions) {
            const docId = interaction.documentId || interaction.conversationId || 'default';
            
            if (!groups.has(docId)) {
                groups.set(docId, []);
            }
            groups.get(docId).push(interaction);
        }
        
        return Array.from(groups.values()).map(group => this.mergeInteractionsToDocument(group));
    }
    
    /**
     * Merge interactions into document-level representation
     */
    mergeInteractionsToDocument(interactions) {
        const allConcepts = [...new Set(interactions.flatMap(i => i.concepts || []))];
        const docTitle = interactions[0].title || interactions[0].documentId || 'Document';
        
        return {
            id: `doc_${interactions[0].documentId || 'default'}`,
            type: 'document',
            content: `${docTitle} (${interactions.length} interactions)`,
            concepts: allConcepts,
            timestamp: interactions[0].timestamp || interactions[0].created,
            documentSize: interactions.length,
            interactions: interactions
        };
    }
    
    /**
     * Group interactions by concept communities (zoom level: community)
     */
    groupByCommunity(interactions) {
        // Simple community detection based on shared concepts
        const communities = new Map();
        
        for (const interaction of interactions) {
            const concepts = Array.isArray(interaction.concepts) ? interaction.concepts : [];
            const communityKey = concepts.slice(0, 2).sort().join('_') || 'general';
            
            if (!communities.has(communityKey)) {
                communities.set(communityKey, []);
            }
            communities.get(communityKey).push(interaction);
        }
        
        return Array.from(communities.values()).map(group => this.mergeInteractionsToCommunity(group));
    }
    
    /**
     * Merge interactions into community representation
     */
    mergeInteractionsToCommunity(interactions) {
        const allConcepts = [...new Set(interactions.flatMap(i => i.concepts || []))];
        const communityName = allConcepts.slice(0, 3).join(', ') || 'General Community';
        
        return {
            id: `community_${allConcepts.slice(0, 2).join('_')}`,
            type: 'community',
            content: `${communityName} (${interactions.length} interactions)`,
            concepts: allConcepts,
            timestamp: interactions[0].timestamp || interactions[0].created,
            communitySize: interactions.length,
            interactions: interactions
        };
    }
    
    /**
     * Create corpus-level view (zoom level: corpus)
     */
    createCorpusView(interactions) {
        const allConcepts = [...new Set(interactions.flatMap(i => i.concepts || []))];
        const typeStats = interactions.reduce((stats, i) => {
            const type = this.detectInteractionType(i);
            stats[type] = (stats[type] || 0) + 1;
            return stats;
        }, {});
        
        const corpusContent = `Corpus: ${interactions.length} interactions, ${allConcepts.length} unique concepts`;
        
        return [{
            id: 'corpus_view',
            type: 'corpus',
            content: corpusContent,
            concepts: allConcepts.slice(0, 20), // Top concepts
            timestamp: new Date(),
            corpusSize: interactions.length,
            typeDistribution: typeStats,
            interactions: interactions
        }];
    }
}