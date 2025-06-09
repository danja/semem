/**
 * Graph Analytics Demo
 * 
 * This demo showcases the GraphAnalytics algorithms for analyzing semantic
 * knowledge graphs. It demonstrates:
 * 
 * 1. Building graphs from RDF datasets with ragno ontology
 * 2. Computing K-core decomposition for node importance ranking
 * 3. Calculating betweenness centrality to identify bridge nodes
 * 4. Finding connected components and graph structure
 * 5. Computing comprehensive graph statistics
 * 6. Comparing different graph structures and their properties
 * 7. Exporting analysis results to RDF format
 * 
 * The scenario creates various graph structures including dense networks,
 * sparse networks, and hub-and-spoke topologies to demonstrate how different
 * algorithms reveal different aspects of graph structure.
 */

import GraphAnalytics from '../src/ragno/algorithms/GraphAnalytics.js'
import rdf from 'rdf-ext'
import { logger } from '../src/Utils.js'

console.log('='.repeat(60))
console.log('📈 Graph Analytics Demo - Knowledge Graph Structure Analysis')
console.log('='.repeat(60))

/**
 * Create an RDF dataset representing a research collaboration network
 * This will demonstrate how GraphAnalytics works with real RDF data
 */
function createResearchCollaborationRDF() {
    console.log('\n📊 Step 1: Creating research collaboration RDF dataset...')
    
    const dataset = rdf.dataset()
    
    // Define namespaces
    const ragno = 'http://purl.org/stuff/ragno/'
    const example = 'http://example.org/'
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    
    // Researchers (entities)
    const researchers = [
        'alice-researcher', 'bob-researcher', 'carol-researcher', 'david-researcher',
        'eve-researcher', 'frank-researcher', 'grace-researcher', 'henry-researcher',
        'iris-researcher', 'jack-researcher', 'karen-researcher', 'leo-researcher'
    ]
    
    // Research topics (entities)
    const topics = [
        'machine-learning', 'natural-language', 'computer-vision', 'robotics',
        'quantum-computing', 'blockchain', 'cybersecurity', 'bioinformatics'
    ]
    
    console.log(`   Adding ${researchers.length} researchers and ${topics.length} topics as entities...`)
    
    // Add researcher entities
    for (const researcher of researchers) {
        const researcherUri = example + researcher
        dataset.add(rdf.quad(
            rdf.namedNode(researcherUri),
            rdf.namedNode(rdfType),
            rdf.namedNode(ragno + 'Entity')
        ))
        
        dataset.add(rdf.quad(
            rdf.namedNode(researcherUri),
            rdf.namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'),
            rdf.literal(researcher.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()))
        ))
    }
    
    // Add topic entities
    for (const topic of topics) {
        const topicUri = example + topic
        dataset.add(rdf.quad(
            rdf.namedNode(topicUri),
            rdf.namedNode(rdfType),
            rdf.namedNode(ragno + 'Entity')
        ))
        
        dataset.add(rdf.quad(
            rdf.namedNode(topicUri),
            rdf.namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'),
            rdf.literal(topic.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()))
        ))
    }
    
    // Create collaboration relationships with varying strengths
    const collaborations = [
        // Dense AI cluster (alice, bob, carol, david)
        { source: 'alice-researcher', target: 'bob-researcher', weight: 0.9, strength: 'strong' },
        { source: 'alice-researcher', target: 'carol-researcher', weight: 0.8, strength: 'strong' },
        { source: 'alice-researcher', target: 'david-researcher', weight: 0.7, strength: 'medium' },
        { source: 'bob-researcher', target: 'carol-researcher', weight: 0.9, strength: 'strong' },
        { source: 'bob-researcher', target: 'david-researcher', weight: 0.8, strength: 'strong' },
        { source: 'carol-researcher', target: 'david-researcher', weight: 0.6, strength: 'medium' },
        
        // Security cluster (eve, frank, grace)
        { source: 'eve-researcher', target: 'frank-researcher', weight: 0.8, strength: 'strong' },
        { source: 'eve-researcher', target: 'grace-researcher', weight: 0.7, strength: 'medium' },
        { source: 'frank-researcher', target: 'grace-researcher', weight: 0.9, strength: 'strong' },
        
        // Bio cluster (henry, iris)
        { source: 'henry-researcher', target: 'iris-researcher', weight: 0.8, strength: 'strong' },
        
        // Bridge connections between clusters
        { source: 'alice-researcher', target: 'eve-researcher', weight: 0.4, strength: 'weak' }, // AI-Security bridge
        { source: 'carol-researcher', target: 'henry-researcher', weight: 0.3, strength: 'weak' }, // AI-Bio bridge
        { source: 'grace-researcher', target: 'iris-researcher', weight: 0.3, strength: 'weak' }, // Security-Bio bridge
        
        // Hub connections (jack and karen as connectors)
        { source: 'jack-researcher', target: 'alice-researcher', weight: 0.5, strength: 'medium' },
        { source: 'jack-researcher', target: 'eve-researcher', weight: 0.5, strength: 'medium' },
        { source: 'jack-researcher', target: 'henry-researcher', weight: 0.4, strength: 'weak' },
        { source: 'karen-researcher', target: 'bob-researcher', weight: 0.4, strength: 'weak' },
        { source: 'karen-researcher', target: 'frank-researcher', weight: 0.4, strength: 'weak' },
        
        // Isolated researcher with single connection
        { source: 'leo-researcher', target: 'karen-researcher', weight: 0.3, strength: 'weak' },
        
        // Topic relationships (researchers to topics)
        { source: 'alice-researcher', target: 'machine-learning', weight: 0.9, strength: 'strong' },
        { source: 'bob-researcher', target: 'machine-learning', weight: 0.8, strength: 'strong' },
        { source: 'carol-researcher', target: 'natural-language', weight: 0.9, strength: 'strong' },
        { source: 'david-researcher', target: 'computer-vision', weight: 0.8, strength: 'strong' },
        { source: 'eve-researcher', target: 'cybersecurity', weight: 0.9, strength: 'strong' },
        { source: 'frank-researcher', target: 'blockchain', weight: 0.8, strength: 'strong' },
        { source: 'grace-researcher', target: 'cybersecurity', weight: 0.7, strength: 'medium' },
        { source: 'henry-researcher', target: 'bioinformatics', weight: 0.9, strength: 'strong' },
        { source: 'iris-researcher', target: 'bioinformatics', weight: 0.8, strength: 'strong' },
        { source: 'jack-researcher', target: 'quantum-computing', weight: 0.7, strength: 'medium' },
        { source: 'karen-researcher', target: 'robotics', weight: 0.6, strength: 'medium' }
    ]
    
    console.log(`   Adding ${collaborations.length} collaboration relationships...`)
    
    // Add relationships as RDF
    for (let i = 0; i < collaborations.length; i++) {
        const collab = collaborations[i]
        const relationshipUri = example + `relationship-${i}`
        const sourceUri = example + collab.source
        const targetUri = example + collab.target
        
        // Relationship entity
        dataset.add(rdf.quad(
            rdf.namedNode(relationshipUri),
            rdf.namedNode(rdfType),
            rdf.namedNode(ragno + 'Relationship')
        ))
        
        // Source and target connections
        dataset.add(rdf.quad(
            rdf.namedNode(relationshipUri),
            rdf.namedNode(ragno + 'hasSourceEntity'),
            rdf.namedNode(sourceUri)
        ))
        
        dataset.add(rdf.quad(
            rdf.namedNode(relationshipUri),
            rdf.namedNode(ragno + 'hasTargetEntity'),
            rdf.namedNode(targetUri)
        ))
        
        // Weight and properties
        dataset.add(rdf.quad(
            rdf.namedNode(relationshipUri),
            rdf.namedNode(ragno + 'hasWeight'),
            rdf.literal(collab.weight)
        ))
        
        dataset.add(rdf.quad(
            rdf.namedNode(relationshipUri),
            rdf.namedNode(ragno + 'relationshipType'),
            rdf.literal(collab.strength + '-collaboration')
        ))
    }
    
    console.log(`   ✅ RDF dataset created: ${dataset.size} triples`)
    console.log(`      • ${researchers.length + topics.length} entities (researchers + topics)`)
    console.log(`      • ${collaborations.length} relationships`)
    console.log(`      • Expected structure: 3 dense clusters + bridge nodes`)
    
    return dataset
}

/**
 * Demonstrate building graph from RDF and basic analysis
 */
async function demonstrateGraphConstruction(dataset) {
    console.log('\n🏗️  Step 2: Building graph from RDF dataset...')
    
    const analytics = new GraphAnalytics({
        logProgress: true
    })
    
    // Build graph from RDF (undirected for collaboration analysis)
    console.log('   🔄 Converting RDF triples to graph representation...')
    const startTime = Date.now()
    const graph = analytics.buildGraphFromRDF(dataset, { undirected: true })
    const buildTime = Date.now() - startTime
    
    console.log(`   ⏱️  Graph construction completed in ${buildTime}ms`)
    console.log(`   📊 Graph structure:`)
    console.log(`      • Nodes: ${graph.nodes.size}`)
    console.log(`      • Edges: ${graph.edges.size}`)
    console.log(`      • Adjacency entries: ${graph.adjacency.size}`)
    
    // Show some sample nodes and their connections
    console.log('\n   🔍 Sample node connections:')
    let sampleCount = 0
    for (const [nodeUri, neighbors] of graph.adjacency) {
        if (sampleCount >= 5) break
        const nodeName = nodeUri.split('/').pop()
        const neighborNames = Array.from(neighbors).map(n => n.split('/').pop()).slice(0, 3)
        const moreCount = neighbors.size > 3 ? ` (+${neighbors.size - 3} more)` : ''
        console.log(`      ${nodeName}: connected to ${neighborNames.join(', ')}${moreCount}`)
        sampleCount++
    }
    
    return { analytics, graph }
}

/**
 * Demonstrate K-core decomposition analysis
 */
async function demonstrateKCoreAnalysis(analytics, graph) {
    console.log('\n🔍 Step 3: Computing K-core decomposition...')
    
    console.log('   ℹ️  K-core identifies nodes that are part of dense subgraphs')
    console.log('      • Higher k-core = more densely connected')
    console.log('      • Useful for finding research clusters and central figures')
    
    const startTime = Date.now()
    const kCoreResults = analytics.computeKCore(graph)
    const analysisTime = Date.now() - startTime
    
    console.log(`   ⏱️  K-core analysis completed in ${analysisTime}ms`)
    console.log(`   📈 Maximum k-core: ${kCoreResults.maxCore}`)
    
    // Display k-core distribution
    console.log('\n   📊 K-core distribution:')
    const sortedCores = Array.from(kCoreResults.coreStats.entries()).sort((a, b) => b[0] - a[0])
    for (const [coreNumber, count] of sortedCores) {
        const percentage = (count / graph.nodes.size * 100).toFixed(1)
        console.log(`      k=${coreNumber}: ${count} nodes (${percentage}%)`)
    }
    
    // Show top nodes by k-core number
    const topKCore = analytics.getTopKNodes(kCoreResults.coreNumbers, 8)
    console.log('\n   🏆 Top nodes by k-core number:')
    for (let i = 0; i < topKCore.length; i++) {
        const node = topKCore[i]
        const nodeName = node.nodeUri.split('/').pop()
        const nodeType = nodeName.includes('researcher') ? 'researcher' : 'topic'
        console.log(`      ${i + 1}. ${nodeName} (${nodeType}) - k-core: ${node.score}`)
    }
    
    return kCoreResults
}

/**
 * Demonstrate betweenness centrality analysis
 */
async function demonstrateBetweennessAnalysis(analytics, graph) {
    console.log('\n🌉 Step 4: Computing betweenness centrality...')
    
    console.log('   ℹ️  Betweenness centrality identifies bridge nodes')
    console.log('      • High betweenness = lies on many shortest paths')
    console.log('      • Useful for finding key connectors between research areas')
    
    const startTime = Date.now()
    const centralityResults = analytics.computeBetweennessCentrality(graph)
    const analysisTime = Date.now() - startTime
    
    console.log(`   ⏱️  Centrality analysis completed in ${analysisTime}ms`)
    console.log(`   📈 Centrality range: ${centralityResults.minCentrality.toFixed(6)} - ${centralityResults.maxCentrality.toFixed(6)}`)
    console.log(`   📊 Average centrality: ${centralityResults.avgCentrality.toFixed(6)}`)
    
    // Show top bridge nodes
    const topBridge = analytics.getTopKNodes(centralityResults.centrality, 8)
    console.log('\n   🌉 Top bridge nodes (highest betweenness centrality):')
    for (let i = 0; i < topBridge.length; i++) {
        const node = topBridge[i]
        const nodeName = node.nodeUri.split('/').pop()
        const nodeType = nodeName.includes('researcher') ? 'researcher' : 'topic'
        const centrality = (node.score * 100).toFixed(3)
        console.log(`      ${i + 1}. ${nodeName} (${nodeType}) - centrality: ${centrality}%`)
    }
    
    // Compare with k-core to find bridge vs. dense cluster differences
    console.log('\n   🔍 Bridge vs. Cluster Analysis:')
    console.log('      • High betweenness + low k-core = pure bridge nodes')
    console.log('      • High betweenness + high k-core = central cluster members')
    
    return centralityResults
}

/**
 * Demonstrate connected components analysis
 */
async function demonstrateComponentAnalysis(analytics, graph) {
    console.log('\n🔗 Step 5: Finding connected components...')
    
    console.log('   ℹ️  Connected components reveal graph fragmentation')
    console.log('      • Each component is a separate collaboration network')
    console.log('      • Larger components indicate better integration')
    
    const startTime = Date.now()
    const componentResults = analytics.findConnectedComponents(graph)
    const analysisTime = Date.now() - startTime
    
    console.log(`   ⏱️  Component analysis completed in ${analysisTime}ms`)
    console.log(`   📊 Found ${componentResults.components.length} connected components`)
    
    // Display component information
    console.log('\n   🏘️  Component breakdown:')
    for (let i = 0; i < componentResults.components.length; i++) {
        const component = componentResults.components[i]
        const percentage = (component.size / graph.nodes.size * 100).toFixed(1)
        
        console.log(`      Component ${i + 1}: ${component.size} nodes (${percentage}%)`)
        
        // Show sample members for larger components
        if (component.size >= 3) {
            const sampleMembers = Array.from(component.nodes).slice(0, 5)
                .map(uri => uri.split('/').pop())
            const remaining = component.size > 5 ? ` (+${component.size - 5} more)` : ''
            console.log(`         Members: ${sampleMembers.join(', ')}${remaining}`)
        }
    }
    
    // Analyze largest component
    if (componentResults.largestComponent) {
        const largest = componentResults.largestComponent
        const coverage = (largest.size / graph.nodes.size * 100).toFixed(1)
        console.log(`\n   🎯 Largest component covers ${coverage}% of the network`)
        console.log(`      This represents the main collaboration network`)
    }
    
    return componentResults
}

/**
 * Demonstrate comprehensive graph statistics
 */
async function demonstrateGraphStatistics(analytics, graph) {
    console.log('\n📊 Step 6: Computing comprehensive graph statistics...')
    
    const startTime = Date.now()
    const stats = analytics.computeGraphStatistics(graph)
    const analysisTime = Date.now() - startTime
    
    console.log(`   ⏱️  Statistics computation completed in ${analysisTime}ms`)
    
    console.log('\n   📈 Graph Structure Metrics:')
    console.log(`      • Total nodes: ${stats.nodeCount}`)
    console.log(`      • Total edges: ${stats.edgeCount}`)
    console.log(`      • Graph density: ${(stats.density * 100).toFixed(2)}%`)
    console.log(`      • Average degree: ${stats.avgDegree.toFixed(2)}`)
    console.log(`      • Degree range: ${stats.minDegree} - ${stats.maxDegree}`)
    
    console.log('\n   ⚖️  Edge Weight Statistics:')
    console.log(`      • Total weight: ${stats.totalWeight.toFixed(2)}`)
    console.log(`      • Average weight: ${stats.avgWeight.toFixed(3)}`)
    console.log(`      • Weight range: ${stats.minWeight.toFixed(3)} - ${stats.maxWeight.toFixed(3)}`)
    
    // Interpret the statistics
    console.log('\n   🔍 Network Interpretation:')
    
    if (stats.density < 0.1) {
        console.log('      • Sparse network: Most researchers work in specialized groups')
    } else if (stats.density < 0.3) {
        console.log('      • Moderately connected: Some cross-disciplinary collaboration')
    } else {
        console.log('      • Dense network: High level of interdisciplinary collaboration')
    }
    
    if (stats.avgDegree < 3) {
        console.log('      • Low connectivity: Researchers have few direct collaborations')
    } else if (stats.avgDegree < 6) {
        console.log('      • Moderate connectivity: Typical academic collaboration pattern')
    } else {
        console.log('      • High connectivity: Very collaborative research environment')
    }
    
    return stats
}

/**
 * Demonstrate comparing different network structures
 */
async function demonstrateNetworkComparison() {
    console.log('\n🔀 Step 7: Comparing different network structures...')
    
    const analytics = new GraphAnalytics()
    
    // Create comparison networks
    const networks = {
        'Star Network': createStarNetwork(),
        'Ring Network': createRingNetwork(),
        'Complete Network': createCompleteNetwork(),
        'Random Network': createRandomNetwork()
    }
    
    console.log('   🔍 Analyzing different network topologies...')
    
    const comparisons = []
    
    for (const [networkName, dataset] of Object.entries(networks)) {
        console.log(`\n   📊 ${networkName}:`)
        
        const graph = analytics.buildGraphFromRDF(dataset, { undirected: true })
        const stats = analytics.computeGraphStatistics(graph)
        const kCore = analytics.computeKCore(graph)
        const centrality = analytics.computeBetweennessCentrality(graph)
        
        console.log(`      Nodes: ${stats.nodeCount}, Edges: ${stats.edgeCount}`)
        console.log(`      Density: ${(stats.density * 100).toFixed(1)}%, Avg Degree: ${stats.avgDegree.toFixed(1)}`)
        console.log(`      Max k-core: ${kCore.maxCore}, Max centrality: ${(centrality.maxCentrality * 100).toFixed(2)}%`)
        
        comparisons.push({
            name: networkName,
            density: stats.density,
            avgDegree: stats.avgDegree,
            maxCore: kCore.maxCore,
            maxCentrality: centrality.maxCentrality
        })
    }
    
    // Summary comparison
    console.log('\n   📋 Network Topology Comparison:')
    console.log('      Network          Density  Avg Degree  Max k-core  Max Centrality')
    console.log('      ' + '-'.repeat(70))
    
    for (const comp of comparisons) {
        const density = (comp.density * 100).toFixed(1).padEnd(7)
        const avgDegree = comp.avgDegree.toFixed(1).padEnd(11)
        const maxCore = String(comp.maxCore).padEnd(10)
        const maxCent = (comp.maxCentrality * 100).toFixed(2).padEnd(14)
        console.log(`      ${comp.name.padEnd(16)} ${density}% ${avgDegree} ${maxCore} ${maxCent}%`)
    }
    
    return comparisons
}

/**
 * Demonstrate RDF export of analysis results
 */
async function demonstrateRDFExport(analytics, kCoreResults, centralityResults, componentResults, stats) {
    console.log('\n📤 Step 8: Exporting analysis results to RDF...')
    
    // Create separate datasets for each analysis type
    const datasets = {
        kcore: rdf.dataset(),
        centrality: rdf.dataset(),
        components: rdf.dataset(),
        statistics: rdf.dataset()
    }
    
    console.log('   🔄 Exporting K-core results...')
    analytics.exportResultsToRDF(kCoreResults, datasets.kcore)
    
    console.log('   🔄 Exporting centrality results...')
    analytics.exportResultsToRDF(centralityResults, datasets.centrality)
    
    console.log('   🔄 Exporting statistics...')
    analytics.exportResultsToRDF(stats, datasets.statistics)
    
    // Manual export for components (not handled by exportResultsToRDF)
    const componentsAnalysisUri = `http://example.org/ragno/analysis/${Date.now()}`
    datasets.components.add(rdf.quad(
        rdf.namedNode(componentsAnalysisUri),
        rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        rdf.namedNode('http://purl.org/stuff/ragno/GraphAnalysis')
    ))
    
    datasets.components.add(rdf.quad(
        rdf.namedNode(componentsAnalysisUri),
        rdf.namedNode('http://purl.org/stuff/ragno/algorithm'),
        rdf.literal('connected-components')
    ))
    
    // Combine all datasets
    const combinedDataset = rdf.dataset()
    for (const dataset of Object.values(datasets)) {
        for (const quad of dataset) {
            combinedDataset.add(quad)
        }
    }
    
    console.log(`\n   📋 RDF Export Summary:`)
    console.log(`      • Total analysis triples: ${combinedDataset.size}`)
    console.log(`      • K-core triples: ${datasets.kcore.size}`)
    console.log(`      • Centrality triples: ${datasets.centrality.size}`)
    console.log(`      • Statistics triples: ${datasets.statistics.size}`)
    console.log(`      • Components triples: ${datasets.components.size}`)
    
    // Show sample RDF output
    console.log('\n   📄 Sample analysis RDF triples:')
    let tripleCount = 0
    for (const quad of combinedDataset) {
        if (tripleCount >= 8) break
        
        const subject = quad.subject.value.split('/').pop() || quad.subject.value
        const predicate = quad.predicate.value.split('/').pop() || quad.predicate.value.split('#').pop()
        const object = quad.object.value
        
        console.log(`      ${tripleCount + 1}. <${subject}> ${predicate} "${object}"`)
        tripleCount++
    }
    
    return combinedDataset
}

/**
 * Display final summary and insights
 */
function displayFinalSummary(analytics, allResults) {
    console.log('\n📈 Step 9: Final Analysis Summary and Insights')
    
    const stats = analytics.getStatistics()
    
    console.log('\n   📊 GraphAnalytics Session Statistics:')
    console.log(`      • Last analysis: ${stats.lastAnalysis}`)
    console.log(`      • Nodes processed: ${stats.nodeCount}`)
    console.log(`      • Edges processed: ${stats.edgeCount}`)
    console.log(`      • Components found: ${stats.components}`)
    
    console.log('\n   🔍 Key Research Network Insights:')
    
    if (allResults.kCore) {
        const maxCore = allResults.kCore.maxCore
        console.log(`      • Maximum k-core of ${maxCore} indicates ${maxCore >= 3 ? 'strong' : 'moderate'} research clusters`)
    }
    
    if (allResults.centrality && allResults.centrality.maxCentrality > 0.1) {
        console.log('      • High betweenness centrality reveals important bridge researchers')
        console.log('      • These individuals facilitate cross-disciplinary collaboration')
    }
    
    if (allResults.components && allResults.components.components.length === 1) {
        console.log('      • Single connected component indicates cohesive research community')
    } else if (allResults.components) {
        console.log(`      • ${allResults.components.components.length} components suggest research fragmentation`)
    }
    
    if (allResults.stats) {
        const density = allResults.stats.density
        if (density < 0.1) {
            console.log('      • Low network density suggests specialized research silos')
        } else {
            console.log('      • Network density indicates good interdisciplinary collaboration')
        }
    }
    
    console.log('\n   💡 GraphAnalytics Applications Demonstrated:')
    console.log('      • Research collaboration network analysis')
    console.log('      • Identification of key researchers and bridge nodes')
    console.log('      • Discovery of research clusters and communities')
    console.log('      • Network topology comparison and optimization')
    console.log('      • RDF-based graph analysis for semantic web integration')
    console.log('      • Scalable algorithms for large knowledge graphs')
    
    console.log('\n   🎯 Algorithm Performance Summary:')
    console.log('      • K-core: O(m) linear time complexity, excellent for large graphs')
    console.log('      • Betweenness: O(nm) time, identifies critical bridge nodes')
    console.log('      • Components: O(n+m) DFS traversal, fast connectivity analysis')
    console.log('      • Statistics: O(n+m) single pass, comprehensive metrics')
    console.log('      • RDF Integration: Seamless semantic web compatibility')
}

// Helper functions for creating comparison networks

function createStarNetwork() {
    const dataset = rdf.dataset()
    const ragno = 'http://purl.org/stuff/ragno/'
    const example = 'http://example.org/'
    
    // Central hub + 6 spokes
    const nodes = ['hub', 'spoke1', 'spoke2', 'spoke3', 'spoke4', 'spoke5', 'spoke6']
    
    // Add nodes
    for (const node of nodes) {
        dataset.add(rdf.quad(
            rdf.namedNode(example + node),
            rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            rdf.namedNode(ragno + 'Entity')
        ))
    }
    
    // Add star connections
    for (let i = 1; i < nodes.length; i++) {
        const relUri = example + `rel-star-${i}`
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), rdf.namedNode(ragno + 'Relationship')))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasSourceEntity'), rdf.namedNode(example + 'hub')))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasTargetEntity'), rdf.namedNode(example + nodes[i])))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasWeight'), rdf.literal(1.0)))
    }
    
    return dataset
}

function createRingNetwork() {
    const dataset = rdf.dataset()
    const ragno = 'http://purl.org/stuff/ragno/'
    const example = 'http://example.org/'
    
    const nodes = ['ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'ring6', 'ring7']
    
    // Add nodes
    for (const node of nodes) {
        dataset.add(rdf.quad(
            rdf.namedNode(example + node),
            rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            rdf.namedNode(ragno + 'Entity')
        ))
    }
    
    // Add ring connections
    for (let i = 0; i < nodes.length; i++) {
        const nextIndex = (i + 1) % nodes.length
        const relUri = example + `rel-ring-${i}`
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), rdf.namedNode(ragno + 'Relationship')))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasSourceEntity'), rdf.namedNode(example + nodes[i])))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasTargetEntity'), rdf.namedNode(example + nodes[nextIndex])))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasWeight'), rdf.literal(1.0)))
    }
    
    return dataset
}

function createCompleteNetwork() {
    const dataset = rdf.dataset()
    const ragno = 'http://purl.org/stuff/ragno/'
    const example = 'http://example.org/'
    
    const nodes = ['comp1', 'comp2', 'comp3', 'comp4', 'comp5']
    
    // Add nodes
    for (const node of nodes) {
        dataset.add(rdf.quad(
            rdf.namedNode(example + node),
            rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            rdf.namedNode(ragno + 'Entity')
        ))
    }
    
    // Add complete connections
    let relId = 0
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const relUri = example + `rel-comp-${relId++}`
            dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), rdf.namedNode(ragno + 'Relationship')))
            dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasSourceEntity'), rdf.namedNode(example + nodes[i])))
            dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasTargetEntity'), rdf.namedNode(example + nodes[j])))
            dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasWeight'), rdf.literal(1.0)))
        }
    }
    
    return dataset
}

function createRandomNetwork() {
    const dataset = rdf.dataset()
    const ragno = 'http://purl.org/stuff/ragno/'
    const example = 'http://example.org/'
    
    const nodes = ['rand1', 'rand2', 'rand3', 'rand4', 'rand5', 'rand6', 'rand7']
    
    // Add nodes
    for (const node of nodes) {
        dataset.add(rdf.quad(
            rdf.namedNode(example + node),
            rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            rdf.namedNode(ragno + 'Entity')
        ))
    }
    
    // Add random connections (seeded for consistency)
    const connections = [
        [0, 1], [1, 2], [2, 4], [3, 5], [4, 6], [0, 3], [1, 5], [2, 6]
    ]
    
    for (let i = 0; i < connections.length; i++) {
        const [from, to] = connections[i]
        const relUri = example + `rel-rand-${i}`
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), rdf.namedNode(ragno + 'Relationship')))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasSourceEntity'), rdf.namedNode(example + nodes[from])))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasTargetEntity'), rdf.namedNode(example + nodes[to])))
        dataset.add(rdf.quad(rdf.namedNode(relUri), rdf.namedNode(ragno + 'hasWeight'), rdf.literal(Math.random().toFixed(2))))
    }
    
    return dataset
}

/**
 * Main demo execution
 */
async function runDemo() {
    try {
        console.log('🚀 Starting GraphAnalytics comprehensive demo...\n')
        
        // Step 1: Create RDF dataset
        const rdfDataset = createResearchCollaborationRDF()
        
        // Step 2: Build graph and basic analysis
        const { analytics, graph } = await demonstrateGraphConstruction(rdfDataset)
        
        // Step 3: K-core decomposition
        const kCoreResults = await demonstrateKCoreAnalysis(analytics, graph)
        
        // Step 4: Betweenness centrality
        const centralityResults = await demonstrateBetweennessAnalysis(analytics, graph)
        
        // Step 5: Connected components
        const componentResults = await demonstrateComponentAnalysis(analytics, graph)
        
        // Step 6: Graph statistics
        const statsResults = await demonstrateGraphStatistics(analytics, graph)
        
        // Step 7: Network topology comparison
        const comparisons = await demonstrateNetworkComparison()
        
        // Step 8: RDF export
        const exportedRDF = await demonstrateRDFExport(analytics, kCoreResults, centralityResults, componentResults, statsResults)
        
        // Step 9: Final summary
        const allResults = {
            kCore: kCoreResults,
            centrality: centralityResults,
            components: componentResults,
            stats: statsResults,
            comparisons: comparisons
        }
        displayFinalSummary(analytics, allResults)
        
        console.log('\n' + '='.repeat(60))
        console.log('✅ GraphAnalytics Demo completed successfully!')
        console.log('🎉 All algorithms successfully analyzed the research collaboration network')
        console.log(`📊 Generated ${exportedRDF.size} RDF triples for semantic integration`)
        console.log('🔍 Revealed network structure, clusters, and key bridge nodes')
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