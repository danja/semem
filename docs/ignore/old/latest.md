# Latest Updates - Configuration Rationalization

## Overview

The configuration system has been completely rationalized to provide a unified, user-friendly approach to managing Semem settings, with a particular focus on storage backend selection.

## Changes Made

### 1. Unified Configuration System

**Enhanced `src/Config.js`:**
- Now loads configuration from `config/config.json` automatically
- Provides transformation layer to map JSON config to internal structure
- Maintains backward compatibility with existing programmatic config
- Supports both file-based and programmatic configuration modes

**Key methods added:**
- `loadConfigFile()` - Loads and parses config/config.json
- `transformJsonConfig()` - Maps JSON structure to internal format
- `createFromFile()` - Static method for file-based config creation
- `createWithoutFile()` - Static method for programmatic-only config

### 2. Configuration Flow Implementation

**Server → Client Flow:**
1. **File Config**: `config/config.json` loaded by `Config.js`
2. **API Endpoint**: New `/api/config` endpoint serves sanitized configuration
3. **localStorage**: Client caches server config and user overrides
4. **UI Population**: Settings form populated with available options

**Updated `servers/start-all.js`:**
- Now uses consolidated `Config.createFromFile()` instead of direct JSON reading
- Eliminates duplicate configuration parsing

**New API endpoint `/api/config`:**
- Serves sanitized configuration (no passwords/secrets)
- Provides available storage types, LLM providers, SPARQL endpoints
- Enables dynamic UI population based on server capabilities

### 3. Storage Backend Selection (Primary Goal)

**Rationalized UI (`public/index.html`):**
- **Storage Backend Dropdown**: Clear options for memory, json, sparql, inmemory
- **Conditional SPARQL Config**: Shows SPARQL endpoint selection only when relevant
- **Dynamic Population**: Available endpoints loaded from server configuration
- **Real-time Updates**: UI adapts based on selected storage type

**Storage Options:**
- `memory` - In-Memory (Volatile)
- `json` - JSON File (Persistent) 
- `sparql` - SPARQL Store (RDF)
- `inmemory` - In-Memory Store (Transient)

### 4. Enhanced Client-Side Configuration

**Updated `public/script.js`:**
- `loadConfigFromServer()` - Fetches config from API endpoint
- `populateSettingsFromConfig()` - Populates UI with server options
- `loadSettings()` - Loads user overrides from localStorage
- Dynamic provider/endpoint population based on server capabilities
- Graceful fallback to localStorage if server unavailable

**Configuration Priority:**
1. Server config from file (base configuration)
2. User overrides from localStorage (customizations)
3. Environment variable overrides (runtime config)

### 5. User Experience Improvements

**Settings Panel Features:**
- **Dynamic Options**: LLM providers and SPARQL endpoints populated from server
- **Smart Defaults**: Pre-filled with current server configuration
- **Conditional UI**: SPARQL configuration only shown when relevant
- **Persistent Settings**: User choices saved to localStorage
- **Graceful Degradation**: Works offline with cached configuration

**Visual Enhancements:**
- Added CSS styling for new input fields (`.settings-input`)
- Improved form layout with proper spacing and focus states
- Clear labeling and descriptions for all configuration options

## Benefits

1. **Single Source of Truth**: All configuration flows through `src/Config.js`
2. **User-Friendly**: Storage backend selection is clear and immediate
3. **Flexible**: Supports both file-based and programmatic configuration
4. **Secure**: Sensitive data (passwords) excluded from client-side config
5. **Maintainable**: Eliminates duplicate configuration handling
6. **Extensible**: Easy to add new configuration options and storage backends

## Usage

### For Users:
1. Navigate to Settings tab in the web UI
2. Select desired storage backend from dropdown
3. Configure additional options (SPARQL endpoint, models, etc.)
4. Save settings - they persist in browser localStorage

### For Developers:
```javascript
// File-based configuration (recommended)
const config = Config.createFromFile();
await config.init();

// Programmatic configuration
const config = Config.createWithoutFile({ 
  storage: { type: 'sparql' } 
});
await config.init();
```

## Configuration Files

- **`config/config.json`**: Main configuration file with servers, endpoints, providers
- **`config.sample.json`**: Template/example configuration
- **localStorage `sememSettings`**: User overrides and customizations
- **localStorage `sememServerConfig`**: Cached server configuration

This rationalization successfully addresses the immediate goal of providing clear storage backend selection while establishing a robust foundation for future configuration management needs.