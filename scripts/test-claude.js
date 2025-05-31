#!/usr/bin/env node

// Load environment variables from .env.claude
require('dotenv').config({ path: '../.env.claude' });

import { Anthropic } from '@anthropic-ai/sdk';

async function testClaude() {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY is not set in environment variables');
    }

    const model = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';
    
    console.log('Initializing Claude client...');
    const client = new Anthropic({
      apiKey: apiKey,
    });

    console.log(`Sending test message to ${model}...`);
    const response = await client.messages.create({
      model: model,
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: 'Hello, Claude! Can you tell me a short joke?'
        }
      ]
    });

    console.log('\n=== Claude Response ===');
    console.log(response.content[0].text);
    console.log('========================');
    
  } catch (error) {
    console.error('Error testing Claude:', error);
    process.exit(1);
  }
}

testClaude();
