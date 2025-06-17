// Export all VSOM components for easier importing
export { VSOMVisualization } from './VSOMVisualization.js';
export { TrainingViz } from './TrainingViz/TrainingViz.js';
export { FeatureMaps } from './FeatureMaps/FeatureMaps.js';
export { Clustering } from './Clustering/Clustering.js';
// Add any additional VSOM component exports here

export default {
  VSOMVisualization: () => import('./VSOMVisualization.js'),
  TrainingViz: () => import('./TrainingViz/TrainingViz.js'),
  FeatureMaps: () => import('./FeatureMaps/FeatureMaps.js'),
  Clustering: () => import('./Clustering/Clustering.js'),
  // Add any additional VSOM component lazy-loading exports here
};
