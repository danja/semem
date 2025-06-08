
import dotenv from 'dotenv'
import { createClient } from 'hyperdata-clients';
import Config from '../../engine/Config.js';

// Load environment variables from .env file
dotenv.config()

const provider = this.getProperty(ns.trn.provider, 'mistral')
const modelName = this.getProperty(ns.trn.model, 'open-codestral-mamba') // mistral-7b-instruct-v0.1


// Get API key mapping from config
const config = Config.getInstance();
const apiKeyVars = config.get('API_KEYS') || {};

// Get the appropriate API key from environment variables
const apiKeyVar = apiKeyVars[provider] || 'MISTRAL_API_KEY';
const apiKey = process.env[apiKeyVar];

if (!apiKey) {
    throw new Error(`API key not found in environment variables. Please set ${apiKeyVar}`);
}

const clientOptions = {
    model: modelName,
    apiKey: apiKey
}


//    const client = await clients.ClientFactory.createAPIClient(provider, clientOptions)
const client = await createClient(provider, clientOptions)
const prompt = message.content || "hello"
const response = await client.chat([
    { role: 'user', content: prompt }
])
