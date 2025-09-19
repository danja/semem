<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Building a Node.js API for DuckDuckGo Search Integration

Based on my research, here's how to build a Node.js API using ES modules that interfaces with DuckDuckGo like a typical JSON API, designed for AI assistant integration.

## Project Setup

### Package.json Configuration

Create your `package.json` with ES module support[^1][^2]:

```json
{
  "name": "duckduckgo-api-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "duck-duck-scrape": "^2.2.7",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

The key configuration is `"type": "module"` which enables ES modules throughout your project[^3][^2].

## Core Server Implementation

### Main Server File (server.js)

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { search } from 'duck-duck-scrape';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting storage (simple in-memory for demo)
const rateLimitStore = new Map();
const RATE_LIMIT = 100; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Rate limiting middleware
const rateLimit = (req, res, next) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  
  if (!rateLimitStore.has(clientId)) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_WINDOW });
    return next();
  }
  
  const clientData = rateLimitStore.get(clientId);
  
  if (now > clientData.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_WINDOW });
    return next();
  }
  
  if (clientData.count >= RATE_LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Try again later.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
  
  clientData.count++;
  next();
};

// Search endpoint
app.post('/api/search', rateLimit, async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    // Input validation
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Query parameter is required and must be a non-empty string'
      });
    }
    
    // Sanitize query
    const sanitizedQuery = query.trim().substring(0, 500);
    
    // Configure search options
    const searchOptions = {
      safeSearch: options.safeSearch || 'moderate',
      region: options.region || 'us-en',
      ...options
    };
    
    // Perform search
    const searchResults = await search(sanitizedQuery, searchOptions);
    
    // Transform results for AI assistant consumption
    const transformedResults = {
      query: sanitizedQuery,
      timestamp: new Date().toISOString(),
      resultCount: searchResults.results?.length || 0,
      results: searchResults.results?.map((result, index) => ({
        id: index + 1,
        title: result.title?.replace(/&#x27;/g, "'").replace(/&quot;/g, '"') || '',
        url: result.url || '',
        description: result.description?.replace(/&#x27;/g, "'").replace(/&quot;/g, '"') || '',
        domain: new URL(result.url || 'https://example.com').hostname,
        relevanceScore: calculateRelevanceScore(result, sanitizedQuery)
      })) || [],
      relatedTopics: searchResults.related || [],
      instantAnswer: searchResults.abstract || null,
      searchMetadata: {
        safeSearch: searchOptions.safeSearch,
        region: searchOptions.region,
        processingTime: Date.now()
      }
    };
    
    res.json(transformedResults);
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: 'An error occurred while processing your search request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Helper function to calculate relevance score
function calculateRelevanceScore(result, query) {
  const queryWords = query.toLowerCase().split(/\s+/);
  const titleWords = (result.title || '').toLowerCase().split(/\s+/);
  const descWords = (result.description || '').toLowerCase().split(/\s+/);
  
  let score = 0;
  queryWords.forEach(word => {
    if (titleWords.includes(word)) score += 3;
    if (descWords.includes(word)) score += 1;
  });
  
  return Math.min(score / (queryWords.length * 4), 1); // Normalize to 0-1
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on our end'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

app.listen(PORT, () => {
  console.log(`DuckDuckGo API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
```


## Advanced Features for AI Integration

### Prompt Enhancement Module (utils/promptEnhancer.js)

```javascript
import { search } from 'duck-duck-scrape';

/**
 * Enhances user queries by merging them with relevant search results
 * Optimized for AI assistant consumption
 */
export class PromptEnhancer {
  constructor(options = {}) {
    this.maxResults = options.maxResults || 5;
    this.summaryLength = options.summaryLength || 200;
    this.includeUrls = options.includeUrls !== false;
  }

  async enhancePrompt(userQuery, searchQuery = null) {
    try {
      const queryToSearch = searchQuery || this.extractSearchableTerms(userQuery);
      
      if (!queryToSearch) {
        return {
          enhancedPrompt: userQuery,
          sources: [],
          confidence: 0
        };
      }

      const searchResults = await search(queryToSearch, {
        safeSearch: 'moderate',
        region: 'us-en'
      });

      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          enhancedPrompt: userQuery,
          sources: [],
          confidence: 0
        };
      }

      const relevantResults = this.filterAndRankResults(
        searchResults.results,
        userQuery
      ).slice(0, this.maxResults);

      const contextualInfo = this.buildContextualInformation(relevantResults);
      
      const enhancedPrompt = this.buildEnhancedPrompt(
        userQuery,
        contextualInfo,
        searchResults.abstract
      );

      return {
        enhancedPrompt,
        sources: relevantResults.map(r => ({
          title: r.title,
          url: this.includeUrls ? r.url : null,
          snippet: r.description?.substring(0, this.summaryLength)
        })),
        confidence: this.calculateConfidence(relevantResults, userQuery),
        searchQuery: queryToSearch,
        instantAnswer: searchResults.abstract
      };

    } catch (error) {
      console.error('Prompt enhancement error:', error);
      return {
        enhancedPrompt: userQuery,
        sources: [],
        confidence: 0,
        error: 'Failed to enhance prompt with search results'
      };
    }
  }

  extractSearchableTerms(query) {
    // Remove question words and extract key terms
    const stopWords = new Set([
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could',
      'should', 'would', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5) // Limit to 5 key terms
      .join(' ');
  }

  filterAndRankResults(results, originalQuery) {
    const queryWords = originalQuery.toLowerCase().split(/\s+/);
    
    return results
      .map(result => ({
        ...result,
        relevanceScore: this.calculateDetailedRelevance(result, queryWords)
      }))
      .filter(result => result.relevanceScore > 0.1)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  calculateDetailedRelevance(result, queryWords) {
    const title = (result.title || '').toLowerCase();
    const desc = (result.description || '').toLowerCase();
    const url = (result.url || '').toLowerCase();
    
    let score = 0;
    let totalPossible = 0;
    
    queryWords.forEach(word => {
      totalPossible += 10; // Max possible score per word
      
      // Title matches (highest weight)
      if (title.includes(word)) score += 5;
      
      // Description matches
      if (desc.includes(word)) score += 3;
      
      // URL matches
      if (url.includes(word)) score += 2;
      
      // Exact phrase matching bonus
      if (title.includes(queryWords.join(' '))) score += 3;
    });
    
    return totalPossible > 0 ? score / totalPossible : 0;
  }

  buildContextualInformation(results) {
    return results.map((result, index) => {
      const snippet = result.description || '';
      const cleanSnippet = snippet
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .substring(0, this.summaryLength);
      
      return `[${index + 1}] ${result.title}: ${cleanSnippet}`;
    }).join('\n\n');
  }

  buildEnhancedPrompt(originalQuery, contextInfo, instantAnswer) {
    let enhanced = originalQuery;
    
    if (instantAnswer) {
      enhanced += `\n\nInstant Answer: ${instantAnswer}`;
    }
    
    if (contextInfo.trim()) {
      enhanced += `\n\nRelevant Information:\n${contextInfo}`;
    }
    
    enhanced += '\n\nPlease provide a comprehensive response based on the above information.';
    
    return enhanced;
  }

  calculateConfidence(results, query) {
    if (results.length === 0) return 0;
    
    const avgRelevance = results.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / results.length;
    const countFactor = Math.min(results.length / this.maxResults, 1);
    
    return Math.round((avgRelevance * countFactor) * 100) / 100;
  }
}

// Usage in your main API
app.post('/api/enhance-prompt', rateLimit, async (req, res) => {
  try {
    const { userQuery, searchQuery, options = {} } = req.body;
    
    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'userQuery is required and must be a string'
      });
    }
    
    const enhancer = new PromptEnhancer(options);
    const result = await enhancer.enhancePrompt(userQuery, searchQuery);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    });
    
  } catch (error) {
    console.error('Prompt enhancement error:', error);
    res.status(500).json({
      error: 'Enhancement failed',
      message: 'Failed to enhance prompt with search data'
    });
  }
});
```


## Environment Configuration (.env)

```bash
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=3600000
```


## Key Features for AI Integration

### 1. Structured Response Format[^4][^5]

The API returns consistently structured JSON responses that are easy for AI assistants to parse and understand.

### 2. Rate Limiting and Security[^6][^7]

Built-in rate limiting prevents abuse while CORS configuration ensures secure cross-origin requests.

### 3. Prompt Enhancement[^8]

The `/api/enhance-prompt` endpoint specifically merges user queries with search results to create informed prompts for AI processing.

### 4. Error Handling[^9][^10]

Comprehensive error handling ensures reliable API responses even when DuckDuckGo searches fail.

### 5. Relevance Scoring

Custom relevance scoring helps prioritize the most useful search results for AI consumption.

## Usage Examples

### Basic Search Request

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "latest developments in AI", "options": {"safeSearch": "strict"}}'
```


### Prompt Enhancement Request

```bash
curl -X POST http://localhost:3000/api/enhance-prompt \
  -H "Content-Type: application/json" \
  -d '{"userQuery": "How does machine learning work?", "options": {"maxResults": 3}}'
```


## Alternative Approaches

If you need more comprehensive search results, consider using unofficial scraping libraries like `duck-duck-scrape`[^8] or implementing a CORS proxy[^11][^12] to access DuckDuckGo's instant answer API directly at `https://api.duckduckgo.com`[^13][^14].

For production deployments, you might also want to implement caching, database storage for search history, and more sophisticated rate limiting using Redis[^15][^6].

This implementation provides a robust foundation for integrating DuckDuckGo search capabilities into AI assistant workflows while maintaining performance, security, and reliability standards appropriate for production use.
<span style="display:none">[^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58][^59]</span>

<div style="text-align: center">⁂</div>

[^1]: https://blog.arcjet.com/a-modern-approach-to-secure-apis-with-node-js-express-typescript-and-esm/

[^2]: https://nodejs.org/api/esm.html

[^3]: https://www.w3schools.com/nodejs/nodejs_modules_esm.asp

[^4]: https://www.linkedin.com/pulse/how-use-expressjs-expressjson-function-middleware-ripon-mondal-wzwrc

[^5]: https://expressjs.com/en/api.html

[^6]: https://dev.to/dhruvil_joshi14/expressjs-performance-optimization-top-best-practices-to-consider-in-2025-2k6k

[^7]: https://www.linkedin.com/pulse/mastering-expressjs-best-practices-building-f87vf

[^8]: https://github.com/Snazzah/duck-duck-scrape

[^9]: https://www.geeksforgeeks.org/node-js/handling-requests-and-responses-in-node-js/

[^10]: https://www.geeksforgeeks.org/web-tech/express-js-express-json-function/

[^11]: https://dev.to/decker67/write-your-own-cors-proxy-with-nodejs-in-no-time-30f9

[^12]: https://github.com/Rob--W/cors-anywhere

[^13]: https://www.reddit.com/r/duckduckgo/comments/1lpz0cz/am_i_allowed_to_use_the_api_to_perform_searches/

[^14]: https://stackoverflow.com/questions/37012469/duckduckgo-api-getting-search-results

[^15]: https://www.wisp.blog/blog/best-places-to-host-expressjs-apps-in-2025-a-comprehensive-guide

[^16]: https://lumetrium.com/definer/wiki/sources/ddg-ia/

[^17]: https://www.searchapi.io/docs/duckduckgo-api

[^18]: https://github.com/stevesoltys/duckduckgo

[^19]: https://duckduckgo.com/duckduckgo-help-pages/features/instant-answers-and-other-features/

[^20]: https://www.youtube.com/watch?v=mUr_4BRQ328

[^21]: https://promptql.io/docs/recipes/tutorials/duckduckgo-web-search/

[^22]: https://duckduckgo.com/duckduckgo-help-pages/settings/params/

[^23]: https://github.com/Babbili/duckduck-search

[^24]: https://community.n8n.io/t/new-node-duckduckgo-search-integration-for-n8n/140446

[^25]: https://github.com/topics/duckduckgo-api?l=javascript

[^26]: https://apicontext.com/api-directory/search/duckduckgo/

[^27]: https://docs.scrapingdog.com/duckduckgo-scraper-api/duckduckgo-search-api

[^28]: https://hardesty.ai/tools/duckduckgo-image-scraper

[^29]: https://js.langchain.com/docs/integrations/tools/duckduckgo_search/

[^30]: https://www.reddit.com/r/node/comments/1jiid4/nodeddg_a_nodejs_wrapper_for_the_duckduckgo_api/

[^31]: https://www.postman.com/api-evangelist/duckduckgo/documentation/i9r819s/duckduckgo-instant-answer-api

[^32]: https://www.npmjs.com/search?q=duckduckgo

[^33]: https://rayobyte.com/community/discussion/how-to-scrape-search-results-using-a-duckduckgo-proxy-with-javascript/

[^34]: https://www.npmjs.com/package/@kie-tools/cors-proxy

[^35]: https://www.abstractapi.com/guides/other/web-scraping-node-js

[^36]: https://mcpmarket.com/server/duckduckgo

[^37]: https://stackoverflow.com/questions/62743570/using-es6-modules-in-express

[^38]: https://github.com/ccoenraets/cors-proxy

[^39]: https://blog.appsignal.com/2024/12/11/a-deep-dive-into-commonjs-and-es-modules-in-nodejs.html

[^40]: https://duck-duck-scrape.js.org

[^41]: https://serpapi.com/blog/adding-a-node-js-backend-to-handle-api-interactions-for-a-frontend-application/

[^42]: https://bandojay.hashnode.dev/create-a-web-server-in-nodejs-using-express-and-the-es6-module

[^43]: https://www.pulsemcp.com/servers/surya-madhav-web-scraper-ddg-search

[^44]: https://www.npmjs.com/package/local-cors-proxy

[^45]: https://expressjs.com

[^46]: https://serpapi.com/blog/how-to-scrape-duckduckgo-results/

[^47]: https://www.dhiwise.com/post/express-js-folder-structure-best-practices-for-clean-code

[^48]: https://www.haikel-fazzani.eu.org/blog/post/nodejs-send-http-request

[^49]: https://www.w3schools.com/nodejs/nodejs_http.asp

[^50]: https://expressjs.com/en/guide/using-middleware.html

[^51]: https://blog.logrocket.com/5-ways-make-http-requests-node-js/

[^52]: https://www.moesif.com/blog/technical/logging/How-we-built-a-Nodejs-Middleware-to-Log-HTTP-API-Requests-and-Responses/

[^53]: https://dev.to/moibra/best-practices-for-structuring-an-expressjs-project-148i

[^54]: https://nodejs.org/api/http.html

[^55]: https://stackoverflow.com/questions/72527795/how-to-perform-an-api-call-from-a-middleware-in-express-nodejs

[^56]: https://www.reddit.com/r/node/comments/1hm314y/nodejs_2025_guide_how_to_setup_expressjs_with/

[^57]: https://stackoverflow.com/questions/6158933/how-is-an-http-post-request-made-in-node-js

[^58]: https://betterstack.com/community/guides/scaling-nodejs/express-web-api/

[^59]: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Express_Nodejs/deployment

