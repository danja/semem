# Claude : Memory System with ZPT Navigation Implementation

## Context-Aware Memory That Adapts to Your Perspective

If you've worked with large language models, you've likely experienced the frustration of context windows that forget earlier parts of your conversation, or the challenge of helping an AI system understand which pieces of information are relevant to your current task. The Semem project addresses these limitations by implementing a persistent semantic memory system with a novel navigation paradigm called ZPT (Zoom-Pan-Tilt).

## What We've Built

At its core, Semem stores conversations, documents, and extracted concepts in a knowledge graph using RDF/SPARQL technology. But rather than requiring users to write complex graph queries, we've implemented an intuitive spatial metaphor for navigating this knowledge space.

The ZPT system works like adjusting a camera:

- **Zoom** controls the level of abstraction: from individual entities and concepts, up through semantic units, full documents, topic communities, and the entire corpus
- **Pan** filters the domain: temporal ranges, keywords, specific entities, or subject areas
- **Tilt** changes the view style: keyword-based summaries, embedding similarity clusters, graph relationships, or temporal sequences

## A Real Scenario: Research Assistant Workflow

Consider Sarah, a researcher studying the intersection of ADHD and creativity. She's been having ongoing conversations with an AI assistant about her work, importing research papers, and storing insights. Here's how the ZPT system adapts to her changing needs:

**Week 1 - Initial Research**
Sarah starts by telling the system about ADHD research papers she's reading. The system extracts concepts like "attention deficit," "hyperactivity," "executive function," and stores them with vector embeddings for semantic similarity.

**Week 2 - Discovering Patterns** 
When Sarah asks "What connections exist between ADHD traits and creative problem-solving?", she uses:
- **Zoom**: Entity level (individual concepts and their relationships)
- **Pan**: Keywords filtered to "ADHD, creativity, cognitive flexibility"
- **Tilt**: Graph view to see relationship networks

The system retrieves not just her recent conversations, but connects concepts from papers she read weeks ago, showing how "divergent thinking" relates to both "ADHD traits" and "creative output."

**Week 3 - Writing Phase**
Now writing a literature review, Sarah shifts her perspective:
- **Zoom**: Document level (full papers and substantial text chunks)
- **Pan**: Temporal filter for "papers published 2020-2024"
- **Tilt**: Temporal view to see how ideas evolved over time

The same underlying knowledge graph serves both use cases, but the navigation system surfaces different aspects based on her current context.

## Technical Implementation

The system uses several key components working together:

**Document Ingestion**: Research papers, blog posts, or other documents get chunked semantically and stored with embeddings. Concepts are extracted and linked in the knowledge graph.

**Conversation Memory**: Every interaction is stored with context about what was discussed, when, and how it relates to existing knowledge.

**Ragno Layer**: This component decomposes text into semantic units, entities, and relationships using RDF standards, making knowledge machine-readable and queryable.

**ZPT Navigation**: The spatial metaphor translates user intentions into precise graph queries without requiring technical expertise.

## Current Capabilities

Today, you can:
- Ingest documents from SPARQL endpoints or direct upload
- Have ongoing conversations that remember context across sessions
- Use the web-based workbench to chunk documents and ask questions
- Navigate your knowledge space using the ZPT controls
- Get contextually relevant answers that draw from your entire knowledge history

The system runs locally or in containerized deployments, with support for multiple LLM providers (Mistral, Claude, Ollama) and persistent storage in SPARQL triple stores.

## What Makes This Different

Unlike simple RAG (Retrieval-Augmented Generation) systems that match queries to document chunks, or conversational systems that maintain only recent context, this approach treats knowledge as a navigable space. You're not just searching—you're exploring from different vantage points.

The semantic web foundation means your knowledge connects not just through text similarity, but through meaningful relationships between concepts. When you ask about "attention mechanisms," the system understands connections to both "neural attention in AI models" and "cognitive attention in psychology" based on how you've used these concepts in context.

The result is an AI assistant that grows more useful over time, building a persistent understanding of your interests, expertise, and the conceptual frameworks you use to think about problems. Your conversations and documents become part of a queryable knowledge space that adapts its presentation to match your current perspective and goals.

## Development Progress

This implementation completes the core memory management system that has been in development. The workbench UI now provides full access to:

- Memory storage and retrieval through the Ask/Tell interface
- Document chunking via the Augment operations
- ZPT navigation controls for filtering and organizing knowledge
- Real-time console monitoring of memory operations
- Cross-session persistence with intelligent relevance scoring

The test workflow validation confirmed end-to-end functionality from document ingestion through semantic chunking to contextual question answering, demonstrating that the system successfully retrieves specific information from previously stored context.

Next development phases will focus on adaptive relevance learning, contextual memory clustering, and collaborative memory spaces for team-based knowledge management.