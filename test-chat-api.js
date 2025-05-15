#!/usr/bin/env node

/**
 * Simple test script for the chat API
 * 
 * Usage:
 *   node test-chat-api.js
 */

import fetch from 'node-fetch';
import logger from 'loglevel';

// Configure logging
logger.setLevel('info');

// API endpoint
const API_BASE = 'http://localhost:4100';

// Test prompts
const TEST_PROMPTS = [
  "Hello, how are you today?",
  "What can you tell me about semantic memory systems?",
  "Explain the SPARQL query language briefly"
];

// Test functions
async function testChatEndpoint() {
  try {
    console.log("=== Testing standard chat endpoint ===");
    
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: TEST_PROMPTS[0],
        temperature: 0.7,
        useMemory: true
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Chat request failed: ${response.status} ${errorData}`);
    }
    
    const data = await response.json();
    console.log("Response received:");
    console.log("- Conversation ID:", data.conversationId);
    console.log("- Response:", data.response.substring(0, 100) + "...");
    console.log("✓ Standard chat test passed");
    
    return data.conversationId;
  } catch (error) {
    console.error("✗ Standard chat test failed:", error.message);
    return null;
  }
}

async function testChatWithContextEndpoint(conversationId) {
  try {
    console.log("\n=== Testing chat with context endpoint ===");
    
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: TEST_PROMPTS[1],
        conversationId: conversationId,
        temperature: 0.7,
        useMemory: true,
        useSearchInterjection: true // Enable search interjection
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Chat with context request failed: ${response.status} ${errorData}`);
    }
    
    const data = await response.json();
    console.log("Response received with search context:");
    console.log("- Conversation ID:", data.conversationId);
    console.log("- Response:", data.response.substring(0, 100) + "...");
    
    if (data.searchResults && data.searchResults.length > 0) {
      console.log("- Search results found:", data.searchResults.length);
      console.log("  First result:", data.searchResults[0].title);
    } else {
      console.log("- No search results found");
    }
    
    console.log("✓ Chat with context test passed");
  } catch (error) {
    console.error("✗ Chat with context test failed:", error.message);
  }
}

async function testStreamingChatEndpoint() {
  try {
    console.log("\n=== Testing streaming chat endpoint ===");
    console.log("Streaming response (first chunk only):");
    
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: TEST_PROMPTS[2],
        temperature: 0.7,
        useMemory: true,
        useSearchInterjection: true
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Streaming chat request failed: ${response.status} ${errorData}`);
    }
    
    // We'll just read the first chunk to keep the test short
    const reader = response.body.getReader();
    const { value, done } = await reader.read();
    
    if (!done) {
      const decoder = new TextDecoder();
      const chunk = decoder.decode(value);
      console.log("First chunk received:", chunk);
      console.log("✓ Streaming test was able to connect (stopping after first chunk)");
    }
    
    // Clean up
    reader.cancel();
  } catch (error) {
    console.error("✗ Streaming chat test failed:", error.message);
  }
}

// Run all tests
async function runTests() {
  console.log("Starting chat API tests...");
  console.log(`Testing against API at ${API_BASE}\n`);
  
  try {
    // Test health endpoint first
    console.log("=== Testing API health ===");
    const healthResponse = await fetch(`${API_BASE}/api/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log("Health status:", healthData.status);
      console.log("Services:", healthData.services);
      console.log("✓ Health check passed");
    } else {
      console.error("✗ Health check failed:", healthResponse.status);
      return;
    }
    
    // Main tests
    const conversationId = await testChatEndpoint();
    
    if (conversationId) {
      await testChatWithContextEndpoint(conversationId);
    }
    
    await testStreamingChatEndpoint();
    
    console.log("\nAll tests completed.");
  } catch (error) {
    console.error("Test runner error:", error);
  }
}

// Execute tests
runTests();