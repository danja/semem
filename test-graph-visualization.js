#!/usr/bin/env node

import { chromium } from 'playwright';

async function testGraphVisualization() {
  console.log('🚀 Starting SPARQL Browser graph visualization test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the application
    console.log('📍 Navigating to http://localhost:9000');
    await page.goto('http://localhost:9000');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Click on SPARQL Browser tab
    console.log('🔍 Clicking SPARQL Browser tab');
    await page.click('button:has-text("SPARQL Browser")');
    
    // Wait for SPARQL browser to initialize
    await page.waitForTimeout(2000);
    
    // Click on Edit RDF tab to check sample data
    console.log('📝 Clicking Edit RDF tab');
    await page.click('button:has-text("Edit RDF")');
    await page.waitForTimeout(1000);
    
    // Check if turtle editor has sample data
    const turtleEditor = page.locator('#turtle-editor');
    const editorContent = await turtleEditor.inputValue();
    
    console.log('📊 Turtle editor content length:', editorContent.length);
    console.log('📄 Sample content:', editorContent.substring(0, 200) + '...');
    
    if (editorContent.includes('@prefix foaf:') && editorContent.includes('ex:alice')) {
      console.log('✅ Sample RDF data is present');
    } else {
      console.log('❌ Sample RDF data not found');
    }
    
    // Click on Graph tab
    console.log('📊 Clicking Graph tab');
    await page.click('button:has-text("Graph")');
    
    // Wait for graph to render
    await page.waitForTimeout(3000);
    
    // Check if graph container exists and has content
    const graphContainer = page.locator('#rdf-graph-container');
    const isVisible = await graphContainer.isVisible();
    
    console.log('🔍 Graph container visible:', isVisible);
    
    // Check node and edge counts
    const nodeCount = await page.locator('#node-count').textContent();
    const edgeCount = await page.locator('#edge-count').textContent();
    
    console.log('📊 Node count:', nodeCount);
    console.log('📊 Edge count:', edgeCount);
    
    // Check if graph has actual content
    const nodeCountNum = parseInt(nodeCount || '0');
    const edgeCountNum = parseInt(edgeCount || '0');
    
    if (nodeCountNum > 0 && edgeCountNum > 0) {
      console.log('✅ Graph visualization is working! Nodes:', nodeCountNum, 'Edges:', edgeCountNum);
    } else {
      console.log('❌ Graph visualization issue - zero nodes or edges');
    }
    
    // Take a screenshot for verification
    await page.screenshot({ path: '/tmp/sparql-browser-test.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/sparql-browser-test.png');
    
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testGraphVisualization().catch(console.error);