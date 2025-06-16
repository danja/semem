// Test script to debug GraphVisualizer
console.log('=== GraphVisualizer Debug Test ===');

// Check if components are available
console.log('sparqlBrowser available:', !!window.sparqlBrowser);
console.log('eventBus available:', !!window.eventBus);
console.log('EVENTS available:', !!window.EVENTS);

if (window.sparqlBrowser) {
    console.log('graphVisualizer available:', !!window.sparqlBrowser.graphVisualizer);
    
    // Check graph container
    const graphContainer = document.getElementById('rdf-graph-container');
    console.log('Graph container found:', !!graphContainer);
    if (graphContainer) {
        console.log('Graph container dimensions:', graphContainer.offsetWidth, 'x', graphContainer.offsetHeight);
        console.log('Graph container style.height:', graphContainer.style.height);
        console.log('Graph container computed height:', getComputedStyle(graphContainer).height);
    }
    
    // Try to manually trigger event
    const testRDF = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:knows ex:bob .

ex:bob a foaf:Person ;
    foaf:name "Bob Jones" ;
    foaf:knows ex:alice .`;

    console.log('Emitting MODEL_SYNCED event manually...');
    if (window.eventBus && window.EVENTS) {
        window.eventBus.emit(window.EVENTS.MODEL_SYNCED, testRDF);
        console.log('EVENT EMITTED');
    }
    
    // Try direct updateGraph call
    if (window.sparqlBrowser.graphVisualizer && window.sparqlBrowser.graphVisualizer.updateGraph) {
        console.log('Calling updateGraph directly...');
        try {
            window.sparqlBrowser.graphVisualizer.updateGraph(testRDF);
            console.log('Direct updateGraph call completed');
        } catch (error) {
            console.error('Direct updateGraph call failed:', error);
        }
    }
} else {
    console.log('sparqlBrowser not available - need to initialize first');
}