import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vsomService } from '../../../src/frontend/js/services/VSOMService.js';

describe('VSOMService', () => {
  const mockResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data)
  });

  beforeEach(() => {
    global.fetch = vi.fn();
    vi.clearAllMocks();
  });

  describe('getGridState', () => {
    it('should fetch the current SOM grid state', async () => {
      const mockData = {
        nodes: [
          { id: 'node1', x: 0, y: 0, activation: 0.5, weight: [0.1, 0.2, 0.3] },
          { id: 'node2', x: 0, y: 1, activation: 0.7, weight: [0.4, 0.5, 0.6] }
        ]
      };
      
      fetch.mockResolvedValue(mockResponse(mockData));
      
      const result = await vsomService.getGridState();
      
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/vsom/grid/state'), expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('should handle API errors', async () => {
      fetch.mockResolvedValue(mockResponse({ error: 'Not found' }, 404));
      
      await expect(vsomService.getGridState()).rejects.toThrow('HTTP error! status: 404');
    });
  });

  describe('train', () => {
    it('should start SOM training with provided data', async () => {
      const trainingData = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
      const options = { epochs: 100, learningRate: 0.1 };
      const mockResponseData = { status: 'training_started' };
      
      fetch.mockResolvedValue(mockResponse(mockResponseData));
      
      const result = await vsomService.train(trainingData, options);
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vsom/train'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: trainingData, options })
        })
      );
      expect(result).toEqual(mockResponseData);
    });
  });

  describe('stopTraining', () => {
    it('should stop the current training session', async () => {
      const mockResponseData = { status: 'training_stopped' };
      fetch.mockResolvedValue(mockResponse(mockResponseData));
      
      const result = await vsomService.stopTraining();
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vsom/train/stop'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(mockResponseData);
    });
  });

  describe('getFeatureMaps', () => {
    it('should fetch feature maps', async () => {
      const mockMaps = {
        umatrix: [[0.1, 0.2], [0.3, 0.4]],
        componentPlanes: {
          feature1: [[0.1, 0.2], [0.3, 0.4]],
          feature2: [[0.5, 0.6], [0.7, 0.8]]
        }
      };
      
      fetch.mockResolvedValue(mockResponse(mockMaps));
      
      const result = await vsomService.getFeatureMaps();
      
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/vsom/feature-maps'), expect.any(Object));
      expect(result).toEqual(mockMaps);
    });
  });

  describe('cluster', () => {
    it('should perform clustering on the SOM', async () => {
      const options = { method: 'kmeans', params: { k: 5 } };
      const mockClusters = {
        clusters: [
          { id: 0, nodes: ['node1', 'node2'], centroid: [0.3, 0.4, 0.5] },
          { id: 1, nodes: ['node3', 'node4'], centroid: [0.6, 0.7, 0.8] }
        ]
      };
      
      fetch.mockResolvedValue(mockResponse(mockClusters));
      
      const result = await vsomService.cluster(options);
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vsom/cluster'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(options)
        })
      );
      expect(result).toEqual(mockClusters);
    });
  });
});
