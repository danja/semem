/**
 * Unit tests for Inspect Display Components
 * Tests data formatting and result display methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock WorkbenchApp class for testing display methods
class MockWorkbenchApp {
  formatSessionResults(result) {
    const sessionInfo = result.zptState || result.sessionCache || result;
    
    return `
      <div class="session-info">
        <h5>Session State</h5>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Session ID:</span>
            <span class="value">${sessionInfo.sessionId || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="label">Zoom Level:</span>
            <span class="value">${sessionInfo.zoom || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="label">Interactions:</span>
            <span class="value">${sessionInfo.interactions || 0}</span>
          </div>
          <div class="info-item">
            <span class="label">Concepts:</span>
            <span class="value">${sessionInfo.concepts || 0}</span>
          </div>
        </div>
      </div>
      <div class="raw-data">
        <h5>Raw Data</h5>
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  formatConceptsResults(result) {
    const conceptCount = result.conceptCount || result.concepts?.length || 0;
    
    return `
      <div class="concepts-summary">
        <h5>Concepts Overview</h5>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Total Concepts:</span>
            <span class="value">${conceptCount}</span>
          </div>
          <div class="info-item">
            <span class="label">Storage Type:</span>
            <span class="value">${result.storageType || 'Unknown'}</span>
          </div>
        </div>
      </div>
      <div class="raw-data">
        <h5>Full Data</h5>
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  formatAllDataResults(result) {
    return `
      <div class="all-data-summary">
        <h5>Complete System State</h5>
        <div class="data-sections">
          ${Object.keys(result).map(section => `
            <div class="data-section">
              <h6>${section}</h6>
              <pre class="json-data">${JSON.stringify(result[section], null, 2)}</pre>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatGenericResults(result) {
    return `
      <div class="generic-results">
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  getRecordCount(result) {
    if (result.conceptCount) return result.conceptCount;
    if (result.concepts?.length) return result.concepts.length;
    if (result.sessionCache?.interactions) return result.sessionCache.interactions;
    if (Array.isArray(result)) return result.length;
    return Object.keys(result).length;
  }
}

describe('Inspect Display Components', () => {
  let workbench;
  let dom;
  let document;

  beforeEach(() => {
    // Setup JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;

    workbench = new MockWorkbenchApp();
  });

  describe('Session Results Formatting', () => {
    it('should format session results with zptState', () => {
      const sessionData = {
        zptState: {
          sessionId: 'session-123',
          zoom: 'entity',
          interactions: 5,
          concepts: 10
        }
      };

      const html = workbench.formatSessionResults(sessionData);
      
      expect(html).toContain('session-123');
      expect(html).toContain('entity');
      expect(html).toContain('5');
      expect(html).toContain('10');
      expect(html).toContain('Session State');
      expect(html).toContain('Raw Data');
    });

    it('should format session results with sessionCache', () => {
      const sessionData = {
        sessionCache: {
          interactions: 12,
          concepts: 8
        }
      };

      const html = workbench.formatSessionResults(sessionData);
      
      expect(html).toContain('12');
      expect(html).toContain('8');
      expect(html).toContain('N/A'); // sessionId and zoom should be N/A
    });

    it('should handle empty session data', () => {
      const html = workbench.formatSessionResults({});
      
      expect(html).toContain('N/A');
      expect(html).toContain('0');
      expect(html).toContain('{}'); // empty JSON
    });
  });

  describe('Concepts Results Formatting', () => {
    it('should format concepts with conceptCount', () => {
      const conceptsData = {
        conceptCount: 25,
        storageType: 'sparql'
      };

      const html = workbench.formatConceptsResults(conceptsData);
      
      expect(html).toContain('25');
      expect(html).toContain('sparql');
      expect(html).toContain('Concepts Overview');
      expect(html).toContain('Total Concepts');
    });

    it('should format concepts with array length', () => {
      const conceptsData = {
        concepts: ['ai', 'machine learning', 'data science'],
        storageType: 'memory'
      };

      const html = workbench.formatConceptsResults(conceptsData);
      
      expect(html).toContain('3'); // array length
      expect(html).toContain('memory');
    });

    it('should handle missing storage type', () => {
      const conceptsData = {
        conceptCount: 10
      };

      const html = workbench.formatConceptsResults(conceptsData);
      
      expect(html).toContain('Unknown');
    });
  });

  describe('All Data Results Formatting', () => {
    it('should format multiple data sections', () => {
      const allData = {
        sessionInfo: { interactions: 5 },
        systemHealth: { status: 'ok' },
        zptState: { zoom: 'entity' }
      };

      const html = workbench.formatAllDataResults(allData);
      
      expect(html).toContain('sessionInfo');
      expect(html).toContain('systemHealth');
      expect(html).toContain('zptState');
      expect(html).toContain('Complete System State');
    });

    it('should handle empty data object', () => {
      const html = workbench.formatAllDataResults({});
      
      expect(html).toContain('Complete System State');
      expect(html).toContain('data-sections');
    });
  });

  describe('Generic Results Formatting', () => {
    it('should format any object as JSON', () => {
      const data = { test: 'value', number: 42 };
      
      const html = workbench.formatGenericResults(data);
      
      expect(html).toContain('generic-results');
      expect(html).toContain('"test": "value"');
      expect(html).toContain('"number": 42');
    });
  });

  describe('Record Count Calculation', () => {
    it('should return conceptCount when available', () => {
      const result = { conceptCount: 15, concepts: ['a', 'b'] };
      expect(workbench.getRecordCount(result)).toBe(15);
    });

    it('should return concepts array length', () => {
      const result = { concepts: ['a', 'b', 'c'] };
      expect(workbench.getRecordCount(result)).toBe(3);
    });

    it('should return sessionCache interactions', () => {
      const result = { sessionCache: { interactions: 7 } };
      expect(workbench.getRecordCount(result)).toBe(7);
    });

    it('should return array length for arrays', () => {
      const result = [1, 2, 3, 4];
      expect(workbench.getRecordCount(result)).toBe(4);
    });

    it('should return object keys count', () => {
      const result = { a: 1, b: 2, c: 3 };
      expect(workbench.getRecordCount(result)).toBe(3);
    });

    it('should handle empty objects', () => {
      expect(workbench.getRecordCount({})).toBe(0);
      expect(workbench.getRecordCount([])).toBe(0);
    });
  });

  describe('HTML Structure Validation', () => {
    it('should generate valid HTML structure for session results', () => {
      const sessionData = {
        zptState: { sessionId: 'test', zoom: 'entity' }
      };
      
      const html = workbench.formatSessionResults(sessionData);
      
      // Parse HTML to verify structure
      document.body.innerHTML = html;
      
      expect(document.querySelector('.session-info')).toBeTruthy();
      expect(document.querySelector('.info-grid')).toBeTruthy();
      expect(document.querySelectorAll('.info-item')).toHaveLength(4);
      expect(document.querySelector('.raw-data')).toBeTruthy();
      expect(document.querySelector('.json-data')).toBeTruthy();
    });

    it('should escape HTML in JSON data', () => {
      const data = { 
        malicious: '<script>alert("xss")</script>',
        normal: 'safe content'
      };
      
      const html = workbench.formatGenericResults(data);
      
      // Should be JSON-encoded, not raw HTML
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });
  });
});