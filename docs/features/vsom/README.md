# VSOM Visualization

## Overview
The VSOM (Vector Self-Organizing Map) Visualization provides an interactive way to explore and analyze high-dimensional data using self-organizing maps. This feature allows users to visualize, train, and analyze SOMs directly in the Semem UI.

## Features

### 1. SOM Grid Visualization
- Interactive grid display of the SOM nodes
- Zoom and pan functionality
- Node highlighting and tooltips
- Customizable appearance (colors, sizes, etc.)

### 2. Training Interface
- Start/stop training sessions
- Real-time training progress visualization
- Configurable training parameters

### 3. Feature Maps
- U-Matrix visualization
- Component plane visualization
- Interactive exploration of feature relationships

### 4. Clustering
- K-means clustering of SOM nodes
- Cluster visualization and analysis
- Interactive cluster exploration

## Architecture

The VSOM visualization is built with a modular architecture:

```
src/frontend/js/
├── components/vsom/
│   ├── BaseVisualization.js    # Base class for all visualizations
│   ├── VSOMVisualization.js    # Main container component
│   ├── SOMGrid/                # SOM grid visualization
│   ├── TrainingViz/            # Training visualization
│   ├── FeatureMaps/            # Feature maps visualization
│   └── Clustering/             # Clustering visualization
├── services/
│   └── VSOMService.js        # API service for VSOM operations
└── controllers/
    └── VSOMController.js     # Controller for the VSOM tab
```

## API Endpoints

The VSOM visualization interacts with the following API endpoints:

- `GET /api/vsom/grid/state` - Get current SOM grid state
- `POST /api/vsom/train` - Start SOM training
- `POST /api/vsom/train/stop` - Stop training
- `GET /api/vsom/feature-maps` - Get feature maps
- `POST /api/vsom/cluster` - Perform clustering

## Development

### Adding a New Visualization Type

1. Create a new directory in `src/frontend/js/components/vsom/` for your visualization
2. Create a class that extends `BaseVisualization`
3. Implement the required methods:
   - `init()` - Initialize the visualization
   - `update(data)` - Update with new data
   - `destroy()` - Clean up resources
   - `handleResize()` - Handle window resize

4. Add the visualization to `VSOMVisualization.js`:

```javascript
this.visualizationTypes.set('my-vis', {
  name: 'My Visualization',
  load: () => import('./MyVisualization/MyVisualization.js')
});
```

### Testing

Run the test suite with:

```bash
npm test
```

Test files are located in:
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`

## Performance Considerations

- Use Web Workers for expensive computations
- Implement data sampling for large datasets
- Use requestAnimationFrame for smooth animations
- Implement proper cleanup to prevent memory leaks

## Future Enhancements

- Support for different distance metrics
- Additional clustering algorithms
- Export/import of SOM models
- 3D visualization option
- Integration with other visualization libraries

## Troubleshooting

### Common Issues

1. **Visualization not loading**
   - Check browser console for errors
   - Verify API endpoints are accessible
   - Ensure required dependencies are loaded

2. **Performance problems**
   - Reduce dataset size
   - Disable animations for large datasets
   - Check for memory leaks

3. **Styling issues**
   - Check CSS specificity
   - Verify CSS is properly loaded
   - Check for conflicting styles
