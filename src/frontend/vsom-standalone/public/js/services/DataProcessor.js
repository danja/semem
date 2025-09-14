/**
 * Data Processor
 * Transforms interaction data for VSOM visualization
 */

export default class DataProcessor {
    constructor() {
        this.interactionTypes = {
            tell: { color: '#28a745', priority: 1 },
            ask: { color: '#17a2b8', priority: 2 },
            augment: { color: '#ffc107', priority: 3 },
            chat: { color: '#6c757d', priority: 4 },
            upload: { color: '#fd7e14', priority: 1 },
            inspect: { color: '#e83e8c', priority: 5 }
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
                const concepts = (interaction.concepts || []).map(c => c.toLowerCase());
                
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
                const concepts = (interaction.concepts || []).map(c => c.toLowerCase());
                
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
        // For now, randomly filter based on threshold
        // In a real implementation, this would use embedding similarity
        const keepRatio = 1 - threshold;
        const keepCount = Math.ceil(interactions.length * keepRatio);
        
        return interactions
            .map(interaction => ({
                ...interaction,
                similarity: Math.random()
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, keepCount);
    }
    
    /**
     * Transform interactions to VSOM nodes
     */
    async transformToNodes(interactions, zptSettings) {
        return interactions.map((interaction, index) => {
            const type = this.detectInteractionType(interaction);
            const typeConfig = this.interactionTypes[type] || this.interactionTypes.chat;
            
            return {
                id: `node_${index}`,
                interactionId: interaction.id || `interaction_${index}`,
                type,
                content: interaction.content || interaction.prompt || interaction.summary || '',
                concepts: Array.isArray(interaction.concepts) ? interaction.concepts : [],
                embedding: interaction.embedding || this.generateMockEmbedding(),
                timestamp: new Date(interaction.timestamp || interaction.created || Date.now()),
                
                // Visual properties
                color: typeConfig.color,
                size: this.calculateNodeSize(interaction),
                priority: typeConfig.priority,
                
                // VSOM properties (will be set during positioning)
                x: 0,
                y: 0,
                activation: 0,
                weight: 0,
                
                // Metadata
                metadata: {
                    originalInteraction: interaction,
                    zptSettings: zptSettings
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
     * Calculate appropriate node size based on interaction importance
     */
    calculateNodeSize(interaction) {
        let size = 6; // Base size
        
        // Increase size for longer content
        const contentLength = (interaction.content || interaction.prompt || '').length;
        if (contentLength > 500) size += 2;
        if (contentLength > 1000) size += 2;
        
        // Increase size for more concepts
        const conceptCount = (interaction.concepts || []).length;
        size += Math.min(conceptCount * 0.5, 4);
        
        // Increase size for higher importance
        if (interaction.importance) {
            size += interaction.importance * 3;
        }
        
        return Math.max(4, Math.min(size, 12));
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

                // Add some variation based on concepts to simulate semantic clustering
                if (node.concepts && node.concepts.length > 0) {
                    const conceptHash = node.concepts[0].length % 3; // Simple hash
                    x += (conceptHash - 1) * 0.3; // Small offset based on first concept
                    y += (node.concepts.length % 3 - 1) * 0.3; // Small offset based on concept count
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
            // No similar nodes, place randomly
            return {
                x: Math.random() * 10,
                y: Math.random() * 10
            };
        }
        
        // Average position of similar nodes
        const avgX = similarNodes.reduce((sum, item) => sum + (item.node.x || Math.random() * 10), 0) / similarNodes.length;
        const avgY = similarNodes.reduce((sum, item) => sum + (item.node.y || Math.random() * 10), 0) / similarNodes.length;
        
        return { x: avgX, y: avgY };
    }
    
    /**
     * Generate mock embedding for testing
     */
    generateMockEmbedding() {
        return Array(1536).fill(0).map(() => (Math.random() - 0.5) * 2);
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
            const concepts = interaction.concepts || [];
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