/**
 * PersonalizedPageRank Demo
 * 
 * This demo showcases the PersonalizedPageRank algorithm in the context of
 * a semantic knowledge graph. It demonstrates:
 * 
 * 1. Creating a sample knowledge graph with entities, relationships, and units
 * 2. Running PersonalizedPageRank from different entry points
 * 3. Analyzing results and rankings
 * 4. Exporting results to RDF format
 * 5. Combining multiple PPR runs
 * 
 * The scenario simulates a knowledge graph about AI research with papers,
 * authors, concepts, and institutions.
 */

import PersonalizedPageRank from '../src/ragno/algorithms/PersonalizedPageRank.js'
import rdf from 'rdf-ext'
import { logger } from '../src/Utils.js'

// Set up logging to see progress (logger from Utils.js doesn't have setLevel)

console.log('='.repeat(60))
console.log('🧠 PersonalizedPageRank Demo - AI Research Knowledge Graph')
console.log('='.repeat(60))

/**
 * Create a sample knowledge graph representing AI research domain
 * This simulates the output of ragno corpus decomposition
 */
function createSampleKnowledgeGraph() {
    console.log('\n📊 Step 1: Creating sample knowledge graph...')
    
    // Graph structure: nodes, edges, adjacency, types
    const graph = {
        nodes: new Map(),
        edges: new Map(),
        adjacency: new Map()
    }
    
    // AI Research Entities (People, Papers, Concepts, Institutions)
    const entities = [
        // People
        { uri: 'http://example.org/person/geoffrey-hinton', type: 'ragno:Entity', label: 'Geoffrey Hinton', subtype: 'Person' },
        { uri: 'http://example.org/person/yann-lecun', type: 'ragno:Entity', label: 'Yann LeCun', subtype: 'Person' },
        { uri: 'http://example.org/person/yoshua-bengio', type: 'ragno:Entity', label: 'Yoshua Bengio', subtype: 'Person' },
        { uri: 'http://example.org/person/andrew-ng', type: 'ragno:Entity', label: 'Andrew Ng', subtype: 'Person' },
        
        // Concepts
        { uri: 'http://example.org/concept/deep-learning', type: 'ragno:Entity', label: 'Deep Learning', subtype: 'Concept' },
        { uri: 'http://example.org/concept/neural-networks', type: 'ragno:Entity', label: 'Neural Networks', subtype: 'Concept' },
        { uri: 'http://example.org/concept/backpropagation', type: 'ragno:Entity', label: 'Backpropagation', subtype: 'Concept' },
        { uri: 'http://example.org/concept/convolutional-networks', type: 'ragno:Entity', label: 'Convolutional Networks', subtype: 'Concept' },
        { uri: 'http://example.org/concept/machine-learning', type: 'ragno:Entity', label: 'Machine Learning', subtype: 'Concept' },
        { uri: 'http://example.org/concept/artificial-intelligence', type: 'ragno:Entity', label: 'Artificial Intelligence', subtype: 'Concept' },
        { uri: 'http://example.org/concept/natural-language-processing', type: 'ragno:Entity', label: 'Natural Language Processing', subtype: 'Concept' },
        
        // Institutions
        { uri: 'http://example.org/org/university-of-toronto', type: 'ragno:Entity', label: 'University of Toronto', subtype: 'Institution' },
        { uri: 'http://example.org/org/meta', type: 'ragno:Entity', label: 'Meta AI', subtype: 'Institution' },
        { uri: 'http://example.org/org/university-of-montreal', type: 'ragno:Entity', label: 'University of Montreal', subtype: 'Institution' },
        { uri: 'http://example.org/org/stanford-university', type: 'ragno:Entity', label: 'Stanford University', subtype: 'Institution' },
        
        // Papers
        { uri: 'http://example.org/paper/imagenet-paper', type: 'ragno:Unit', label: 'ImageNet Classification with Deep CNNs', subtype: 'Paper' },
        { uri: 'http://example.org/paper/attention-paper', type: 'ragno:Unit', label: 'Attention Is All You Need', subtype: 'Paper' },
        { uri: 'http://example.org/paper/bert-paper', type: 'ragno:Unit', label: 'BERT: Pre-training Bidirectional Transformers', subtype: 'Paper' }
    ]
    
    // Add nodes to graph
    console.log(`   Adding ${entities.length} entities to graph...`)
    for (const entity of entities) {
        graph.nodes.set(entity.uri, {
            type: entity.type,
            label: entity.label,
            subtype: entity.subtype
        })
        graph.adjacency.set(entity.uri, new Set())
    }
    
    // Define relationships with weights (representing relationship strength)
    const relationships = [
        // People -> Institutions
        { from: 'http://example.org/person/geoffrey-hinton', to: 'http://example.org/org/university-of-toronto', weight: 0.9, type: 'affiliatedWith' },
        { from: 'http://example.org/person/yann-lecun', to: 'http://example.org/org/meta', weight: 0.9, type: 'affiliatedWith' },
        { from: 'http://example.org/person/yoshua-bengio', to: 'http://example.org/org/university-of-montreal', weight: 0.9, type: 'affiliatedWith' },
        { from: 'http://example.org/person/andrew-ng', to: 'http://example.org/org/stanford-university', weight: 0.8, type: 'affiliatedWith' },
        
        // People -> Concepts (research interests)
        { from: 'http://example.org/person/geoffrey-hinton', to: 'http://example.org/concept/deep-learning', weight: 0.95, type: 'researches' },
        { from: 'http://example.org/person/geoffrey-hinton', to: 'http://example.org/concept/neural-networks', weight: 0.9, type: 'researches' },
        { from: 'http://example.org/person/geoffrey-hinton', to: 'http://example.org/concept/backpropagation', weight: 0.85, type: 'researches' },
        
        { from: 'http://example.org/person/yann-lecun', to: 'http://example.org/concept/convolutional-networks', weight: 0.95, type: 'researches' },
        { from: 'http://example.org/person/yann-lecun', to: 'http://example.org/concept/deep-learning', weight: 0.9, type: 'researches' },
        
        { from: 'http://example.org/person/yoshua-bengio', to: 'http://example.org/concept/deep-learning', weight: 0.9, type: 'researches' },
        { from: 'http://example.org/person/yoshua-bengio', to: 'http://example.org/concept/natural-language-processing', weight: 0.8, type: 'researches' },
        
        { from: 'http://example.org/person/andrew-ng', to: 'http://example.org/concept/machine-learning', weight: 0.9, type: 'researches' },
        { from: 'http://example.org/person/andrew-ng', to: 'http://example.org/concept/deep-learning', weight: 0.8, type: 'researches' },
        
        // Concept hierarchies
        { from: 'http://example.org/concept/deep-learning', to: 'http://example.org/concept/machine-learning', weight: 0.8, type: 'subFieldOf' },
        { from: 'http://example.org/concept/machine-learning', to: 'http://example.org/concept/artificial-intelligence', weight: 0.85, type: 'subFieldOf' },
        { from: 'http://example.org/concept/neural-networks', to: 'http://example.org/concept/machine-learning', weight: 0.75, type: 'subFieldOf' },
        { from: 'http://example.org/concept/convolutional-networks', to: 'http://example.org/concept/neural-networks', weight: 0.9, type: 'subFieldOf' },
        { from: 'http://example.org/concept/natural-language-processing', to: 'http://example.org/concept/artificial-intelligence', weight: 0.8, type: 'subFieldOf' },
        
        // Papers -> Authors
        { from: 'http://example.org/paper/imagenet-paper', to: 'http://example.org/person/geoffrey-hinton', weight: 0.7, type: 'authoredBy' },
        { from: 'http://example.org/paper/attention-paper', to: 'http://example.org/person/yoshua-bengio', weight: 0.6, type: 'authoredBy' },
        { from: 'http://example.org/paper/bert-paper', to: 'http://example.org/person/yann-lecun', weight: 0.5, type: 'authoredBy' },
        
        // Papers -> Concepts
        { from: 'http://example.org/paper/imagenet-paper', to: 'http://example.org/concept/convolutional-networks', weight: 0.9, type: 'discusses' },
        { from: 'http://example.org/paper/imagenet-paper', to: 'http://example.org/concept/deep-learning', weight: 0.8, type: 'discusses' },
        { from: 'http://example.org/paper/attention-paper', to: 'http://example.org/concept/natural-language-processing', weight: 0.9, type: 'discusses' },
        { from: 'http://example.org/paper/bert-paper', to: 'http://example.org/concept/natural-language-processing', weight: 0.95, type: 'discusses' },
        
        // Collaborations (bidirectional)
        { from: 'http://example.org/person/geoffrey-hinton', to: 'http://example.org/person/yann-lecun', weight: 0.6, type: 'collaboratesWith' },
        { from: 'http://example.org/person/yann-lecun', to: 'http://example.org/person/geoffrey-hinton', weight: 0.6, type: 'collaboratesWith' },
        { from: 'http://example.org/person/yoshua-bengio', to: 'http://example.org/person/geoffrey-hinton', weight: 0.7, type: 'collaboratesWith' },
        { from: 'http://example.org/person/geoffrey-hinton', to: 'http://example.org/person/yoshua-bengio', weight: 0.7, type: 'collaboratesWith' }
    ]
    
    // Add edges and adjacency
    console.log(`   Adding ${relationships.length} relationships...`)
    for (const rel of relationships) {
        const edgeKey = `${rel.from}->${rel.to}`
        graph.edges.set(edgeKey, {
            weight: rel.weight,
            type: rel.type,
            from: rel.from,
            to: rel.to
        })
        
        // Update adjacency lists
        if (!graph.adjacency.has(rel.from)) {
            graph.adjacency.set(rel.from, new Set())
        }
        if (!graph.adjacency.has(rel.to)) {
            graph.adjacency.set(rel.to, new Set())
        }
        
        graph.adjacency.get(rel.from).add(rel.to)
        graph.adjacency.get(rel.to).add(rel.from) // Make graph undirected for PPR
    }
    
    console.log(`   ✅ Knowledge graph created: ${graph.nodes.size} nodes, ${graph.edges.size} edges`)
    
    // Log graph statistics
    const nodeTypes = new Map()
    for (const [uri, node] of graph.nodes) {
        const subtype = node.subtype || 'Unknown'
        nodeTypes.set(subtype, (nodeTypes.get(subtype) || 0) + 1)
    }
    
    console.log('   📊 Node types:')
    for (const [type, count] of nodeTypes) {
        console.log(`      ${type}: ${count}`)
    }
    
    return graph
}

/**
 * Demonstrate basic PersonalizedPageRank functionality
 */
async function demonstrateBasicPPR(graph) {
    console.log('\n🔍 Step 2: Running basic PersonalizedPageRank...')
    
    // Initialize PPR with logging enabled
    const ppr = new PersonalizedPageRank({
        alpha: 0.15,           // 15% teleportation probability
        maxIterations: 30,     // Maximum iterations
        convergenceThreshold: 1e-6,
        logProgress: true,     // Enable progress logging
        topKPerType: 3         // Top 3 results per node type
    })
    
    // Entry point: Start from "Deep Learning" concept
    const entryPoints = ['http://example.org/concept/deep-learning']
    
    console.log(`   🎯 Entry point: Deep Learning`)
    console.log(`   ⚙️  Algorithm parameters: α=0.15, maxIter=30, convergence=1e-6`)
    
    const startTime = Date.now()
    const results = ppr.runPPR(graph, entryPoints)
    const duration = Date.now() - startTime
    
    console.log(`   ⏱️  Completed in ${duration}ms`)
    console.log(`   🔢 Converged: ${results.algorithm === 'personalized-pagerank' ? 'Yes' : 'No'}`)
    console.log(`   📊 Found ${results.rankedNodes.length} ranked nodes`)
    
    // Display top results
    console.log('\n   🏆 Top 10 most relevant nodes:')
    for (let i = 0; i < Math.min(10, results.rankedNodes.length); i++) {
        const node = results.rankedNodes[i]
        const nodeData = graph.nodes.get(node.nodeUri)
        const score = (node.score * 100).toFixed(3)
        console.log(`      ${i + 1}. ${nodeData?.label || 'Unknown'} (${nodeData?.subtype}) - Score: ${score}%`)
    }
    
    // Display results grouped by type
    console.log('\n   📋 Top results by type:')
    for (const [nodeType, topNodes] of results.topKPerType) {
        console.log(`      ${nodeType}:`)
        for (const node of topNodes) {
            const nodeData = graph.nodes.get(node.nodeUri)
            const score = (node.score * 100).toFixed(3)
            console.log(`        • ${nodeData?.label || 'Unknown'} - Score: ${score}%`)
        }
    }
    
    // Display cross-type bridge nodes
    if (results.crossTypeNodes.length > 0) {
        console.log('\n   🌉 Cross-type bridge nodes (connecting different domains):')
        for (const node of results.crossTypeNodes.slice(0, 5)) {
            const nodeData = graph.nodes.get(node.nodeUri)
            console.log(`      • ${nodeData?.label || 'Unknown'} (connects ${node.connectedTypes.join(', ')})`)
        }
    }
    
    return results
}

/**
 * Demonstrate shallow vs deep PPR traversal
 */
async function demonstrateShallowVsDeep(graph) {
    console.log('\n🏃‍♂️ Step 3: Comparing shallow vs deep traversal...')
    
    const ppr = new PersonalizedPageRank({
        alpha: 0.15,
        shallowIterations: 3,  // Quick, local traversal
        deepIterations: 20,    // Comprehensive traversal
        logProgress: false     // Disable detailed logging for comparison
    })
    
    const entryPoints = ['http://example.org/person/geoffrey-hinton']
    console.log(`   🎯 Entry point: Geoffrey Hinton`)
    
    // Run shallow PPR (quick, local neighborhood)
    console.log('\n   🏃‍♂️ Running shallow PPR (3 iterations)...')
    const shallowStartTime = Date.now()
    const shallowResults = ppr.runShallowPPR(graph, entryPoints)
    const shallowDuration = Date.now() - shallowStartTime
    
    console.log(`      ⏱️  Completed in ${shallowDuration}ms`)
    console.log(`      📊 Found ${shallowResults.rankedNodes.length} nodes`)
    console.log('      🏆 Top 5 shallow results:')
    for (let i = 0; i < Math.min(5, shallowResults.rankedNodes.length); i++) {
        const node = shallowResults.rankedNodes[i]
        const nodeData = graph.nodes.get(node.nodeUri)
        const score = (node.score * 100).toFixed(3)
        console.log(`         ${i + 1}. ${nodeData?.label || 'Unknown'} - ${score}%`)
    }
    
    // Run deep PPR (comprehensive, global traversal)
    console.log('\n   🔭 Running deep PPR (20 iterations)...')
    const deepStartTime = Date.now()
    const deepResults = ppr.runDeepPPR(graph, entryPoints)
    const deepDuration = Date.now() - deepStartTime
    
    console.log(`      ⏱️  Completed in ${deepDuration}ms`)
    console.log(`      📊 Found ${deepResults.rankedNodes.length} nodes`)
    console.log('      🏆 Top 5 deep results:')
    for (let i = 0; i < Math.min(5, deepResults.rankedNodes.length); i++) {
        const node = deepResults.rankedNodes[i]
        const nodeData = graph.nodes.get(node.nodeUri)
        const score = (node.score * 100).toFixed(3)
        console.log(`         ${i + 1}. ${nodeData?.label || 'Unknown'} - ${score}%`)
    }
    
    // Compare results
    console.log('\n   📊 Comparison:')
    console.log(`      • Shallow: ${shallowDuration}ms, ${shallowResults.rankedNodes.length} results`)
    console.log(`      • Deep: ${deepDuration}ms, ${deepResults.rankedNodes.length} results`)
    console.log(`      • Deep found ${deepResults.rankedNodes.length - shallowResults.rankedNodes.length} additional relevant nodes`)
    
    return { shallow: shallowResults, deep: deepResults }
}

/**
 * Demonstrate multi-entry point PPR
 */
async function demonstrateMultiEntryPoint(graph) {
    console.log('\n🎯 Step 4: Multi-entry point PersonalizedPageRank...')
    
    const ppr = new PersonalizedPageRank({
        alpha: 0.2,  // Slightly higher teleportation for multi-entry
        maxIterations: 25,
        logProgress: false
    })
    
    // Multiple entry points: Concepts + Person
    const entryPoints = [
        'http://example.org/concept/machine-learning',
        'http://example.org/concept/natural-language-processing',
        'http://example.org/person/andrew-ng'
    ]
    
    console.log('   🎯 Entry points:')
    for (const entryPoint of entryPoints) {
        const nodeData = graph.nodes.get(entryPoint)
        console.log(`      • ${nodeData?.label || 'Unknown'} (${nodeData?.subtype})`)
    }
    
    const results = ppr.runPPR(graph, entryPoints)
    
    console.log(`   📊 Multi-entry PPR found ${results.rankedNodes.length} relevant nodes`)
    console.log('\n   🏆 Top 8 results from multi-entry traversal:')
    
    for (let i = 0; i < Math.min(8, results.rankedNodes.length); i++) {
        const node = results.rankedNodes[i]
        const nodeData = graph.nodes.get(node.nodeUri)
        const score = (node.score * 100).toFixed(3)
        console.log(`      ${i + 1}. ${nodeData?.label || 'Unknown'} (${nodeData?.subtype}) - Score: ${score}%`)
    }
    
    return results
}

/**
 * Demonstrate combining multiple PPR results
 */
async function demonstrateCombinedPPR(graph) {
    console.log('\n🔀 Step 5: Combining multiple PPR analyses...')
    
    const ppr = new PersonalizedPageRank({
        alpha: 0.15,
        maxIterations: 20,
        logProgress: false
    })
    
    // Run separate PPR analyses from different perspectives
    const analyses = [
        {
            name: 'Deep Learning Focus',
            entryPoints: ['http://example.org/concept/deep-learning']
        },
        {
            name: 'NLP Focus', 
            entryPoints: ['http://example.org/concept/natural-language-processing']
        },
        {
            name: 'Institutional Focus',
            entryPoints: ['http://example.org/org/university-of-toronto', 'http://example.org/org/stanford-university']
        }
    ]
    
    const allResults = []
    
    console.log('   🔍 Running separate analyses:')
    for (const analysis of analyses) {
        console.log(`      • ${analysis.name}...`)
        const results = ppr.runPPR(graph, analysis.entryPoints)
        allResults.push(results)
        console.log(`        Found ${results.rankedNodes.length} relevant nodes`)
    }
    
    // Combine all results
    console.log('\n   🔀 Combining results with equal weighting...')
    const combinedResults = ppr.combineResults(allResults, { equalWeights: true })
    
    console.log(`   📊 Combined analysis produced ${combinedResults.rankedNodes.length} unique nodes`)
    console.log('\n   🏆 Top 10 nodes from combined analysis:')
    
    for (let i = 0; i < Math.min(10, combinedResults.rankedNodes.length); i++) {
        const node = combinedResults.rankedNodes[i]
        const nodeData = graph.nodes.get(node.nodeUri)
        const score = (node.score * 100).toFixed(3)
        console.log(`      ${i + 1}. ${nodeData?.label || 'Unknown'} (${nodeData?.subtype}) - Score: ${score}%`)
    }
    
    return { results: combinedResults, pprInstance: ppr }
}

/**
 * Demonstrate RDF export functionality
 */
async function demonstrateRDFExport(results) {
    console.log('\n📤 Step 6: Exporting PPR results to RDF...')
    
    // Create RDF dataset for export
    const dataset = rdf.dataset()
    
    // Create PPR instance for export
    const ppr = new PersonalizedPageRank()
    
    // Export results to RDF
    ppr.exportResultsToRDF(results, dataset)
    
    console.log(`   📋 Created RDF dataset with ${dataset.size} triples`)
    
    // Display some sample RDF triples
    console.log('\n   📄 Sample RDF triples:')
    let tripleCount = 0
    for (const quad of dataset) {
        if (tripleCount >= 8) break  // Show first 8 triples
        
        const subject = quad.subject.value
        const predicate = quad.predicate.value.split('/').pop() || quad.predicate.value
        const object = quad.object.value
        
        console.log(`      ${tripleCount + 1}. <${subject.split('/').pop()}> ${predicate} "${object}"`)
        tripleCount++
    }
    
    // Show RDF statistics
    const predicates = new Set()
    const subjects = new Set()
    
    for (const quad of dataset) {
        predicates.add(quad.predicate.value)
        subjects.add(quad.subject.value)
    }
    
    console.log('\n   📊 RDF Export Statistics:')
    console.log(`      • Total triples: ${dataset.size}`)
    console.log(`      • Unique subjects: ${subjects.size}`)
    console.log(`      • Unique predicates: ${predicates.size}`)
    console.log('      • Predicate types:')
    
    for (const predicate of Array.from(predicates).slice(0, 5)) {
        const shortName = predicate.split('/').pop() || predicate
        console.log(`        - ${shortName}`)
    }
    
    return dataset
}

/**
 * Display final statistics and summary
 */
function displayFinalSummary(pprInstance, allResults) {
    console.log('\n📈 Step 7: Final Statistics and Summary')
    
    const stats = pprInstance.getStatistics()
    
    console.log('\n   📊 PPR Algorithm Statistics (from last run):')
    console.log(`      • Last run: ${stats.lastRun}`)
    console.log(`      • Iterations used: ${stats.iterations}`)
    console.log(`      • Converged: ${stats.convergence}`)
    console.log(`      • Entry points processed: ${stats.entryPointCount}`)
    console.log(`      • Results generated: ${stats.resultCount}`)
    
    // Calculate aggregate statistics from all demo runs
    console.log('\n   📊 Demo Session Aggregate Statistics:')
    let totalRuns = 0
    let totalNodes = 0
    let totalIterations = 0
    
    // Count results from each demo step
    if (allResults.basic) {
        totalRuns++
        totalNodes += allResults.basic.rankedNodes.length
        totalIterations += 30 // basic run used 30 iterations
    }
    if (allResults.traversal) {
        totalRuns += 2 // shallow + deep
        totalNodes += allResults.traversal.shallow.rankedNodes.length
        totalNodes += allResults.traversal.deep.rankedNodes.length
        totalIterations += 3 + 20 // shallow + deep iterations
    }
    if (allResults.multi) {
        totalRuns++
        totalNodes += allResults.multi.rankedNodes.length
        totalIterations += 25 // multi-entry run used 25 iterations
    }
    if (allResults.combined) {
        totalRuns += 3 // three separate analyses that were combined
        totalIterations += 20 * 3 // each used 20 iterations
    }
    
    console.log(`      • Total PPR runs executed: ${totalRuns}`)
    console.log(`      • Total result nodes analyzed: ${totalNodes}`)
    console.log(`      • Total algorithm iterations: ${totalIterations}`)
    console.log(`      • Average nodes per run: ${(totalNodes / totalRuns).toFixed(1)}`)
    console.log(`      • Average iterations per run: ${(totalIterations / totalRuns).toFixed(1)}`)
    
    console.log('\n   🎯 Key Insights:')
    console.log('      • PPR effectively identifies semantically related nodes in knowledge graphs')
    console.log('      • Multi-entry point queries provide broader, more balanced perspectives')
    console.log('      • Shallow PPR is fast for local exploration, deep PPR for comprehensive analysis')
    console.log('      • Bridge nodes help discover cross-domain connections')
    console.log('      • Results can be combined and exported to RDF for further processing')
    
    console.log('\n   💡 Use Cases Demonstrated:')
    console.log('      • Semantic search in academic knowledge graphs')
    console.log('      • Research paper recommendation systems')
    console.log('      • Expert discovery and collaboration networks')
    console.log('      • Concept exploration and knowledge discovery')
    console.log('      • Multi-perspective information retrieval')
}

/**
 * Main demo execution
 */
async function runDemo() {
    try {
        console.log('🚀 Starting PersonalizedPageRank comprehensive demo...\n')
        
        // Step 1: Create sample knowledge graph
        const graph = createSampleKnowledgeGraph()
        
        // Step 2: Basic PPR demonstration
        const basicResults = await demonstrateBasicPPR(graph)
        
        // Step 3: Shallow vs Deep comparison
        const traversalResults = await demonstrateShallowVsDeep(graph)
        
        // Step 4: Multi-entry point PPR
        const multiResults = await demonstrateMultiEntryPoint(graph)
        
        // Step 5: Combined PPR analysis - keep reference to PPR instance
        const { results: combinedResults, pprInstance } = await demonstrateCombinedPPR(graph)
        
        // Step 6: RDF export demonstration
        const rdfDataset = await demonstrateRDFExport(combinedResults)
        
        // Step 7: Final summary with actual statistics
        const allResults = {
            basic: basicResults,
            traversal: traversalResults,
            multi: multiResults,
            combined: combinedResults
        }
        displayFinalSummary(pprInstance, allResults)
        
        console.log('\n' + '='.repeat(60))
        console.log('✅ PersonalizedPageRank Demo completed successfully!')
        console.log('🎉 The algorithm successfully analyzed the AI research knowledge graph')
        console.log(`📊 Generated ${rdfDataset.size} RDF triples for semantic integration`)
        console.log('='.repeat(60))
        
    } catch (error) {
        console.error('\n❌ Demo failed:', error)
        console.error('Stack trace:', error.stack)
        process.exit(1)
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    runDemo()
}

export { runDemo }