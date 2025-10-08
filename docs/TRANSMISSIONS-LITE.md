# Transmissions Lite – Feasibility Notes

## Current Project Snapshot

`transmissions` already implements a full pipeline system:
- **Definition format**: workflows described in Turtle RDF (`transmissions.ttl`).
- **Engine**: `TransmissionBuilder`, `ProcessorImpl`, `WorkerPool`, `ModuleLoader`, etc. assemble and execute pipelines.
- **Runtime model**: `Transmission` + `Whiteboard` manage state, processors are dynamically loaded.
- **Tooling**: CLI, REPL, and early GUI components; heavy dependency footprint (RDF-ext, Grapoi, Markmap, webpack, etc.).

## Possible Application in Semem

**Good fit**
- Already supports chained processors, nested workflows, state sharing – matches Semem’s orchestration needs.
- Provides processor registry & module loading logic we could reuse.

**Challenges**
- Repo bundles UI/REPL assets and numerous RDF utilities – too heavy for a lightweight library.
- DSL is TTL-based; Semem currently uses JS/JSON/Zod structures. Introducing RDF would raise the barrier for contributors.
- Core engine assumes an `App` with dataset/whiteboard structure. We’d need adapters or significant refactors to align with Semem’s config shape.

## Minimal “Transmissions Lite” Concept

If we revisit this later, extract a core module with:
1. **Engine subset**: `TransmissionBuilder`, `ProcessorImpl`, `WorkerPool`, `AbstractProcessorFactory`, `Transmission`, `Whiteboard`.
2. **Config abstraction**: replace TTL parsing with an interface that callers can implement (JSON, YAML, etc.).
3. **Processor registration API**: consumers register processor factories instead of relying on module loader conventions.
4. **Strip UI/CLI tooling**: keep the existing app in a separate package.

## Recommendation

For Semem’s near-term workflow refactor, a lightweight JSON/Zod DSL inside Semem is probably more efficient. Transmissions can serve as architectural inspiration, and we can revisit a “lite” extraction if we decide Semem needs a standalone workflow engine later.
