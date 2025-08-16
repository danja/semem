/**
 * Integration tests for lazy storage workflow
 * Tests the complete lazy storage and processing pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { spawn } from 'child_process'
import { setTimeout } from 'timers/promises'

describe('Lazy Storage Integration Tests', () => {
  let serverProcess
  const baseUrl = 'http://localhost:4102'
  
  beforeEach(async () => {
    // Start MCP server on test port
    serverProcess = spawn('node', ['mcp/http-server.js'], {
      env: { ...process.env, MCP_PORT: '4102', NODE_ENV: 'test' },
      stdio: 'pipe'
    })
    
    // Wait for server to start
    await setTimeout(2000)
  })

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      await setTimeout(500)
    }
  })

  describe('Complete Lazy Workflow', () => {
    it('should store content lazily and process it later', async () => {
      // Step 1: Store content with lazy flag
      const tellResponse = await request(baseUrl)
        .post('/tell')
        .send({
          content: 'Integration test content for lazy storage workflow',
          type: 'concept',
          lazy: true,
          metadata: {
            title: 'Integration Test',
            tags: 'test,integration,lazy'
          }
        })
        .expect(200)

      expect(tellResponse.body.success).toBe(true)
      expect(tellResponse.body.lazy).toBe(true)
      expect(tellResponse.body.concepts).toBe(0) // No concepts extracted yet
      expect(tellResponse.body.message).toContain('lazily')

      // Step 2: Verify content was stored but not processed
      expect(tellResponse.body.stored).toBe(true)
      expect(tellResponse.body.sessionCached).toBe(false) // Lazy content not cached

      // Step 3: Process lazy content using augment
      const augmentResponse = await request(baseUrl)
        .post('/augment')
        .send({
          target: 'all',
          operation: 'process_lazy',
          options: { limit: 5 }
        })
        .expect(200)

      expect(augmentResponse.body.success).toBe(true)
      expect(augmentResponse.body.operation).toBe('process_lazy')
      expect(augmentResponse.body.result.augmentationType).toBe('process_lazy')
      
      // Should have processed items
      const result = augmentResponse.body.result
      expect(result.totalProcessed).toBeGreaterThan(0)
      expect(result.processedItems).toBeInstanceOf(Array)
      
      if (result.processedItems.length > 0) {
        const processedItem = result.processedItems[0]
        expect(processedItem).toHaveProperty('id')
        expect(processedItem).toHaveProperty('conceptCount')
        expect(processedItem.conceptCount).toBeGreaterThan(0)
      }
    })

    it('should handle multiple lazy items in batch', async () => {
      // Store multiple lazy items
      const items = [
        'First lazy test item for batch processing',
        'Second lazy test item with different content',
        'Third lazy test item to verify batch handling'
      ]

      const storePromises = items.map((content, index) =>
        request(baseUrl)
          .post('/tell')
          .send({
            content,
            type: 'concept',
            lazy: true,
            metadata: { title: `Batch Item ${index + 1}` }
          })
      )

      const storeResponses = await Promise.all(storePromises)
      
      // Verify all items were stored lazily
      storeResponses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.lazy).toBe(true)
        expect(response.body.concepts).toBe(0)
      })

      // Process all lazy content
      const augmentResponse = await request(baseUrl)
        .post('/augment')
        .send({
          target: 'all',
          operation: 'process_lazy',
          options: { limit: 10 }
        })
        .expect(200)

      expect(augmentResponse.body.success).toBe(true)
      const result = augmentResponse.body.result
      expect(result.totalProcessed).toBeGreaterThanOrEqual(3)
      expect(result.processedItems.length).toBeGreaterThanOrEqual(3)
    })

    it('should handle lazy storage performance vs normal storage', async () => {
      const testContent = 'Performance comparison test content for lazy vs normal storage'

      // Test lazy storage timing
      const lazyStart = Date.now()
      const lazyResponse = await request(baseUrl)
        .post('/tell')
        .send({
          content: testContent,
          type: 'concept',
          lazy: true,
          metadata: { title: 'Lazy Performance Test' }
        })
      const lazyDuration = Date.now() - lazyStart

      expect(lazyResponse.status).toBe(200)
      expect(lazyResponse.body.lazy).toBe(true)

      // Test normal storage timing
      const normalStart = Date.now()
      const normalResponse = await request(baseUrl)
        .post('/tell')
        .send({
          content: testContent,
          type: 'concept',
          lazy: false,
          metadata: { title: 'Normal Performance Test' }
        })
      const normalDuration = Date.now() - normalStart

      expect(normalResponse.status).toBe(200)
      expect(normalResponse.body.lazy).toBe(false)
      expect(normalResponse.body.concepts).toBeGreaterThan(0)

      // Lazy should be significantly faster
      expect(lazyDuration).toBeLessThan(normalDuration)
      console.log(`Performance: Lazy ${lazyDuration}ms vs Normal ${normalDuration}ms`)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing content in lazy storage', async () => {
      const response = await request(baseUrl)
        .post('/tell')
        .send({
          type: 'concept',
          lazy: true,
          metadata: { title: 'Missing Content Test' }
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Content is required')
    })

    it('should handle process_lazy with no lazy content', async () => {
      // First clear any existing lazy content by processing all
      await request(baseUrl)
        .post('/augment')
        .send({
          target: 'all',
          operation: 'process_lazy',
          options: { limit: 100 }
        })

      // Try to process again (should find no lazy content)
      const response = await request(baseUrl)
        .post('/augment')
        .send({
          target: 'all',
          operation: 'process_lazy',
          options: { limit: 5 }
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      const result = response.body.result
      expect(result.totalProcessed).toBe(0)
      expect(result.processedItems).toEqual([])
      expect(result.message).toContain('No lazy content found')
    })

    it('should validate lazy parameter types', async () => {
      const response = await request(baseUrl)
        .post('/tell')
        .send({
          content: 'Test content',
          type: 'concept',
          lazy: 'invalid', // Should be boolean
          metadata: {}
        })

      // Should still work but treat as false
      expect(response.status).toBe(200)
      expect(response.body.lazy).toBe(false)
    })
  })

  describe('API Consistency', () => {
    it('should maintain consistent response format for lazy operations', async () => {
      const tellResponse = await request(baseUrl)
        .post('/tell')
        .send({
          content: 'API consistency test content',
          type: 'concept', 
          lazy: true,
          metadata: { title: 'API Test' }
        })
        .expect(200)

      // Verify response structure
      expect(tellResponse.body).toHaveProperty('success')
      expect(tellResponse.body).toHaveProperty('verb')
      expect(tellResponse.body).toHaveProperty('type')
      expect(tellResponse.body).toHaveProperty('lazy')
      expect(tellResponse.body).toHaveProperty('stored')
      expect(tellResponse.body).toHaveProperty('contentLength')
      expect(tellResponse.body).toHaveProperty('concepts')
      expect(tellResponse.body).toHaveProperty('message')
      expect(tellResponse.body).toHaveProperty('zptState')

      expect(tellResponse.body.verb).toBe('tell')
      expect(tellResponse.body.lazy).toBe(true)
      expect(tellResponse.body.stored).toBe(true)
    })

    it('should handle augment API consistency for process_lazy', async () => {
      const response = await request(baseUrl)
        .post('/augment')
        .send({
          target: 'all',
          operation: 'process_lazy',
          options: { limit: 1 }
        })
        .expect(200)

      // Verify response structure
      expect(response.body).toHaveProperty('success')
      expect(response.body).toHaveProperty('verb')
      expect(response.body).toHaveProperty('target')
      expect(response.body).toHaveProperty('operation')
      expect(response.body).toHaveProperty('result')
      expect(response.body).toHaveProperty('zptState')

      expect(response.body.verb).toBe('augment')
      expect(response.body.operation).toBe('process_lazy')
      expect(response.body.target).toBe('all')
    })
  })
})