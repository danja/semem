# GitHub Actions Configuration

This directory contains GitHub Actions workflows for the Semem project.

## docs.yml

Builds and deploys documentation to GitHub Pages, including:

- **Manual Documentation**: Markdown files from `docs/manual/` 
- **API Documentation**: Auto-generated JSDoc from source code
- **Landing Page**: Navigation between manual and API docs

### Setup Requirements

1. **Enable GitHub Pages**: In repository settings, enable Pages with "GitHub Actions" as the source
2. **Permissions**: The workflow has permissions to deploy to Pages
3. **JSDoc Configuration**: Uses existing `jsdoc.config.json` 

### Workflow Triggers

- Push to `main` branch
- Pull requests to `main` branch (build only, no deploy)

### Output Structure

```
GitHub Pages Site:
├── index.html              # Landing page with navigation
├── manual/                 # User manual
│   ├── index.html         # Manual index (renders index.md)
│   ├── config.html        # Configuration guide
│   ├── mcp-tutorial.html  # MCP tutorial
│   └── ...                # Other manual pages
└── api/                   # JSDoc API reference
    ├── index.html         # API documentation
    └── ...                # Generated API docs
```

The workflow automatically:
- Generates JSDoc documentation
- Creates HTML wrappers for markdown files
- Builds a unified documentation site
- Deploys to GitHub Pages on main branch pushes