src/api/
├── common/
│ ├── BaseAPI.js # Abstract base interface
│ ├── APIRegistry.js # API registration/discovery
│ └── types.d.ts # TypeScript definitions
├── cli/
│ └── CLIHandler.js # Command line interface
├── repl/
│ └── REPLHandler.js # Interactive shell
├── http/
│ ├── server/
│ │ ├── HTTPServer.js # Express server
│ │ └── routes/ # API endpoints
│ └── client/
│ └── forms/ # Web interface
├── features/
│ ├── SelfieHandler.js # Metrics & monitoring
│ ├── PassiveHandler.js # Individual operations
│ └── ActiveHandler.js # Combined operations
└── utils/
├── MetricsCollector.js # Performance tracking
└── APILogger.js # Logging wrapper
