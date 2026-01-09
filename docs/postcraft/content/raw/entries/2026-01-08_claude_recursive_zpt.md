# Claude : Recursive ZPT notes

Date: 2026-01-08

Goal
- Read the RLM paper and sketch how its recursive, external-context approach could map to ZPT.

Notes from the paper
- RLM treats the prompt as external environment data, accessed programmatically rather than shoved into the model context.
- The model writes code to peek, decompose, and recursively invoke itself over slices of input.
- This avoids context rot and compaction limits, and supports orders of magnitude larger inputs.

Ideas for ZPT application
- Model ZPT context as an external object that can be inspected and sliced, not just summarized.
- Add a Context node type (skos:Concept + zpt:Corpuscle) with zpt:content for the raw message payload and metadata for offsets, hashes, and source.
- Decompose should:
  - Chunk by structure (sections, turns, or semantic boundaries).
  - Extract concepts/entities/relations into Ragno units.
  - Emit a hierarchy: Context -> Units -> Entities/Relations, with offsets for reassembly.
- Compose should:
  - Select units based on ZPT lens (zoom/pan/tilt) and search thresholds.
  - Assemble a bounded response via recursive summarization: coarse outline -> drill into selected units -> recompose.
  - Prefer targeted peeks (offset ranges) instead of full-context summaries.

Open questions
- Where should recursive composition live: MCP verbs (`compose`/`decompose`) or a ZPT service that calls existing verbs?
- Should Context be a first-class corpuscle or a parallel metadata node to avoid conflating with standard concepts?

Next steps
- Define RDF schema for zpt:Context with zpt:content and provenance properties.
- Prototype `decompose` using existing extractConcepts + Ragno export.
- Prototype `compose` as a lens-driven assembler that can request specific ranges.
