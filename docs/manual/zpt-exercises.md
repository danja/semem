# ZPT (Zoom-Pan-Tilt) Navigation Exercises

This document outlines comprehensive exercises for testing the ZPT (Zoom-Pan-Tilt) navigation system in Semem. ZPT allows users to navigate semantic memory at different levels of abstraction (Zoom), filter by domains/keywords (Pan), and adjust viewing perspectives (Tilt).

## Understanding ZPT Navigation

ZPT navigation is like using a semantic telescope to explore knowledge:

- **Zoom**: Controls the level of abstraction (micro → entity → text → unit → community → corpus)
- **Pan**: Filters content by specific domains or keywords (like pointing the telescope)
- **Tilt**: Changes the viewing perspective (keywords, entities, relationships, temporal)

## Exercise Set 1: Basic Zoom Navigation

### Exercise 1.1: Micro Level Detail
**Objective**: Navigate at the most detailed level to see fine-grained attributes and atomic facts.

**Setup**: 
- Store content: "The mitochondria produces ATP through cellular respiration. DNA contains adenine, thymine, guanine, and cytosine bases."
- Set Zoom: micro

**Expected Results**:
- Should return specific molecular details: "ATP", "adenine", "thymine", "guanine", "cytosine"
- Should show precise scientific facts without abstraction
- Results should include raw data points and specific measurements

**Test Criteria**:
- ✅ Returns at least 3 specific micro-level terms or attributes
- ✅ No abstract concepts in results
- ✅ Detailed scientific facts present

### Exercise 1.2: Entity Level Navigation  
**Objective**: Navigate at entity level to see distinct objects, people, places, and things.

**Setup**:
- Store content: "Albert Einstein developed the theory of relativity at Princeton University in 1915. Marie Curie won Nobel Prizes in Physics and Chemistry."
- Set Zoom: entity

**Expected Results**:
- Should return entities: "Albert Einstein", "Princeton University", "Marie Curie", "Nobel Prize"
- Should focus on proper nouns and distinct objects
- Should not show abstract concepts or relationships

**Test Criteria**:
- ✅ Returns named entities (people, places, organizations)
- ✅ Filters out abstract concepts and relationships
- ✅ Shows concrete objects and identifiable things

### Exercise 1.3: Text Level Detail
**Objective**: Navigate at text level to see raw source fragments and full content.

**Setup**:
- Store content: "Democracy requires citizen participation and transparent governance. Education empowers individuals and strengthens society."
- Set Zoom: text

**Expected Results**:
- Should return full sentences or paragraph-length content
- Should preserve original phrasing and context
- Should not collapse into summaries

**Test Criteria**:
- ✅ Returns raw text fragments or full documents
- ✅ Preserves original wording
- ✅ Avoids high-level summaries

### Exercise 1.4: Unit Level Abstraction
**Objective**: Navigate at unit level to see semantic summaries and local abstractions.

**Setup**:
- Store diverse content covering: science, politics, education, technology
- Set Zoom: unit

**Expected Results**:
- Should return semantic units: "democracy and governance", "education empowers society"
- Should summarize local meaning from text
- Should abstract away raw phrasing

**Test Criteria**:
- ✅ Returns semantic summaries
- ✅ Abstracts away raw text
- ✅ Preserves local meaning

### Exercise 1.5: Community Level Overview
**Objective**: Navigate at community level to see clustered topics and shared themes.

**Setup**:
- Store diverse content covering: science, politics, education, technology
- Set Zoom: community

**Expected Results**:
- Should return broad themes: "scientific research", "political systems", "educational policy"
- Should provide high-level abstraction
- Should group related concepts into coherent communities

**Test Criteria**:
- ✅ Returns thematic groupings
- ✅ Abstracts away lower-level details
- ✅ Shows domain-level clustering

### Exercise 1.6: Corpus Level Overview
**Objective**: Navigate at corpus level to see whole-corpus structure and metadata.

**Setup**:
- Store diverse content across multiple domains
- Set Zoom: corpus

**Expected Results**:
- Should return corpus-wide stats or summaries
- Should avoid item-level details

**Test Criteria**:
- ✅ Returns corpus-level summaries
- ✅ Omits entity/unit/text detail

## Exercise Set 2: Pan Filtering

### Exercise 2.1: Domain-Based Filtering
**Objective**: Filter content by specific knowledge domains.

**Setup**:
- Store mixed content: science, literature, sports, cooking
- Set Pan domains: ["science", "technology"]

**Expected Results**:
- Should only return science and technology related content
- Should filter out literature, sports, and cooking content
- Should maintain relevance scoring within filtered domains

**Test Criteria**:
- ✅ Only returns content from specified domains
- ✅ Filters out unrelated domain content
- ✅ Maintains content quality within domain scope

### Exercise 2.2: Keyword-Based Filtering
**Objective**: Filter content using specific keywords.

**Setup**:
- Store content about: "artificial intelligence", "machine learning", "neural networks", "cooking recipes"
- Set Pan keywords: ["AI", "machine learning", "neural"]

**Expected Results**:
- Should return content containing AI-related keywords
- Should filter out cooking content
- Should match both exact terms and semantic variants

**Test Criteria**:
- ✅ Returns content matching specified keywords
- ✅ Includes semantic variants of keywords
- ✅ Filters out non-matching content

### Exercise 2.3: Combined Domain and Keyword Filtering
**Objective**: Apply both domain and keyword filters simultaneously.

**Setup**:
- Store mixed content across multiple domains
- Set Pan domains: ["health", "medicine"] AND keywords: ["treatment", "diagnosis"]

**Expected Results**:
- Should return only health/medicine content containing treatment/diagnosis terms
- Should apply AND logic (must match both domain AND keyword criteria)
- Should be more restrictive than either filter alone

**Test Criteria**:
- ✅ Matches both domain and keyword criteria
- ✅ More restrictive than individual filters
- ✅ Maintains relevance within combined constraints

## Exercise Set 3: Tilt Perspective Changes

### Exercise 3.1: Keywords Perspective
**Objective**: View content through the lens of important keywords and terms.

**Setup**:
- Store content: "Climate change affects global weather patterns and ecosystem stability."
- Set Tilt: keywords

**Expected Results**:
- Should emphasize key terms: "climate change", "weather patterns", "ecosystem stability"
- Should organize results around significant keywords
- Should show keyword relationships and co-occurrences

**Test Criteria**:
- ✅ Highlights important keywords in results
- ✅ Organizes content around key terms
- ✅ Shows keyword significance and relationships

### Exercise 3.2: Entities Perspective  
**Objective**: View content through the lens of entities and their relationships.

**Setup**:
- Store content: "NASA launched the James Webb Space Telescope to study distant galaxies."
- Set Tilt: entities

**Expected Results**:
- Should emphasize entities: "NASA", "James Webb Space Telescope", "galaxies"
- Should show entity relationships and connections
- Should organize around entity-centric views

**Test Criteria**:
- ✅ Emphasizes named entities in results
- ✅ Shows entity relationships and connections
- ✅ Organizes content around entity interactions

### Exercise 3.3: Relationships Perspective
**Objective**: View content through the lens of relationships between concepts.

**Setup**:
- Store content: "Photosynthesis converts sunlight into chemical energy, which plants use for growth."
- Set Tilt: relationships

**Expected Results**:
- Should emphasize relationships: "converts", "use for", causal connections
- Should show how concepts connect and interact
- Should organize around relational structures

**Test Criteria**:
- ✅ Highlights relationships between concepts
- ✅ Shows causal and logical connections
- ✅ Organizes content around relational patterns

### Exercise 3.4: Temporal Perspective
**Objective**: View content through the lens of time and sequence.

**Setup**:
- Store content: "The Renaissance began in Italy during the 14th century and spread across Europe by the 16th century."
- Set Tilt: temporal

**Expected Results**:
- Should emphasize temporal aspects: "14th century", "16th century", "began", "spread"
- Should show chronological sequences and time-based relationships
- Should organize content around temporal flow

**Test Criteria**:
- ✅ Emphasizes temporal information
- ✅ Shows chronological sequences
- ✅ Organizes content around time-based patterns

## Exercise Set 4: Combined ZPT Navigation

### Exercise 4.1: Science Research Navigation
**Objective**: Navigate scientific research at different abstraction levels with domain filtering.

**Setup**:
- Store scientific content covering: molecular biology, physics, chemistry
- Configure: Zoom=concept, Pan=domains["science"], Tilt=relationships

**Expected Results**:
- Should return scientific concepts with relational emphasis
- Should filter to science domain only
- Should show how scientific concepts relate to each other

**Test Criteria**:
- ✅ Returns concept-level scientific information
- ✅ Filters to science domain
- ✅ Emphasizes relationships between scientific concepts

### Exercise 4.2: Historical Entity Analysis
**Objective**: Analyze historical entities with keyword filtering and temporal perspective.

**Setup**:
- Store historical content about: "World War II", "Renaissance", "Industrial Revolution"
- Configure: Zoom=entity, Pan=keywords["war", "revolution"], Tilt=temporal

**Expected Results**:
- Should return historical entities related to war and revolution
- Should organize chronologically
- Should show temporal relationships between entities

**Test Criteria**:
- ✅ Returns entities related to specified keywords
- ✅ Organizes results temporally
- ✅ Shows historical entity relationships over time

### Exercise 4.3: Technology Theme Exploration
**Objective**: Explore technology themes with broad abstraction and keyword filtering.

**Setup**:
- Store technology content: AI, blockchain, quantum computing, biotechnology
- Configure: Zoom=theme, Pan=keywords["innovation", "computing"], Tilt=keywords

**Expected Results**:
- Should return high-level technology themes
- Should filter for innovation and computing keywords
- Should organize around key technological terms

**Test Criteria**:
- ✅ Returns thematic technology groupings
- ✅ Filters for specified keywords
- ✅ Organizes around key terms and concepts

## Exercise Set 5: Dynamic Navigation Sequences

### Exercise 5.1: Zoom Progression Sequence
**Objective**: Navigate from broad themes down to molecular details.

**Sequence**:
1. Start with Zoom=theme (see broad topics)
2. Select interesting theme, set Zoom=concept (see related concepts)
3. Select key concept, set Zoom=entity (see specific entities)
4. Select entity, set Zoom=molecular (see detailed facts)

**Expected Results**:
- Should show progressive detail refinement
- Each zoom level should maintain coherence with previous
- Should demonstrate hierarchical knowledge organization

**Test Criteria**:
- ✅ Each zoom level shows appropriate abstraction
- ✅ Maintains coherent topic focus through transitions
- ✅ Demonstrates hierarchical knowledge structure

### Exercise 5.2: Pan Filter Refinement
**Objective**: Progressively narrow focus using pan filters.

**Sequence**:
1. Start with no Pan filters (see all content)
2. Add domain filter (narrow to specific domain)
3. Add keyword filter (further narrow to specific topics)
4. Refine keywords (focus on most relevant terms)

**Expected Results**:
- Should show progressive content narrowing
- Each filter should reduce result set meaningfully
- Should maintain relevance throughout refinement

**Test Criteria**:
- ✅ Each filter step reduces and focuses results
- ✅ Maintains relevance and quality throughout
- ✅ Final results highly targeted to specifications

### Exercise 5.3: Tilt Perspective Switching
**Objective**: View the same content through different tilt perspectives.

**Sequence**:
1. Set fixed Zoom=concept, Pan=domain["science"]
2. View with Tilt=keywords (see key terms)
3. Switch to Tilt=entities (see scientific entities)
4. Switch to Tilt=relationships (see concept connections)
5. Switch to Tilt=temporal (see time-based patterns)

**Expected Results**:
- Same content should appear different through each tilt
- Each perspective should reveal different aspects
- Should demonstrate multi-dimensional knowledge views

**Test Criteria**:
- ✅ Each tilt shows distinct perspective on same content
- ✅ Perspectives reveal different knowledge aspects
- ✅ Results maintain coherence across perspective changes

## Performance and Quality Expectations

### Response Time Expectations
- **Simple Navigation**: < 500ms
- **Complex Filtering**: < 1000ms  
- **Multi-step Sequences**: < 2000ms total

### Quality Expectations
- **Relevance**: Results should match navigation criteria with >80% accuracy
- **Completeness**: Should return comprehensive results within scope
- **Consistency**: Same navigation parameters should yield consistent results
- **Coherence**: Results should be logically organized and meaningful

### Error Handling Expectations
- **Invalid Parameters**: Should return clear error messages
- **Empty Results**: Should indicate no matches found with suggestions
- **Network Issues**: Should handle timeouts and connection failures gracefully
- **Malformed Queries**: Should sanitize input and provide helpful feedback

## Integration Test Considerations

### MCP Server Tests
- Test direct ZPT API endpoints
- Verify parameter validation
- Check response format compliance
- Test error conditions and edge cases

### Workbench Tests
- Test UI navigation controls
- Verify visual feedback and state updates
- Check console logging and progress indicators
- Test user interaction flows

### End-to-End Tests
- Test complete navigation workflows
- Verify data consistency across interfaces
- Check performance under realistic loads
- Validate user experience scenarios
