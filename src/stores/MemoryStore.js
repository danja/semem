import faiss from 'faiss-node'
import { kmeans } from 'ml-kmeans'
import { logger, vectorOps } from '../Utils.js'
import graphology from 'graphology'
const { Graph } = graphology

export default class MemoryStore {
    constructor(dimension = 1536) {
        this.dimension = dimension
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
        this.shortTermMemory.forEach((interaction, idx) => {
            if (this.accessCounts[idx] > 10 &&
                !this.longTermMemory.some(ltm => ltm.id === interaction.id)) {
                this.longTermMemory.push(interaction)
                logger.info(`Moved interaction ${interaction.id} to long-term memory`)
            }
        })
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
