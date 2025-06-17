# VSOM Visualization Integration Plan

## Overview

This plan outlines the integration of VSOM.js (Vector Self-Organizing Map) visualizations into the Semem UI, reusing the existing memory visualization components and architecture established in Phase 3.

## Current State Analysis

### Existing Infrastructure (Phase 3)
- ✅ **Memory Visualization Tab**: Complete with 4 sub-tabs
- ✅ **D3.js Integration**: Professional visualization library integrated
- ✅ **API Architecture**: RESTful endpoints for visualization data
- ✅ **Responsive CSS Framework**: Mobile-friendly visualization containers
- ✅ **Component Architecture**: Modular JavaScript components
- ✅ **Error Handling**: Graceful fallbacks and loading states

### VSOM Requirements
- **Data Source**: HTTP API interface to VSOM.js functionality
- **Visualization Types**: SOM grids, feature maps, clustering results
- **Interactivity**: Node selection, training visualization, parameter controls
- **Integration**: Seamless fit within existing Semem UI framework

## Implementation Plan

### Phase 1: VSOM Tab Structure (Priority 1)
**Goal**: Create new VSOM tab with sub-tab structure similar to Memory Viz

**Tasks**:
1. Add VSOM tab to main navigation
2. Create 4 VSOM-specific sub-tabs:
   - **SOM Grid**: Self-organizing map visualization
   - **Training**: Real-time training visualization
   - **Feature Maps**: Component plane visualizations  
   - **Clustering**: Data clustering results
3. Reuse CSS framework from Memory Viz
4. Set up container structure for D3.js visualizations

**Files to Modify**:
- `src/frontend/index.template.html` - Add VSOM tab and content
- `src/frontend/styles/main.css` - Extend with VSOM-specific styles
- `src/frontend/js/app.js` - Initialize VSOM components

### Phase 2: VSOM HTTP API Integration (Priority 1)
**Goal**: Create API endpoints that interface with VSOM.js via HTTP

**Tasks**:
1. Research VSOM.js API and capabilities
2. Create HTTP API wrapper for VSOM functionality
3. Implement RESTful endpoints in UIServer.js:
   - `POST /api/vsom/create` - Initialize new SOM
   - `POST /api/vsom/train` - Train SOM with data
   - `GET /api/vsom/grid` - Get SOM grid state
   - `GET /api/vsom/features` - Get feature maps
   - `POST /api/vsom/cluster` - Perform clustering
4. Set up data transformation between Semem and VSOM formats

**Files to Create/Modify**:
- `src/services/vsom/VSOMService.js` - VSOM.js integration service
- `src/services/search/UIServer.js` - Add VSOM API endpoints
- `package.json` - Add VSOM.js dependency

### Phase 3: Visualization Components (Priority 2)
**Goal**: Implement interactive VSOM visualizations using D3.js

**Tasks**:
1. Create VSOMVisualizationManager class (reuse MemoryVisualizationManager pattern)
2. Implement SOM grid visualization with D3.js
3. Create training animation component
4. Build feature map visualizations
5. Implement clustering result display
6. Add interactive controls (training parameters, grid size, etc.)

**Files to Create**:
- `src/frontend/js/components/vsomVisualization.js` - Main VSOM visualization component
- Reuse existing D3.js patterns and CSS framework

### Phase 4: Data Integration (Priority 2)  
**Goal**: Connect VSOM visualizations to Semem data sources

**Tasks**:
1. Create data adapters for Semem → VSOM format conversion
2. Integrate with memory embeddings for SOM training
3. Connect concept data to feature map generation
4. Enable real-time data updates
5. Implement data export/import functionality

**Files to Modify**:
- `src/services/vsom/VSOMService.js` - Add data integration methods
- Memory API endpoints - Expose data in VSOM-compatible format

## Technical Architecture

### Component Structure
```
VSOM Tab
├── SOM Grid (D3.js hexagonal/rectangular grid)
├── Training (Real-time training visualization)
├── Feature Maps (Component plane heatmaps)
└── Clustering (Cluster visualization with colors)
```

### API Architecture
```
VSOM HTTP API
├── VSOMService.js (VSOM.js wrapper)
├── UIServer endpoints (RESTful API)
├── Data transformation layer
└── Real-time updates (WebSocket optional)
```

### Data Flow
```
Semem Memory Data → Data Adapter → VSOM API → VSOM.js → Visualization Data → D3.js Components
```

## VSOM.js Integration Strategy

### HTTP API Interface Options
1. **Node.js Child Process**: Spawn VSOM.js as subprocess with HTTP communication
2. **Express Middleware**: Integrate VSOM.js directly into Node.js server
3. **Microservice**: Separate VSOM service with HTTP API
4. **WebAssembly**: Compile VSOM to WASM for browser execution

**Recommended**: Express Middleware for simplicity and performance

### Data Transport Format
```javascript
// SOM Configuration
{
  gridWidth: 10,
  gridHeight: 10,
  learningRate: 0.1,
  neighborhoodRadius: 3,
  iterations: 1000
}

// Training Data
{
  vectors: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
  labels: ["sample1", "sample2"],
  metadata: [{"type": "memory"}, {"type": "concept"}]
}

// SOM Grid Response
{
  nodes: [
    {x: 0, y: 0, weights: [0.1, 0.2], activation: 0.8},
    {x: 1, y: 0, weights: [0.3, 0.4], activation: 0.6}
  ],
  topology: "hexagonal",
  trainingProgress: 0.85
}
```

## Visualization Types

### 1. SOM Grid Visualization
- **Purpose**: Display trained SOM grid with node activations
- **Features**: 
  - Hexagonal or rectangular grid layout
  - Color-coded activation levels
  - Click nodes to see details
  - Zoom and pan support
- **D3.js Components**: SVG grid, color scales, interactive elements

### 2. Training Visualization
- **Purpose**: Real-time training progress and convergence
- **Features**:
  - Training error over time
  - Learning rate adaptation
  - Neighborhood radius decay
  - Progress indicators
- **D3.js Components**: Line charts, progress bars, animations

### 3. Feature Maps
- **Purpose**: Component plane visualization for each input dimension
- **Features**:
  - Heatmap for each feature dimension
  - Multiple feature planes in grid layout
  - Color-coded feature strength
  - Feature correlation analysis
- **D3.js Components**: Heatmaps, color legends, grid layouts

### 4. Clustering Results
- **Purpose**: Display clustered data and SOM-based groupings
- **Features**:
  - Cluster boundaries on SOM grid
  - Data point assignments
  - Cluster statistics and metrics
  - Interactive cluster selection
- **D3.js Components**: Cluster overlays, data point markers, statistics panels

## Design Principles

### Code Reuse Strategy
1. **Component Inheritance**
   - Create a base `BaseVisualization` class with common functionality
   - Extend for specific visualizations (SOMGrid, TrainingViz, etc.)
   - Reuse D3 utility functions from existing visualizations

2. **Shared Utilities**
   - Centralize common functions in `src/frontend/js/utils/`
   - Create reusable D3 components in `src/frontend/js/components/common/`
   - Share color schemes and styling with existing visualizations

3. **Service Layer**
   - Abstract VSOM.js interactions behind a service interface
   - Reuse HTTP client and error handling from existing services
   - Implement data transformation as pure functions for testability

### Modular Architecture
```
src/frontend/js/
  components/
    vsom/
      VSOMVisualization.js     # Main container component
      SOMGrid/                # SOM Grid visualization
      TrainingViz/            # Training visualization
      FeatureMaps/            # Feature maps visualization
      Clustering/             # Clustering visualization
    common/                   # Shared components
  services/
    VSOMService.js          # VSOM.js wrapper
    VSOMDataAdapter.js       # Data transformation
  utils/
    d3-helpers.js           # Reusable D3 utilities
    logging.js               # Logging utilities
```

### Logging Strategy
1. **Log Levels**
   ```javascript
   import log from 'loglevel';
   
   // Set default log level
   const logger = log.getLogger('vsom');
   logger.setLevel('debug');  // Default to debug in development
   
   // Example usage
   logger.debug('Initializing SOM grid with size:', { width, height });
   logger.info('Training started with parameters:', trainingParams);
   logger.warn('Slow performance detected during training');
   logger.error('Failed to initialize VSOM:', error);
   ```

2. **Key Logging Points**
   - Component lifecycle events (mount/update/unmount)
   - API request/response cycles
   - User interactions (selections, parameter changes)
   - Performance metrics (training time, render time)
   - Error conditions with stack traces
   - State changes in complex components

3. **Production Configuration**
   - Set log level to 'warn' or 'error' in production
   - Implement log aggregation for production monitoring
   - Include session IDs for correlating client-side logs

## Progress Tracking

### Current Status (2024-06-17)
- [ ] Phase 1: VSOM Tab Structure
  - [ ] Add VSOM tab to main navigation
  - [ ] Create VSOM sub-tabs structure
  - [ ] Set up container structure for visualizations

- [ ] Phase 2: VSOM HTTP API Integration
  - [ ] Research VSOM.js API and capabilities
  - [ ] Create HTTP API wrapper for VSOM functionality
  - [ ] Implement RESTful endpoints in UIServer.js

- [ ] Phase 3: Visualization Components
  - [ ] Create VSOMVisualizationManager class
  - [ ] Implement SOM grid visualization
  - [ ] Build training visualization
  - [ ] Create feature map visualizations
  - [ ] Implement clustering visualization

- [ ] Phase 4: Data Integration
  - [ ] Create data adapters for Semem → VSOM format
  - [ ] Integrate with memory embeddings
  - [ ] Connect concept data to feature maps
  - [ ] Implement real-time data updates

### Next Steps (Immediate)
1. Complete Phase 1 tasks by setting up the basic VSOM tab structure
2. Research VSOM.js API requirements for HTTP integration
3. Design data transformation layer between Semem and VSOM formats

### Notes
- Reuse existing D3.js visualization patterns from Memory Visualization
- Ensure responsive design works across different screen sizes
- Plan for WebSocket integration for real-time training updates

## User Experience Design

### Navigation Flow
```
Main Tabs → VSOM → [SOM Grid | Training | Feature Maps | Clustering]
```

### Control Panels
- **SOM Configuration**: Grid size, topology, learning parameters
- **Training Controls**: Start/stop, iterations, real-time updates
- **Visualization Options**: Color schemes, grid style, animation speed
- **Data Selection**: Choose data source (memories, embeddings, concepts)

### Responsive Design
- **Desktop**: Full-featured visualization with detailed controls
- **Tablet**: Optimized layout with essential controls
- **Mobile**: Simplified view with touch-friendly interface

## Data Sources

### Semem Integration Points
1. **Memory Embeddings**: Use memory vectors for SOM training
2. **Concept Vectors**: Train SOM on extracted concepts
3. **Chat Embeddings**: Visualize conversation patterns
4. **Search Results**: Display semantic similarity clusters

### Sample Data Scenarios
1. **Memory Organization**: Visualize how memories cluster by topic
2. **Concept Maps**: Show relationships between extracted concepts  
3. **Conversation Patterns**: Analyze chat interaction patterns
4. **Knowledge Exploration**: Navigate semantic space visually

## Implementation Timeline

### Week 1: Foundation
- [ ] Research VSOM.js capabilities and API
- [ ] Create VSOM tab structure in UI
- [ ] Set up basic HTTP API endpoints
- [ ] Establish development environment

### Week 2: Core Integration
- [ ] Implement VSOM.js HTTP wrapper service
- [ ] Create basic SOM grid visualization
- [ ] Connect to Semem data sources
- [ ] Test end-to-end data flow

### Week 3: Advanced Features
- [ ] Add training visualization
- [ ] Implement feature maps
- [ ] Create clustering display
- [ ] Add interactive controls

### Week 4: Polish & Testing
- [ ] Responsive design optimization
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] User testing and feedback

## Success Criteria

### Functional Requirements
- [ ] VSOM tab integrated into Semem UI
- [ ] All 4 sub-tabs functional with visualizations
- [ ] HTTP API successfully interfaces with VSOM.js
- [ ] Data flows from Semem to VSOM visualizations
- [ ] Interactive controls work correctly

### Technical Requirements
- [ ] Reuses existing Memory Viz component architecture
- [ ] D3.js visualizations render correctly
- [ ] Responsive design works on all devices
- [ ] API endpoints return proper JSON responses
- [ ] Error handling prevents crashes

### User Experience Requirements
- [ ] Intuitive navigation between visualization types
- [ ] Clear visual feedback during operations
- [ ] Helpful tooltips and documentation
- [ ] Fast loading and smooth interactions
- [ ] Consistent with existing UI patterns

## Risk Mitigation

### Technical Risks
- **VSOM.js Integration Complexity**: Start with simple API wrapper, expand gradually
- **Performance Issues**: Implement data limits and progressive loading
- **Browser Compatibility**: Test D3.js visualizations across browsers
- **Memory Usage**: Optimize large dataset handling

### Timeline Risks  
- **API Development Delays**: Prioritize core functionality first
- **Visualization Complexity**: Use existing D3.js patterns when possible
- **Integration Issues**: Plan for additional testing time

## Future Enhancements

### Phase 5: Advanced Features (Future)
- Real-time SOM training with WebSocket updates
- 3D SOM visualizations using Three.js
- Export/import SOM models
- Batch processing capabilities
- Advanced clustering algorithms

### Phase 6: Machine Learning Integration (Future)
- Automated hyperparameter tuning
- SOM quality metrics and validation
- Integration with other ML algorithms
- Predictive analytics features

---

## Status Tracking

### Current Status: Implementation Phase
- [x] Plan created and documented
- [x] VSOM.js research completed
- [ ] UI structure implementation
- [ ] HTTP API development
- [ ] Visualization components
- [ ] Testing and optimization

### VSOM.js Analysis Complete

**Key Capabilities Discovered**:
- Self-organizing map with configurable topology (rectangular/hexagonal)
- Entity clustering and visualization coordinate generation
- Integration with Ragno knowledge graphs and RDF export
- Support for multiple data sources (entities, SPARQL, VectorIndex)
- Training with configurable parameters and progress tracking
- Export to visualization formats (coordinates, JSON, CSV)

**API Methods Available**:
- `loadFromEntities()` - Load data from entity arrays
- `train()` - Train the SOM with progress callbacks
- `getClusters()` - Generate cluster assignments
- `getNodeMappings()` - Get entity-to-map-position mappings
- `exportVisualization()` - Get visualization coordinates
- `getStatistics()` - Get training and performance stats

### Next Steps
1. Create VSOM tab structure in UI ← **CURRENT**
2. Implement HTTP API wrapper for VSOM.js
3. Begin SOM grid visualization development
4. Add training and clustering visualizations

---

*This plan will be updated as implementation progresses and requirements evolve.*