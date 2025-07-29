# ZPT Knowledge Navigation Ontology

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A semantic vocabulary for dynamic knowledge navigation using camera metaphors to control information access across three dimensions: **Zoom** (abstraction level), **Pan** (domain scope), and **Tilt** (representation method).

**Status 2025-06-02 : first proper draft, untested in practice; docs still covered in AI fingerprints.**

## Documentation

- **[Ontology Specification](zpt.ttl)** - RDF/OWL vocabulary in Turtle format
- **[Namespace Document](namespace.md)** - class structure & reference term descriptions
- **[ZPT for Librarians](librarians.md)** - human-oriented explanation with examples

*There are also confusing diagrams under [media/](media).*

![poster](media/poster.png)

## Overview

Agents, both human and artificial have limits on the amount of information they can process at a given time : working memory/context window. In attempt to optimise processing workflows, two complimentary ontologies have been developed: [Ragno](https://github.com/danja/ragno), which offers a representation of a knowledgebase that is friendly to both Semantic Web and Language Model technologies, and here ZPT which provides a means of selectively navigating the knowledgebase. 

Ragno describes a heterogenous knowledge graph in a generalized fashion, loosely scale-free - it may be a domain-specific local knowledgebase or the Web as a whole. ZPT adds navigation capabilities that adapt information presentation to user (agent) needs. A system may dynamically select optimal knowledge "corpuscles" based on query requirements across three orthogonal dimensions:

- **🔍 Zoom**: Controls abstraction level (entity → summary → full text → community → corpus)
- **🔄 Pan**: Controls domain boundaries (topics, entities, temporal periods, geographic regions)  
- **📐 Tilt**: Controls representation method (embeddings, keywords, graph structure, temporal)

*ZPT is being developed in parallel with Ragno and application tooling with [Semem](https://github.com/danja/semem). Still early days.*

## Key Features

- **Dynamic Selection**: Automatically chooses optimal information subsets for any query
- **Multi-dimensional Optimization**: Balances detail level, relevance, and representation effectiveness
- **Provenance Tracking**: Full navigation history using PROV-O integration
- **Standards-Based**: Built on SKOS, PROV-O, and OWL foundations
- **Extensible**: Domain-specific zoom levels, pan domains, and tilt projections

## Quick Start

### Using the Ontology

```turtle
@prefix zpt: <http://purl.org/stuff/zpt/> .
@prefix ragno: <http://purl.org/stuff/ragno/> .

# Create a navigation view
ex:myView a zpt:NavigationView ;
    zpt:hasZoomState [ zpt:atZoomLevel zpt:UnitLevel ] ;
    zpt:hasPanState [ zpt:withPanDomain ex:aiTopic ] ;
    zpt:hasTiltState [ zpt:withTiltProjection zpt:EmbeddingProjection ] ;
    zpt:answersQuery "What are machine learning applications?" .
```

### Navigation Example

1. **Query**: "Explain neural networks for beginners"
2. **Zoom**: Community level (high-level summaries)
3. **Pan**: AI/ML topic domain 
4. **Tilt**: Keyword projection (accessible language)
5. **Result**: Beginner-friendly overview corpuscles selected automatically

## Architecture

```
Query → ZPT Analysis → Corpuscle Selection → View Projection
  ↓         ↓              ↓                 ↓
Zoom     Pan           Optimization      Representation
Level   Domain         Algorithm         Method
```

## Integration

ZPT is designed to work with:

- **[Ragno](http://purl.org/stuff/ragno/)** - Heterogeneous knowledge graph ontology
- **[NodeRAG](https://arxiv.org/abs/2504.11544)** - Graph-based retrieval-augmented generation
- **SKOS** - Concept organization and collections
- **PROV-O** - Provenance and navigation history

## Use Cases

- **Academic Research**: Progressive topic exploration from overview to details
- **Technical Documentation**: Adaptive presentation based on user expertise
- **News Analysis**: Multi-scale information from headlines to source documents
- **Legal Discovery**: Consistent detail across case types for comparison

In use the navigation flow might look something like this, where *User Query* could come from **any agent**:

![query flow diagram](media/navigation_flow.png)

## Development Status

**Current Version**: 0.1.0 (Initial Release)

- ✅ Core ontology design complete
- ✅ Integration with Ragno defined
- ✅ Standard vocabulary compliance (SKOS, PROV-O)
- 🔄 Reference implementation in progress
- 📋 Evaluation framework planned

## Implementation Roadmap

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| **Phase 1** | Weeks 1-2 | Ontology refinement and validation |
| **Phase 2** | Weeks 3-4 | Navigation engine architecture |
| **Phase 3** | Weeks 5-8 | Core implementation (Node.js/TypeScript) |
| **Phase 4** | Weeks 9-10 | Optimization algorithms |
| **Phase 5** | Weeks 11-12 | Web interface and API |
| **Phase 6** | Weeks 13-14 | Evaluation and refinement |

See [Development Plan](development-plan.md) for detailed specifications.

## Related Work

- **NodeRAG Paper**: [Structuring Graph-based RAG with Heterogeneous Nodes](https://arxiv.org/abs/2504.11544)
- **GraphRAG**: Microsoft's graph-based retrieval augmentation
- **LightRAG**: Optimized graph-based knowledge retrieval
- **HippoRAG**: Neurobiologically-inspired knowledge graphs

## Contributing

Contributions welcome! Areas of interest:

- Domain-specific zoom level definitions
- Novel tilt projection methods  
- Optimization algorithm improvements
- Integration with existing knowledge systems
- Evaluation metrics and benchmarks

## License

- **Code**: MIT License
- **Documentation**: CC BY 4.0 (Creative Commons Attribution)
- **Ontology**: CC BY 4.0 (Creative Commons Attribution)

## Contact

**Creator**: Danny Ayers  
**Homepage**: https://danny.ayers.name  
**Repository**: https://github.com/danja/zpt

## Citation

```bibtex
@misc{ayers2025zpt,
  title={ZPT: Zoom-Pan-Tilt Knowledge Navigation Ontology},
  author={Ayers, Danny},
  year={2025},
  url={http://purl.org/stuff/zpt/},
  note={Version 0.1.0}
}
```

---

*ZPT enables intelligent knowledge navigation through dynamic adaptation of information presentation to user needs and query requirements.*