# Semem UI - User Guide

**Semem** (Semantic Memory) is an intelligent agent memory management system that integrates large language models (LLMs) with semantic web technologies (RDF/SPARQL). This guide will help you get started with the web-based user interface.

## 🚀 Quick Start

1. **Start the UI Server**:
   ```bash
   npm run start:ui
   ```
   The interface will be available at: http://localhost:4120

2. **Start the MCP Server** (optional, for advanced features):
   ```bash
   npm run mcp:http
   ```
   MCP server runs on: http://localhost:3000

## 📋 Interface Overview

The Semem UI provides 9 main tabs, each offering different capabilities:

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| **Search** | Semantic content search | Vector similarity, threshold control |
| **Memory** | Store and search memories | Prompt/response pairs, metadata |
| **Memory Viz** | Visualize memory relationships | Interactive graphs, timelines, clusters |
| **Chat** | AI conversation interface | Multiple providers, streaming, MCP tools |
| **Embeddings** | Generate vector embeddings | Text-to-vector conversion |
| **Concepts** | Extract key concepts | LLM-powered concept identification |
| **Index** | Content indexing | Add searchable content |
| **Settings** | System configuration | Storage backends, model selection |
| **MCP Client** | Model Context Protocol | Tool integration, resource management |
| **SPARQL Browser** | RDF data exploration | Query, visualize, edit RDF graphs |

---

## 🔍 Search Tab

**Purpose**: Find semantically similar content using vector embeddings.

### How to Use:
1. Enter your search query in the text field
2. Adjust the similarity threshold (0.0 = loose, 1.0 = exact)
3. Set the number of results (5-20)
4. Optionally specify content types
5. Click **Search**

### Sample Queries:
```
machine learning algorithms
natural language processing
semantic web technologies
AI agent memory management
knowledge graph construction
```

### Tips:
- Use descriptive phrases rather than single words
- Threshold 0.7 is good for most searches
- Lower thresholds find more diverse results

---

## 🧠 Memory Tab

**Purpose**: Store and retrieve conversation memories with semantic search.

### Store Memory:
1. Go to the **Store** sub-tab
2. Enter a **Prompt** (user question/input)
3. Enter a **Response** (AI or system response)
4. Add **Metadata** (optional JSON):
   ```json
   {
     "category": "programming",
     "importance": "high",
     "tags": ["javascript", "tutorial"]
   }
   ```
5. Click **Store Memory**

### Search Memories:
1. Go to the **Search** sub-tab
2. Enter your search query
3. Adjust similarity threshold
4. Click **Search Memory**

### Sample Memory Pairs:

**Prompt**: "How do I create a REST API in Node.js?"
**Response**: "To create a REST API in Node.js, use Express.js framework. Install it with 'npm install express', then create routes using app.get(), app.post(), etc. Define endpoints like '/api/users' and return JSON responses."

**Prompt**: "Explain semantic web concepts"
**Response**: "The semantic web uses RDF (Resource Description Framework) to create machine-readable data. Key technologies include SPARQL for querying, OWL for ontologies, and URI/IRI for unique resource identification."

---

## 📊 Memory Visualization Tab

**Purpose**: Explore memory relationships through interactive visualizations.

### Memory Graph:
- **Interactive network** showing memories (blue/green) and concepts (orange)
- **Drag nodes** to explore relationships
- **Click nodes** to see details
- **Adjust similarity threshold** to show/hide connections

### Timeline:
- **Time-series view** of memory creation and access patterns
- **Period selection**: Day, Week, Month, All Time
- **Grouping options**: Hour, Day, Week, Month
- **Access patterns**: Shows memory usage frequency

### Clusters:
- **Semantic grouping** of related memories
- **Multiple clustering methods**: K-means, Semantic, Temporal
- **Visual clusters** with size and color coding
- **Cluster statistics** and analysis

### Advanced Search:
- **Multi-field search**: Prompts, responses, concepts
- **Date range filters**: From/to dates with presets
- **Property filters**: Access count, similarity, frequency
- **Export results** for further analysis

### Getting Started:
1. First, add some memories using the **Memory** tab
2. Go to **Memory Viz** → **Memory Graph**
3. Click **Load Memory Graph** to see your data visualized
4. Explore other visualization types

---

## 💬 Chat Tab

**Purpose**: Interactive AI conversations with multiple providers and MCP tool integration.

### Providers Available:
- **Mistral AI**: Fast, capable model
- **Claude (Hyperdata)**: Anthropic's Claude via proxy
- **Ollama**: Local models (requires Ollama installation)
- **Claude Direct**: Direct Anthropic API
- **OpenAI**: GPT models (configuration required)

### Standard Chat:
1. Select a **Provider** from the dropdown
2. Adjust **Temperature** (0.0 = focused, 2.0 = creative)
3. Toggle **Use Memory** to include conversation history
4. Type your message and click **Send**

### Streaming Chat:
1. Switch to **Streaming** sub-tab
2. Same controls as Standard Chat
3. Responses appear in real-time as they're generated

### Sample Prompts:

**Getting Started**:
```
Hello! Can you help me understand how semantic memory works?
```

**Technical Questions**:
```
Explain the difference between RDF and JSON-LD
How do vector embeddings enable semantic search?
What are the advantages of using SPARQL over SQL for knowledge graphs?
```

**Practical Tasks**:
```
Help me design a knowledge graph for a library management system
Generate sample RDF data for a product catalog
Write a SPARQL query to find all books by authors born after 1950
```

**MCP Tool Usage** (when MCP server is connected):
```
Use the memory tools to store this conversation
Extract concepts from the following text: [your text here]
Search for memories related to "machine learning"
```

### MCP Integration:
- Look for 🔗 symbol next to provider names
- MCP-enabled providers can use tools like memory storage, concept extraction
- Tool usage is shown with colored badges in responses

---

## 🔢 Embeddings Tab

**Purpose**: Generate vector embeddings for text analysis and similarity comparison.

### How to Use:
1. Enter text in the **Text** field
2. Optionally specify an embedding **Model**
3. Click **Generate Embedding**
4. View the vector dimensions and preview
5. Copy the full vector for use in other applications

### Sample Texts:
```
Natural language processing enables computers to understand human language.

The semantic web represents a web of data that can be processed by machines.

Machine learning algorithms learn patterns from data to make predictions.

Knowledge graphs store information as interconnected entities and relationships.
```

### Use Cases:
- **Similarity Analysis**: Compare embeddings to find related content
- **Clustering**: Group similar texts together
- **Search**: Use embeddings for semantic search
- **Classification**: Train models using embedding features

---

## 🧩 Concepts Tab

**Purpose**: Extract key concepts and topics from text using AI analysis.

### How to Use:
1. Enter text in the **Text** field
2. Click **Extract Concepts**
3. View the identified concepts and their relevance

### Sample Texts:

**Technical Article**:
```
Artificial intelligence systems use neural networks to process information similar to the human brain. Deep learning, a subset of machine learning, employs multiple layers of artificial neurons to learn complex patterns from data. These systems excel at tasks like image recognition, natural language processing, and decision making.
```

**Business Document**:
```
Our company's digital transformation strategy focuses on cloud computing, data analytics, and customer experience optimization. We're implementing microservices architecture, adopting DevOps practices, and leveraging artificial intelligence to improve operational efficiency and competitive advantage.
```

### Expected Concepts:
- **Technical**: neural networks, deep learning, machine learning, AI
- **Business**: digital transformation, cloud computing, microservices, DevOps

---

## 📑 Index Tab

**Purpose**: Add content to the searchable index for semantic retrieval.

### How to Use:
1. Enter a **Title** for the content
2. Add the main **Content** text
3. Specify **Content Type** (e.g., article, document, tutorial)
4. Add **Metadata** (optional JSON):
   ```json
   {
     "author": "John Doe",
     "category": "tutorial",
     "difficulty": "beginner",
     "tags": ["javascript", "web-development"]
   }
   ```
5. Click **Index Content**

### Sample Content:

**Article**:
- **Title**: "Introduction to Semantic Web Technologies"
- **Type**: "article"
- **Content**: "The semantic web is an extension of the World Wide Web through standards..."

**Tutorial**:
- **Title**: "Building REST APIs with Express.js"
- **Type**: "tutorial"
- **Content**: "This tutorial covers creating RESTful web services using Node.js and Express..."

**Documentation**:
- **Title**: "SPARQL Query Language Reference"
- **Type**: "documentation"
- **Content**: "SPARQL is a query language for RDF data. Basic query structure includes..."

---

## ⚙️ Settings Tab

**Purpose**: Configure system storage, models, and providers.

### Storage Backends:
- **In-Memory**: Fast, temporary (data lost on restart)
- **JSON File**: Persistent local storage
- **SPARQL Store**: RDF database integration
- **In-Memory Store**: Transient storage for testing

### Model Configuration:
- **Chat Provider**: Choose default AI provider
- **Chat Model**: Specific model name
- **Embedding Provider**: Vector embedding service
- **Embedding Model**: Embedding model name

### SPARQL Configuration:
- **Endpoint Selection**: Choose from configured SPARQL endpoints
- **Custom Endpoints**: Add your own SPARQL servers
- **Authentication**: Username/password for secured endpoints

### Sample Configuration:
```json
{
  "storage": "json",
  "chatProvider": "ollama",
  "chatModel": "qwen2:1.5b",
  "embeddingProvider": "ollama",
  "embeddingModel": "nomic-embed-text"
}
```

---

## 🔗 MCP Client Tab

**Purpose**: Manage Model Context Protocol connections and tools.

### Connection:
1. Ensure MCP server is running: `npm run mcp:http`
2. Enter server URL: `http://localhost:3000`
3. Click **Connect**

### Features:
- **Server Information**: View MCP server details and capabilities
- **Tool Discovery**: Browse available MCP tools
- **Resource Management**: Access MCP resources
- **Prompt Templates**: Use predefined prompts

### Available Tools (when connected):
- Memory storage and retrieval
- Concept extraction
- Context management
- Configuration management
- Storage statistics

---

## 🌐 SPARQL Browser Tab

**Purpose**: Query, visualize, and manage RDF data using SPARQL.

### Query Sub-tab:

#### Sample SPARQL Queries:

**Basic Pattern Matching**:
```sparql
SELECT ?subject ?predicate ?object
WHERE {
  ?subject ?predicate ?object
}
LIMIT 10
```

**Find All Types**:
```sparql
SELECT DISTINCT ?type
WHERE {
  ?entity a ?type
}
```

**Count Entities by Type**:
```sparql
SELECT ?type (COUNT(?entity) AS ?count)
WHERE {
  ?entity a ?type
}
GROUP BY ?type
ORDER BY DESC(?count)
```

**Memory-Related Queries**:
```sparql
# Find all memory interactions
SELECT ?memory ?prompt ?response ?timestamp
WHERE {
  ?memory a semem:Interaction ;
          semem:hasPrompt ?prompt ;
          semem:hasResponse ?response ;
          semem:timestamp ?timestamp .
}
ORDER BY DESC(?timestamp)
```

```sparql
# Find memories with specific concepts
SELECT ?memory ?concept
WHERE {
  ?memory semem:hasConcept ?concept .
  FILTER(CONTAINS(LCASE(STR(?concept)), "machine learning"))
}
```

**Knowledge Graph Queries**:
```sparql
# Find related entities
SELECT ?entity1 ?relation ?entity2
WHERE {
  ?entity1 ?relation ?entity2 .
  FILTER(?entity1 != ?entity2)
}
LIMIT 20
```

### Graph Sub-tab:

**Graph Visualization**:
1. Enter a **Graph Query** (URI or CONSTRUCT query)
2. Set **Depth** (1-5) for relationship traversal
3. Set **Node Limit** to control graph size
4. Click **Load Graph**

**Sample Graph Queries**:
```sparql
# Construct a simple graph
CONSTRUCT {
  ?s ?p ?o
}
WHERE {
  ?s ?p ?o
}
LIMIT 50
```

```sparql
# Entity relationships
CONSTRUCT {
  ?entity1 ?relation ?entity2
}
WHERE {
  ?entity1 ?relation ?entity2 .
  FILTER(?entity1 != ?entity2)
}
```

### Edit RDF Sub-tab:

**Sample RDF Content** (Turtle format):
```turtle
@prefix ex: <http://example.org/> .
@prefix semem: <http://purl.org/stuff/semem/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:memory001 a semem:Interaction ;
    semem:hasPrompt "What is semantic web?" ;
    semem:hasResponse "The semantic web is an extension of the web..." ;
    semem:timestamp "2024-01-15T10:30:00Z" ;
    semem:hasConcept ex:semanticWeb, ex:rdf .

ex:semanticWeb a semem:Concept ;
    rdfs:label "Semantic Web" .

ex:rdf a semem:Concept ;
    rdfs:label "RDF" .
```

**Memory Data in RDF**:
```turtle
@prefix semem: <http://purl.org/stuff/semem/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

semem:interaction_001 a semem:Interaction ;
    semem:hasPrompt "How do neural networks work?" ;
    semem:hasResponse "Neural networks are computational models inspired by biological neural networks..." ;
    semem:timestamp "2024-01-15T14:20:00Z"^^xsd:dateTime ;
    semem:accessCount 5 ;
    semem:hasConcept semem:concept_neural_networks, semem:concept_machine_learning .

semem:concept_neural_networks a semem:Concept ;
    rdfs:label "Neural Networks" ;
    semem:weight 0.85 .
```

### Endpoints Sub-tab:

**Adding Custom Endpoints**:
1. **Name**: "My SPARQL Endpoint"
2. **Query URL**: "http://localhost:3030/dataset/query"
3. **Update URL**: "http://localhost:3030/dataset/update"
4. **Username/Password**: For authenticated endpoints
5. Click **Add Endpoint**

---

## 🎯 Common Workflows

### 1. Basic Memory Management:
1. **Chat** → Have conversations with AI
2. **Memory** → Store important exchanges
3. **Memory Viz** → Visualize relationships
4. **Search** → Find related content

### 2. Knowledge Building:
1. **Index** → Add reference content
2. **Concepts** → Extract key topics
3. **SPARQL Browser** → Structure as RDF
4. **Search** → Semantic retrieval

### 3. AI-Powered Analysis:
1. **Embeddings** → Generate vectors for text
2. **Chat** → Use AI for analysis tasks
3. **MCP Client** → Leverage specialized tools
4. **Memory Viz** → Explore patterns

### 4. Data Exploration:
1. **SPARQL Browser** → Query RDF data
2. **Memory Viz** → Visual analysis
3. **Search** → Find similar content
4. **Concepts** → Identify themes

---

## 🛠️ Tips and Best Practices

### Memory Management:
- Store meaningful conversation exchanges
- Use descriptive prompts and responses
- Add metadata for better organization
- Regular use improves semantic relationships

### Search Optimization:
- Use natural language queries
- Experiment with similarity thresholds
- Combine with concept extraction
- Leverage embeddings for similarity

### SPARQL Usage:
- Start with simple SELECT queries
- Use LIMIT to control result size
- Explore with DESCRIBE and CONSTRUCT
- Build complex queries incrementally

### Chat Effectiveness:
- Choose appropriate providers for tasks
- Adjust temperature based on need
- Enable memory for context continuity
- Use MCP tools for specialized functions

### Visualization:
- Start with small datasets
- Adjust thresholds to manage complexity
- Use clusters to identify themes
- Combine multiple view types

---

## 🚨 Troubleshooting

### Common Issues:

**Server Not Starting**:
```bash
# Check if port is in use
lsof -i :4120
# Kill existing processes
npm run start:ui
```

**No Search Results**:
- Check similarity threshold (try 0.5)
- Ensure content is indexed
- Verify embeddings are generated

**Empty Visualizations**:
- Add memories first via Memory tab
- Check API endpoints are responding
- Verify data exists in storage

**SPARQL Errors**:
- Check endpoint connectivity
- Validate query syntax
- Ensure proper authentication

**MCP Connection Issues**:
- Start MCP server: `npm run mcp:http`
- Check server URL: `http://localhost:3000`
- Verify no firewall blocking

### Getting Help:

1. **Check Logs**: Server console output
2. **Browser Console**: F12 → Console tab
3. **Network Tab**: Check API responses
4. **Health Check**: Visit `/api/health`

---

## 📚 Additional Resources

- **GitHub Repository**: https://github.com/danja/semem
- **SPARQL Tutorial**: https://www.w3.org/TR/sparql11-query/
- **RDF Primer**: https://www.w3.org/TR/rdf11-primer/
- **MCP Specification**: https://modelcontextprotocol.io/

---

**Happy exploring with Semem!** 🚀

The system learns and improves as you use it. The more memories you create and the more you interact with the semantic features, the better it becomes at understanding and retrieving relevant information.