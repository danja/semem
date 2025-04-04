# Concept System Architecture

The concept system in Semem builds a semantic network of related ideas extracted from interactions. This network enhances memory retrieval by understanding conceptual relationships.

## Concept Extraction
The system uses the LLM to extract key concepts through carefully crafted prompts that:
1. Identify main topics and themes
2. Extract entities and relationships
3. Recognize abstract concepts
4. Maintain consistency across extractions

For example, from a weather-related interaction, it might extract:
- weather conditions
- temperature
- location
- time period
- weather patterns

## Graph Building
The system maintains a weighted graph where:
- Nodes represent concepts
- Edges represent co-occurrence relationships
- Edge weights indicate relationship strength
- Node centrality reflects concept importance

Each time concepts are extracted:
1. New concepts become nodes
2. Co-occurring concepts get connected
3. Existing relationships are strengthened
4. Graph metrics are updated

## Spreading Activation
During memory retrieval, the system uses spreading activation to:
1. Start from query concepts
2. Activate connected concepts
3. Decay activation with distance
4. Combine with embedding similarity

This creates a rich semantic network that improves memory retrieval accuracy.