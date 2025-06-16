# Atuin

![Build](https://github.com/danja/atuin/actions/workflows/ci.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/10583/badge)](https://www.bestpractices.dev/projects/10583) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/danja/atuin)

# Semantic Web Syntax Editor

## [Demo](https://danja.github.io/atuin/)

**Status 2025-06-16 :** Mostly stable, just added various bugfixes & small new features. *Nearly* ready for proper use. Has (untried) [INTEGRATION.md](https://github.com/danja/atuin/blob/main/INTEGRATION.md) for sticking it in other apps. 

**If you recognise the general design or even created the logo yourself, please let me know so I can acknowledge.** Atuin is all-new code but based heavily on someone else's design from years ago. Alas I forget who, and I didn't see a ref in the original code I have.

*My motivation is to use it in [Semem](https://github.com/danja/semem), an agent memory thing I'm working on that will need seriously cluster-capable visualization of RDF graphs.*

_The following mostly written by my colleagues Claude and GitHub Copilot. Be warned, reality isn't their first language. Proper docs may appear in finite time._

Atuin is a web-based editor for Turtle RDF files with an integrated graph visualization, and SPARQL with the ability to query remote stores. This modern implementation uses vanilla JavaScript with ES modules (ESM), providing a clean, modular architecture. It is tested with [Vitest](https://vitest.dev/) and uses the [evb](https://github.com/danja/evb) event bus for decoupled communication between components.

## Features

- Turtle & SPARQL syntax editing with syntax highlighting
- Remote SPARQL store querying
- Real-time RDF graph visualization
- Visual node and edge manipulation
- Syntax validation
- Graph clustering for large datasets
- Options to hide standard vocabulary nodes (RDF, RDFS, OWL)
- Responsive split-pane layout
- Reusable UI components for easy integration:
  - SPARQL endpoint management
  - Query clips for saving and reusing common queries

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

1. Clone this repository

```sh
git clone https://github.com/danja/atuin.git
cd atuin
```

2. Install dependencies (including the local evb event bus library)

```sh
npm install
```

3. Start the development server

```sh
npm run dev
```

4. Open your browser at http://localhost:9000

### Building for Production

To create a production build:

```sh
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. Enter or paste Turtle RDF content in the editor pane
2. Syntax validation runs automatically
3. The graph visualization updates in real-time
4. Click on nodes in the graph to highlight their references in the editor
5. Use the toolbar controls to:
   - Toggle split view
   - Hide/show standard vocabulary nodes
   - Freeze/unfreeze the graph physics
   - Add/remove clustering

## Project Structure

```
atuin/
├── src/
│   ├── js/
│   │   ├── core/          # Core functionality
│   │   ├── services/      # Helper services
│   │   ├── utils/         # Utility functions
│   │   ├── ui/            # UI components
│   │   └── main.js        # App entry point
│   ├── css/               # Stylesheets
│   ├── html/              # HTML templates
│   └── img/               # Images and icons
├── test/                  # Test files
├── dist/                  # Build output
├── webpack.config.js      # Webpack configuration
├── package.json           # Project dependencies
└── README.md              # This file
```

## Technologies Used

- Vanilla JavaScript (ES Modules)
- CodeMirror 6 (editor)
- vis-network (graph visualization)
- N3.js (RDF parsing)
- Webpack (bundling)
- Vitest (testing)
- JSDoc (documentation)
- [evb](https://github.com/danja/evb) (event bus)

## Architecture

### Event Bus Communication

Atuin uses the [evb](https://github.com/danja/evb) event bus library for loose coupling between components to simplify reuse. This architectural pattern provides several benefits:

- **Modular components**: Each component operates independently and communicates through events
- **Easy testing**: Components can be tested in isolation with mock event handlers
- **Flexible reuse**: Components can be reused in different contexts without modification
- **Maintainable code**: Clear separation of concerns with event-driven communication

Key event patterns used throughout the application:
- `EVENTS.MODEL_SYNCED`: When RDF content changes in the editor
- `EVENTS.ENDPOINT_UPDATED`: When SPARQL endpoint configuration changes  
- `EVENTS.SPARQL_QUERY_COMPLETED`: When SPARQL queries finish execution

## Testing

This project uses [Vitest](https://vitest.dev/) for unit and integration tests. To run the tests:

```sh
npx vitest run
```

The test suite covers core logic, utilities, and integration between the editor and graph visualizer.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
