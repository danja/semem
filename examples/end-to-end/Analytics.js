#!/usr/bin/env node

/**
 * End-to-End Module 5: Graph Analytics and Community Detection
 * 
 * This module demonstrates advanced graph analytics including:
 * - Network topology analysis
 * - Community detection algorithms
 * - Centrality measures (degree, betweenness, closeness)
 * - Clustering coefficient analysis
 * - Knowledge graph connectivity patterns
 */

import chalk from 'chalk';
import Config from '../../src/Config.js';

export default class AnalyticsModule {
    constructor(config = null) {
        this.config = config;
        this.sparqlEndpoint = null;
        this.networkData = {
            nodes: [],
            edges: [],
            communities: [],
            centrality: {},
            clustering: {}
        };
        this.results = {
            nodesAnalyzed: 0,
            edgesAnalyzed: 0,
            communitiesFound: 0,
            avgClusteringCoefficient: 0,
            networkDensity: 0,
            topCentralityNodes: [],
            largestCommunity: null,
            graphConnectivity: 0,
            graphURI: 'http://semem.hyperdata.it/end-to-end',
            success: false,
            error: null
        };
    }

    async initialize() {
        console.log(chalk.bold.blue('📈 Module 5: Graph Analytics & Community Detection'));
        console.log(chalk.gray('   Network analysis and community structure discovery\n'));

        // Load configuration if not provided
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }

        await this.initializeSparqlEndpoint();

        console.log(chalk.green('✅ Module 5 initialization complete\n'));
    }

    async initializeSparqlEndpoint() {
        // Get SPARQL endpoint configuration
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured. Please check your config.');
        }

        this.sparqlEndpoint = sparqlEndpoints[0];
        
        console.log(`✅ SPARQL endpoint initialized: ${chalk.bold(this.sparqlEndpoint.urlBase)}`);
        console.log(`📊 Graph URI: ${chalk.bold(this.results.graphURI)}`);
    }

    async execute() {
        try {
            await this.buildNetworkGraph();
            await this.analyzeNetworkTopology();
            await this.detectCommunities();
            await this.calculateCentralityMeasures();
            await this.analyzeClusteringPatterns();
            await this.generateAnalyticsReport();
            
            this.results.success = true;
            console.log(chalk.bold.green('✅ Module 5 Complete: Graph analytics and community detection demonstrated\n'));
            
        } catch (error) {
            this.results.error = error.message;
            this.results.success = false;
            console.log(chalk.red(`❌ Module 5 Failed: ${error.message}\n`));
            throw error;
        }
    }

    async buildNetworkGraph() {
        console.log('🕸️ Building network graph from knowledge base...');

        // Query for documents as nodes
        const documentsQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?doc ?title ?wordCount
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?doc a semem:Document ;
                         rdfs:label ?title ;
                         semem:wordCount ?wordCount .
                }
            }
        `;

        const docResult = await this.executeSparqlSelect(documentsQuery);
        
        // Add documents as nodes
        if (docResult.results?.bindings) {
            for (const binding of docResult.results.bindings) {
                this.networkData.nodes.push({
                    id: binding.doc?.value,
                    label: binding.title?.value,
                    type: 'document',
                    size: parseInt(binding.wordCount?.value || 0),
                    degree: 0,
                    betweenness: 0,
                    closeness: 0,
                    community: -1
                });
            }
        }

        // Query for entities as nodes - using SPARQLStore format
        const entitiesQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            
            SELECT ?entity ?entityName ?sourceDoc
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?entity a ragno:Element ;
                            skos:prefLabel ?entityName ;
                            ragno:content ?content .
                    
                    # Extract source document from the content or use a pattern
                    BIND(
                        IF(CONTAINS(?content, "extracted from"),
                           REPLACE(?content, ".*extracted from ([^)]+).*", "$1"),
                           "Unknown Document"
                        ) AS ?sourceDoc
                    )
                    
                    # Filter to only get entities (not other ragno elements)
                    FILTER(CONTAINS(STR(?entity), "/entity/"))
                }
            }
        `;

        const entityResult = await this.executeSparqlSelect(entitiesQuery);
        
        // Add entities as nodes and create document-entity edges
        if (entityResult.results?.bindings) {
            for (const binding of entityResult.results.bindings) {
                const entityId = binding.entity?.value;
                const entityName = binding.entityName?.value;
                const sourceDoc = binding.sourceDoc?.value;

                // Add entity node
                this.networkData.nodes.push({
                    id: entityId,
                    label: entityName,
                    type: 'entity',
                    size: 50,
                    degree: 0,
                    betweenness: 0,
                    closeness: 0,
                    community: -1,
                    sourceDocument: sourceDoc
                });

                // Find corresponding document and create edge
                const docNode = this.networkData.nodes.find(n => 
                    n.type === 'document' && (n.label === sourceDoc || n.label.includes(sourceDoc))
                );
                
                if (docNode) {
                    this.networkData.edges.push({
                        source: docNode.id,
                        target: entityId,
                        weight: 0.8,
                        type: 'contains'
                    });
                } else {
                    // If exact match not found, try partial match or create conceptual connection
                    const possibleDoc = this.networkData.nodes.find(n => 
                        n.type === 'document' && (
                            sourceDoc.includes(n.label.split(' ')[0]) ||
                            n.label.includes(sourceDoc.split(' ')[0])
                        )
                    );
                    
                    if (possibleDoc) {
                        this.networkData.edges.push({
                            source: possibleDoc.id,
                            target: entityId,
                            weight: 0.6,
                            type: 'related'
                        });
                    }
                }
            }
        }

        // Create entity-entity co-occurrence edges
        await this.createEntityCooccurrenceEdges();
        
        // Create semantic similarity edges between entities
        await this.createSemanticSimilarityEdges();

        this.results.nodesAnalyzed = this.networkData.nodes.length;
        this.results.edgesAnalyzed = this.networkData.edges.length;

        console.log(`  📊 Network built: ${this.results.nodesAnalyzed} nodes, ${this.results.edgesAnalyzed} edges`);
        console.log(`  📄 Document nodes: ${this.networkData.nodes.filter(n => n.type === 'document').length}`);
        console.log(`  🏷️  Entity nodes: ${this.networkData.nodes.filter(n => n.type === 'entity').length}`);
        console.log(`✅ Network graph construction complete\n`);
    }

    async createEntityCooccurrenceEdges() {
        // Create edges between entities that appear in the same document
        const entitysByDoc = {};
        
        // Group entities by their source document
        for (const edge of this.networkData.edges) {
            if (edge.type === 'contains' || edge.type === 'related') {
                const docId = edge.source;
                const entityId = edge.target;
                
                if (!entitysByDoc[docId]) {
                    entitysByDoc[docId] = [];
                }
                entitysByDoc[docId].push(entityId);
            }
        }

        // Create co-occurrence edges
        for (const docId in entitysByDoc) {
            const entities = entitysByDoc[docId];
            
            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    this.networkData.edges.push({
                        source: entities[i],
                        target: entities[j],
                        weight: 0.7, // Co-occurrence weight
                        type: 'cooccurrence'
                    });
                }
            }
        }
    }

    async createSemanticSimilarityEdges() {
        // Create edges between entities based on semantic similarity of their labels
        const entities = this.networkData.nodes.filter(n => n.type === 'entity');
        
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const entity1 = entities[i];
                const entity2 = entities[j];
                
                // Calculate simple semantic similarity based on shared words
                const similarity = this.calculateLabelSimilarity(entity1.label, entity2.label);
                
                if (similarity > 0.3) { // Threshold for creating similarity edge
                    this.networkData.edges.push({
                        source: entity1.id,
                        target: entity2.id,
                        weight: similarity,
                        type: 'semantic_similarity'
                    });
                }
            }
        }
        
        // Also create cross-domain conceptual edges
        this.createCrossConceptualEdges();
    }

    calculateLabelSimilarity(label1, label2) {
        const words1 = label1.toLowerCase().split(/\s+/);
        const words2 = label2.toLowerCase().split(/\s+/);
        
        // Check for shared words
        const sharedWords = words1.filter(word => words2.includes(word));
        const similarity = sharedWords.length / Math.max(words1.length, words2.length);
        
        // Boost similarity for conceptually related terms
        const conceptualPairs = [
            ['neuroscience', 'memory', 'learning', 'brain', 'cognitive'],
            ['urban', 'planning', 'city', 'sustainable', 'infrastructure'],
            ['climate', 'ocean', 'environmental', 'science', 'dynamics'],
            ['memory', 'learning', 'formation', 'consolidation'],
            ['sustainable', 'planning', 'infrastructure', 'management']
        ];
        
        for (const concepts of conceptualPairs) {
            const label1HasConcept = concepts.some(concept => label1.toLowerCase().includes(concept));
            const label2HasConcept = concepts.some(concept => label2.toLowerCase().includes(concept));
            
            if (label1HasConcept && label2HasConcept) {
                return Math.max(similarity, 0.4); // Boost conceptual similarity
            }
        }
        
        return similarity;
    }

    createCrossConceptualEdges() {
        // Create edges between entities from different domains that might be conceptually related
        const entities = this.networkData.nodes.filter(n => n.type === 'entity');
        
        // Define cross-domain conceptual relationships
        const crossDomainRelations = [
            { concept1: 'learning', concept2: 'smart', weight: 0.5 },
            { concept1: 'memory', concept2: 'infrastructure', weight: 0.4 },
            { concept1: 'neuroscience', concept2: 'planning', weight: 0.4 },
            { concept1: 'sustainable', concept2: 'climate', weight: 0.6 },
            { concept1: 'ocean', concept2: 'urban', weight: 0.3 }
        ];
        
        for (const relation of crossDomainRelations) {
            const entities1 = entities.filter(e => 
                e.label.toLowerCase().includes(relation.concept1)
            );
            const entities2 = entities.filter(e => 
                e.label.toLowerCase().includes(relation.concept2)
            );
            
            for (const e1 of entities1) {
                for (const e2 of entities2) {
                    if (e1.id !== e2.id) {
                        // Check if edge doesn't already exist
                        const existingEdge = this.networkData.edges.find(edge =>
                            (edge.source === e1.id && edge.target === e2.id) ||
                            (edge.source === e2.id && edge.target === e1.id)
                        );
                        
                        if (!existingEdge) {
                            this.networkData.edges.push({
                                source: e1.id,
                                target: e2.id,
                                weight: relation.weight,
                                type: 'cross_domain'
                            });
                        }
                    }
                }
            }
        }
    }

    async analyzeNetworkTopology() {
        console.log('📐 Analyzing network topology...');

        // Calculate degree centrality
        const degreeCount = {};
        this.networkData.nodes.forEach(node => {
            degreeCount[node.id] = 0;
        });

        this.networkData.edges.forEach(edge => {
            degreeCount[edge.source]++;
            degreeCount[edge.target]++;
        });

        // Update node degrees
        this.networkData.nodes.forEach(node => {
            node.degree = degreeCount[node.id] || 0;
        });

        // Calculate network density
        const maxPossibleEdges = (this.results.nodesAnalyzed * (this.results.nodesAnalyzed - 1)) / 2;
        this.results.networkDensity = maxPossibleEdges > 0 ? this.results.edgesAnalyzed / maxPossibleEdges : 0;

        // Find top nodes by degree
        const sortedByDegree = [...this.networkData.nodes]
            .sort((a, b) => b.degree - a.degree)
            .slice(0, 5);

        console.log('  🎯 Network topology metrics:');
        console.log(`    • Network density: ${(this.results.networkDensity * 100).toFixed(2)}%`);
        console.log(`    • Average degree: ${(this.results.edgesAnalyzed * 2 / this.results.nodesAnalyzed).toFixed(2)}`);
        
        console.log('  🔝 Top nodes by degree centrality:');
        sortedByDegree.forEach((node, index) => {
            const type = node.type === 'document' ? '📄' : '🏷️';
            console.log(`    ${index + 1}. ${type} ${chalk.cyan(node.label)} (degree: ${node.degree})`);
        });

        console.log('✅ Network topology analysis complete\n');
    }

    async detectCommunities() {
        console.log('👥 Detecting communities using simple clustering...');

        // Simple community detection based on connectivity patterns
        // Group nodes that are strongly connected
        const visited = new Set();
        let communityId = 0;

        for (const node of this.networkData.nodes) {
            if (!visited.has(node.id)) {
                const community = await this.findConnectedComponent(node.id, visited);
                
                if (community.length > 1) {
                    community.forEach(nodeId => {
                        const nodeObj = this.networkData.nodes.find(n => n.id === nodeId);
                        if (nodeObj) {
                            nodeObj.community = communityId;
                        }
                    });

                    this.networkData.communities.push({
                        id: communityId,
                        nodes: community,
                        size: community.length,
                        type: this.getCommunityType(community)
                    });
                    
                    communityId++;
                }
            }
        }

        this.results.communitiesFound = this.networkData.communities.length;
        
        if (this.results.communitiesFound > 0) {
            const largestCommunity = this.networkData.communities
                .reduce((max, comm) => comm.size > max.size ? comm : max);
            this.results.largestCommunity = largestCommunity;

            console.log(`  📊 Community detection results:`);
            console.log(`    • Communities found: ${this.results.communitiesFound}`);
            console.log(`    • Largest community size: ${largestCommunity.size} nodes`);
            
            console.log('  🏘️  Communities discovered:');
            this.networkData.communities.forEach((community, index) => {
                const nodeLabels = community.nodes
                    .map(nodeId => {
                        const node = this.networkData.nodes.find(n => n.id === nodeId);
                        return node ? node.label : 'Unknown';
                    })
                    .slice(0, 3);
                
                console.log(`    ${index + 1}. ${community.type} community (${community.size} nodes)`);
                console.log(`       └─ ${nodeLabels.join(', ')}${community.size > 3 ? '...' : ''}`);
            });
        } else {
            console.log('  📭 No significant communities detected');
        }

        console.log('✅ Community detection complete\n');
    }

    async findConnectedComponent(startNodeId, visited) {
        const component = [];
        const stack = [startNodeId];
        
        while (stack.length > 0) {
            const nodeId = stack.pop();
            
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                component.push(nodeId);
                
                // Find all connected nodes
                const connectedNodes = this.networkData.edges
                    .filter(edge => edge.source === nodeId || edge.target === nodeId)
                    .map(edge => edge.source === nodeId ? edge.target : edge.source)
                    .filter(connectedNodeId => !visited.has(connectedNodeId));
                
                stack.push(...connectedNodes);
            }
        }
        
        return component;
    }

    getCommunityType(nodeIds) {
        const nodes = nodeIds.map(id => this.networkData.nodes.find(n => n.id === id)).filter(Boolean);
        const docCount = nodes.filter(n => n.type === 'document').length;
        const entityCount = nodes.filter(n => n.type === 'entity').length;
        
        if (docCount > entityCount) return 'Document-centric';
        if (entityCount > docCount) return 'Entity-centric';
        return 'Mixed';
    }

    async calculateCentralityMeasures() {
        console.log('🎯 Calculating centrality measures...');

        // Simple betweenness centrality approximation
        // For each node, count how many shortest paths it could be on
        this.networkData.nodes.forEach(node => {
            let betweennessScore = 0;
            const neighbors = this.getNeighbors(node.id);
            
            // For each pair of neighbors, this node is potentially on their shortest path
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    // Simplified: assume this node is on the path if it connects the neighbors
                    const neighbor1Connections = this.getNeighbors(neighbors[i]);
                    const neighbor2Connections = this.getNeighbors(neighbors[j]);
                    
                    // If neighbors aren't directly connected, this node bridges them
                    if (!neighbor1Connections.includes(neighbors[j])) {
                        betweennessScore += 1;
                    }
                }
            }
            
            node.betweenness = betweennessScore;
        });

        // Calculate closeness centrality (inverse of average distance)
        this.networkData.nodes.forEach(node => {
            const distances = this.calculateDistances(node.id);
            const totalDistance = Object.values(distances).reduce((sum, dist) => sum + dist, 0);
            const avgDistance = totalDistance / (this.results.nodesAnalyzed - 1);
            node.closeness = avgDistance > 0 ? 1 / avgDistance : 0;
        });

        // Find top nodes by different centrality measures
        const topBetweenness = [...this.networkData.nodes]
            .sort((a, b) => b.betweenness - a.betweenness)
            .slice(0, 3);
        
        const topCloseness = [...this.networkData.nodes]
            .sort((a, b) => b.closeness - a.closeness)
            .slice(0, 3);

        this.results.topCentralityNodes = {
            degree: [...this.networkData.nodes].sort((a, b) => b.degree - a.degree).slice(0, 3),
            betweenness: topBetweenness,
            closeness: topCloseness
        };

        console.log('  🏆 Top nodes by centrality measures:');
        console.log('    Betweenness centrality:');
        topBetweenness.forEach((node, index) => {
            const type = node.type === 'document' ? '📄' : '🏷️';
            console.log(`      ${index + 1}. ${type} ${chalk.cyan(node.label)} (${node.betweenness.toFixed(2)})`);
        });

        console.log('    Closeness centrality:');
        topCloseness.forEach((node, index) => {
            const type = node.type === 'document' ? '📄' : '🏷️';
            console.log(`      ${index + 1}. ${type} ${chalk.cyan(node.label)} (${node.closeness.toFixed(3)})`);
        });

        console.log('✅ Centrality measures calculation complete\n');
    }

    getNeighbors(nodeId) {
        return this.networkData.edges
            .filter(edge => edge.source === nodeId || edge.target === nodeId)
            .map(edge => edge.source === nodeId ? edge.target : edge.source);
    }

    calculateDistances(startNodeId) {
        const distances = {};
        const visited = new Set();
        const queue = [{ nodeId: startNodeId, distance: 0 }];
        
        while (queue.length > 0) {
            const { nodeId, distance } = queue.shift();
            
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                distances[nodeId] = distance;
                
                const neighbors = this.getNeighbors(nodeId);
                neighbors.forEach(neighborId => {
                    if (!visited.has(neighborId)) {
                        queue.push({ nodeId: neighborId, distance: distance + 1 });
                    }
                });
            }
        }
        
        return distances;
    }

    async analyzeClusteringPatterns() {
        console.log('🔗 Analyzing clustering patterns...');

        // Calculate clustering coefficient for each node
        let totalClusteringCoefficient = 0;
        let validNodes = 0;

        this.networkData.nodes.forEach(node => {
            const neighbors = this.getNeighbors(node.id);
            
            if (neighbors.length >= 2) {
                // Count edges between neighbors
                let edgesBetweenNeighbors = 0;
                for (let i = 0; i < neighbors.length; i++) {
                    for (let j = i + 1; j < neighbors.length; j++) {
                        const hasEdge = this.networkData.edges.some(edge => 
                            (edge.source === neighbors[i] && edge.target === neighbors[j]) ||
                            (edge.source === neighbors[j] && edge.target === neighbors[i])
                        );
                        if (hasEdge) edgesBetweenNeighbors++;
                    }
                }
                
                const maxPossibleEdges = (neighbors.length * (neighbors.length - 1)) / 2;
                const clusteringCoeff = maxPossibleEdges > 0 ? edgesBetweenNeighbors / maxPossibleEdges : 0;
                
                node.clusteringCoefficient = clusteringCoeff;
                totalClusteringCoefficient += clusteringCoeff;
                validNodes++;
            } else {
                node.clusteringCoefficient = 0;
            }
        });

        this.results.avgClusteringCoefficient = validNodes > 0 ? totalClusteringCoefficient / validNodes : 0;

        // Analyze clustering by node type
        const docClustering = this.networkData.nodes
            .filter(n => n.type === 'document')
            .reduce((sum, n) => sum + (n.clusteringCoefficient || 0), 0) / 
            this.networkData.nodes.filter(n => n.type === 'document').length;

        const entityClustering = this.networkData.nodes
            .filter(n => n.type === 'entity')
            .reduce((sum, n) => sum + (n.clusteringCoefficient || 0), 0) / 
            this.networkData.nodes.filter(n => n.type === 'entity').length;

        console.log('  📊 Clustering analysis:');
        console.log(`    • Average clustering coefficient: ${this.results.avgClusteringCoefficient.toFixed(3)}`);
        console.log(`    • Document nodes clustering: ${(docClustering || 0).toFixed(3)}`);
        console.log(`    • Entity nodes clustering: ${(entityClustering || 0).toFixed(3)}`);

        // Calculate graph connectivity
        this.results.graphConnectivity = this.calculateGraphConnectivity();
        console.log(`    • Graph connectivity: ${this.results.graphConnectivity.toFixed(3)}`);

        console.log('✅ Clustering pattern analysis complete\n');
    }

    calculateGraphConnectivity() {
        // Simple connectivity measure: ratio of actual edges to possible edges
        const maxEdges = (this.results.nodesAnalyzed * (this.results.nodesAnalyzed - 1)) / 2;
        return maxEdges > 0 ? this.results.edgesAnalyzed / maxEdges : 0;
    }

    async generateAnalyticsReport() {
        console.log('📋 Generating graph analytics report...');

        console.log(`\n  📈 ${chalk.bold('Network Statistics:')}`);
        console.log(`     • Nodes: ${chalk.green(this.results.nodesAnalyzed)}`);
        console.log(`     • Edges: ${chalk.green(this.results.edgesAnalyzed)}`);
        console.log(`     • Network density: ${chalk.green((this.results.networkDensity * 100).toFixed(2) + '%')}`);
        console.log(`     • Average clustering coefficient: ${chalk.green(this.results.avgClusteringCoefficient.toFixed(3))}`);
        console.log(`     • Graph connectivity: ${chalk.green(this.results.graphConnectivity.toFixed(3))}`);

        console.log(`\n  🏘️ ${chalk.bold('Community Structure:')}`);
        if (this.results.communitiesFound > 0) {
            console.log(`     • Communities detected: ${chalk.green(this.results.communitiesFound)}`);
            console.log(`     • Largest community: ${chalk.green(this.results.largestCommunity.size + ' nodes')}`);
            console.log(`     • Community types: ${this.networkData.communities.map(c => c.type).join(', ')}`);
        } else {
            console.log(`     • No significant communities detected`);
        }

        console.log(`\n  🎯 ${chalk.bold('Key Network Hubs:')}`);
        if (this.results.topCentralityNodes.degree) {
            this.results.topCentralityNodes.degree.slice(0, 3).forEach((node, index) => {
                const type = node.type === 'document' ? '📄' : '🏷️';
                console.log(`     ${index + 1}. ${type} ${chalk.cyan(node.label)} (degree: ${node.degree})`);
            });
        }

        console.log(`\n✅ Graph analytics and community detection demonstrated\n`);
    }

    async executeSparqlSelect(query) {
        const queryEndpoint = `${this.sparqlEndpoint.urlBase}${this.sparqlEndpoint.query}`;
        
        const response = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json',
                'Authorization': `Basic ${Buffer.from(`${this.sparqlEndpoint.user}:${this.sparqlEndpoint.password}`).toString('base64')}`
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL SELECT failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async cleanup() {
        console.log('🧹 Module 5 cleanup complete');
    }

    getResults() {
        return {
            ...this.results,
            networkData: {
                nodeCount: this.networkData.nodes.length,
                edgeCount: this.networkData.edges.length,
                communityCount: this.networkData.communities.length
            }
        };
    }
}

// Allow running as standalone module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.bold.cyan('🚀 Running Analytics Module Standalone...\n'));
    
    const module = new AnalyticsModule();
    
    module.initialize()
        .then(() => module.execute())
        .then(() => module.cleanup())
        .then(() => {
            console.log(chalk.bold.green('✨ Analytics module completed successfully!'));
            console.log('📊 Results:', JSON.stringify(module.getResults(), null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('💥 Analytics module failed:'), error);
            process.exit(1);
        });
}