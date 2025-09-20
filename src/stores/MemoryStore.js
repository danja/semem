import faiss from 'faiss-node'
import { kmeans } from 'ml-kmeans'
import { logger, vectorOps } from '../Utils.js'
import graphology from 'graphology'
const { Graph } = graphology

export default class MemoryStore {
    constructor(dimension, config = null) {
        if (!dimension) {
            throw new Error('Embedding dimension is required - check config.json embeddingDimension setting')
        }
        this.dimension = dimension
        this.config = config
        this.initializeIndex()
        this.shortTermMemory = []
        this.longTermMemory = []
        this.embeddings = []
        this.timestamps = []
        this.accessCounts = []
        this.conceptsList = []
        this.graph = new Graph({ multi: true, allowSelfLoops: false })
        this.semanticMemory = new Map()
        this.clusterLabels = []
        
        // Memory classification configuration
        this.promotionThreshold = config?.get?.('memory.promotionThreshold') || 5.0
        this.classificationChance = config?.get?.('memory.classificationChance') || 0.1
    }

    initializeIndex() {
        try {
            this.index = new faiss.IndexFlatL2(this.dimension)
            if (!this.index || !this.index.getDimension) {
                throw new Error('Failed to initialize FAISS index')
            }
            logger.info(`Initialized FAISS index with dimension ${this.dimension}`)
        } catch (error) {
            logger.error('FAISS index initialization failed:', error)
            throw new Error('Failed to initialize FAISS index: ' + error.message)
        }
    }

    updateGraph(concepts) {
        // Add new nodes if they don't exist
        for (const concept of concepts) {
            if (!this.graph.hasNode(concept)) {
                this.graph.addNode(concept)
            }
        }

        // Add or update edges between concepts
        for (const concept1 of concepts) {
            for (const concept2 of concepts) {
                if (concept1 !== concept2) {
                    // Check for existing edges between the nodes
                    const existingEdges = this.graph.edges(concept1, concept2)

                    if (existingEdges.length > 0) {
                        // Update weight of first existing edge
                        const edgeWeight = this.graph.getEdgeAttribute(existingEdges[0], 'weight')
                        this.graph.setEdgeAttribute(existingEdges[0], 'weight', edgeWeight + 1)
                    } else {
                        // Create new edge with weight 1
                        this.graph.addEdge(concept1, concept2, { weight: 1 })
                    }
                }
            }
        }
    }

    classifyMemory() {
        const currentTime = Date.now()
        const promotionCandidates = []
        
        this.shortTermMemory.forEach((interaction, idx) => {
            if (this.longTermMemory.some(ltm => ltm.id === interaction.id)) {
                return // Skip if already in long-term memory
            }
            
            // Calculate multi-factor importance score
            const importanceScore = this.calculateMemoryImportance(interaction, idx, currentTime)
            
            // Promote to long-term if importance score exceeds threshold
            if (importanceScore >= this.promotionThreshold) {
                promotionCandidates.push({
                    interaction,
                    index: idx,
                    score: importanceScore
                })
            }
        })
        
        // Sort candidates by importance score and promote top candidates
        promotionCandidates
            .sort((a, b) => b.score - a.score)
            .forEach(candidate => {
                this.longTermMemory.push(candidate.interaction)
                logger.info(`Promoted interaction ${candidate.interaction.id} to long-term memory (score: ${candidate.score.toFixed(2)})`)
            })
    }

    /**
     * Calculate multi-factor importance score for memory classification
     * @param {Object} interaction - The interaction to score
     * @param {number} idx - Index in shortTermMemory array
     * @param {number} currentTime - Current timestamp
     * @returns {number} Importance score (0-10 scale)
     */
    calculateMemoryImportance(interaction, idx, currentTime) {
        const accessCount = this.accessCounts[idx] || 1
        const lastAccess = this.timestamps[idx] || interaction.timestamp
        const decayFactor = interaction.decayFactor || 1.0
        const concepts = interaction.concepts || []
        const content = interaction.prompt + ' ' + (interaction.output || interaction.response || '')
        
        // Factor 1: Access Frequency (0-3 points)
        // Logarithmic scale: 1 access = 0.3, 5 accesses = 2.1, 10+ accesses = 3.0
        const accessScore = Math.min(3.0, Math.log1p(accessCount) * 1.3)
        
        // Factor 2: Recency (0-2 points) 
        // More recent interactions get higher scores, with exponential decay
        const timeDiff = (currentTime - lastAccess) / (1000 * 60 * 60) // hours
        const recencyScore = Math.max(0, 2.0 * Math.exp(-timeDiff / 24)) // 24-hour half-life
        
        // Factor 3: Reinforcement Strength (0-2 points)
        // Based on decay factor - higher decay factor indicates reinforcement
        const reinforcementScore = Math.min(2.0, (decayFactor - 1.0) * 4.0)
        
        // Factor 4: Concept Richness (0-2 points)
        // More concepts indicate richer, more important content
        const conceptScore = Math.min(2.0, concepts.length * 0.25)
        
        // Factor 5: Content Complexity (0-1 points)
        // Longer, more complex content may be more important
        const contentLength = content.length
        const complexityScore = Math.min(1.0, contentLength / 1000)
        
        // Factor 6: Semantic Connectivity (0-1 points)
        // Boost score if content relates to many other memories
        const connectivityScore = this.calculateSemanticConnectivity(interaction, concepts)
        
        const totalScore = accessScore + recencyScore + reinforcementScore + 
                          conceptScore + complexityScore + connectivityScore
        
        // Log detailed scoring for debugging
        if (accessCount > 3 || totalScore > 3.0) {
            logger.debug(`Memory importance scoring for ${interaction.id}:`, {
                access: accessScore.toFixed(2),
                recency: recencyScore.toFixed(2), 
                reinforcement: reinforcementScore.toFixed(2),
                concepts: conceptScore.toFixed(2),
                complexity: complexityScore.toFixed(2),
                connectivity: connectivityScore.toFixed(2),
                total: totalScore.toFixed(2),
                accessCount,
                conceptCount: concepts.length,
                contentLength
            })
        }
        
        return totalScore
    }

    /**
     * Calculate semantic connectivity score based on concept overlap
     * @param {Object} interaction - Target interaction
     * @param {Array} concepts - Interaction concepts
     * @returns {number} Connectivity score (0-1)
     */
    calculateSemanticConnectivity(interaction, concepts) {
        if (concepts.length === 0) return 0
        
        let totalOverlap = 0
        let comparedMemories = 0
        
        // Compare with other short-term memories
        this.shortTermMemory.forEach(other => {
            if (other.id === interaction.id) return
            
            const otherConcepts = other.concepts || []
            if (otherConcepts.length === 0) return
            
            // Calculate concept overlap using Jaccard similarity
            const intersection = concepts.filter(c => otherConcepts.includes(c)).length
            const union = new Set([...concepts, ...otherConcepts]).size
            const overlap = union > 0 ? intersection / union : 0
            
            totalOverlap += overlap
            comparedMemories++
        })
        
        // Return average connectivity score
        return comparedMemories > 0 ? Math.min(1.0, totalOverlap / comparedMemories * 3) : 0
    }

    async retrieve(queryEmbedding, queryConcepts, similarityThreshold = 40, excludeLastN = 0) {
        if (this.shortTermMemory.length === 0) {
            logger.info('No interactions available')
            return []
        }

        logger.info('Retrieving relevant interactions...')
        const relevantInteractions = []
        const currentTime = Date.now()
        const decayRate = 0.0001
        const relevantIndices = new Set()

        const normalizedQuery = vectorOps.normalize(queryEmbedding.flat())
        const normalizedEmbeddings = this.embeddings.map(e => vectorOps.normalize(Array.from(e)))

        for (let idx = 0; idx < this.shortTermMemory.length - excludeLastN; idx++) {
            const similarity = vectorOps.cosineSimilarity(normalizedQuery, normalizedEmbeddings[idx]) * 100
            const timeDiff = (currentTime - this.timestamps[idx]) / 1000
            const decayFactor = this.shortTermMemory[idx].decayFactor * Math.exp(-decayRate * timeDiff)
            const reinforcementFactor = Math.log1p(this.accessCounts[idx])
            const adjustedSimilarity = similarity * decayFactor * reinforcementFactor

            if (adjustedSimilarity >= similarityThreshold) {
                relevantIndices.add(idx)
                this.accessCounts[idx]++
                this.timestamps[idx] = currentTime
                this.shortTermMemory[idx].decayFactor *= 1.1

                relevantInteractions.push({
                    similarity: adjustedSimilarity,
                    interaction: this.shortTermMemory[idx],
                    concepts: this.conceptsList[idx]
                })
            }
        }

        // Apply decay to non-relevant interactions
        this.shortTermMemory.forEach((item, idx) => {
            if (!relevantIndices.has(idx)) {
                item.decayFactor *= 0.9
            }
        })

        const activatedConcepts = await this.spreadingActivation(queryConcepts)

        // Combine results
        // Classify memories periodically during retrieval operations
        if (Math.random() < this.classificationChance) {
            this.classifyMemory()
        }

        return this.combineResults(relevantInteractions, activatedConcepts, normalizedQuery)
    }

    async spreadingActivation(queryConcepts) {
        const activatedNodes = new Map()
        const initialActivation = 1.0
        const decayFactor = 0.5

        queryConcepts.forEach(concept => {
            activatedNodes.set(concept, initialActivation)
        })

        // Spread activation for 2 steps
        for (let step = 0; step < 2; step++) {
            const newActivations = new Map()

            for (const [node, activation] of activatedNodes) {
                if (this.graph.hasNode(node)) {
                    this.graph.forEachNeighbor(node, (neighbor, attributes) => {
                        if (!activatedNodes.has(neighbor)) {
                            const weight = attributes.weight
                            const newActivation = activation * decayFactor * weight
                            newActivations.set(neighbor,
                                (newActivations.get(neighbor) || 0) + newActivation)
                        }
                    })
                }
            }

            newActivations.forEach((value, key) => {
                activatedNodes.set(key, value)
            })
        }

        return Object.fromEntries(activatedNodes)
    }

    clusterInteractions() {
        if (this.embeddings.length < 2) return

        const embeddingsMatrix = this.embeddings.map(e => Array.from(e))
        const numClusters = Math.min(10, this.embeddings.length)

        const { clusters } = kmeans(embeddingsMatrix, numClusters)
        this.clusterLabels = clusters

        this.semanticMemory.clear()
        clusters.forEach((label, idx) => {
            if (!this.semanticMemory.has(label)) {
                this.semanticMemory.set(label, [])
            }
            this.semanticMemory.get(label).push({
                embedding: this.embeddings[idx],
                interaction: this.shortTermMemory[idx]
            })
        })
    }

    combineResults(relevantInteractions, activatedConcepts, normalizedQuery) {
        const combined = relevantInteractions.map(({ similarity, interaction, concepts }) => {
            const activationScore = Array.from(concepts)
                .reduce((sum, c) => sum + (activatedConcepts[c] || 0), 0)
            return {
                ...interaction,
                similarity: similarity,
                totalScore: similarity + activationScore
            }
        })

        combined.sort((a, b) => b.totalScore - a.totalScore)

        // Add semantic memory results
        const semanticResults = this.retrieveFromSemanticMemory(normalizedQuery)
        return [...combined, ...semanticResults]
    }

    retrieveFromSemanticMemory(normalizedQuery) {
        if (this.semanticMemory.size === 0) return []

        // Find best matching cluster
        let bestCluster = -1
        let bestSimilarity = -1

        this.semanticMemory.forEach((items, label) => {
            const centroid = this.calculateCentroid(items.map(i => i.embedding))
            const similarity = vectorOps.cosineSimilarity(normalizedQuery, centroid)

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity
                bestCluster = label
            }
        })

        if (bestCluster === -1) return []

        // Get top 5 interactions from best cluster
        return this.semanticMemory.get(bestCluster)
            .map(({ embedding, interaction }) => ({
                ...interaction,
                similarity: vectorOps.cosineSimilarity(normalizedQuery,
                    vectorOps.normalize(Array.from(embedding)))
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)
    }

    calculateCentroid(embeddings) {
        const sum = embeddings.reduce((acc, curr) => {
            const arr = Array.from(curr)
            return acc.map((val, idx) => val + arr[idx])
        }, new Array(this.dimension).fill(0))

        return sum.map(val => val / embeddings.length)
    }
}
