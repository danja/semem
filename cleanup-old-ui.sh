#!/bin/bash

# Script to disable old UI files by prefixing with underscore
# This makes them non-functional while preserving them for rollback if needed

set -e

echo "Starting old UI cleanup by prefixing files with underscore..."

# Base directory
BASE_DIR="/flow/hyperdata/semem/src/frontend"

# Function to rename a file/directory if it exists
rename_if_exists() {
    local path="$1"
    local reason="$2"
    
    if [ -e "$path" ]; then
        local dir=$(dirname "$path")
        local name=$(basename "$path")
        local new_path="${dir}/_${name}"
        
        if [ -e "$new_path" ]; then
            echo "SKIP: $path (target already exists)"
        else
            mv "$path" "$new_path"
            echo "RENAMED: $path -> $new_path ($reason)"
        fi
    else
        echo "NOT FOUND: $path"
    fi
}

echo "=== Disabling Core Old UI Files ==="

# Main old UI entry points
rename_if_exists "$BASE_DIR/index.js" "old UI main entry"
rename_if_exists "$BASE_DIR/index.template.html" "old UI HTML template"
rename_if_exists "$BASE_DIR/js/app.js" "old UI app initialization"
rename_if_exists "$BASE_DIR/js/app-menu-init.js" "old UI menu init"

echo ""
echo "=== Disabling Old UI Components ==="

# Old UI specific components (preserve Console and Help as they're shared)
rename_if_exists "$BASE_DIR/js/components/chat.js" "old UI chat"
rename_if_exists "$BASE_DIR/js/components/mcpClient.js" "old UI MCP client"
rename_if_exists "$BASE_DIR/js/components/memoryVisualization.js" "old UI memory viz"
rename_if_exists "$BASE_DIR/js/components/settings.js" "old UI settings"
rename_if_exists "$BASE_DIR/js/components/sparqlBrowser.js" "old UI SPARQL browser"
rename_if_exists "$BASE_DIR/js/components/sparqlBrowser.js.bak" "old UI SPARQL browser backup"
rename_if_exists "$BASE_DIR/js/components/stats.js" "old UI stats"
rename_if_exists "$BASE_DIR/js/components/tabs.js" "old UI tabs"
rename_if_exists "$BASE_DIR/js/components/vsom" "old UI VSOM components"
rename_if_exists "$BASE_DIR/js/components/AppMenu" "old UI app menu"

echo ""
echo "=== Disabling Old UI Controllers & Features ==="

# Controllers and features
rename_if_exists "$BASE_DIR/js/controllers/VSOMController.js" "old UI VSOM controller"
rename_if_exists "$BASE_DIR/js/features/vsom" "old UI VSOM features"
rename_if_exists "$BASE_DIR/js/debug-tabs.js" "old UI debug tabs"

echo ""
echo "=== Disabling Old UI Services (checking for shared usage) ==="

# Services - be more careful as some might be shared
rename_if_exists "$BASE_DIR/js/services/VSOMService.js" "old UI VSOM service"
# Note: Keeping apiService.js, eventBus.js as they might be shared

echo ""
echo "=== Disabling Old UI Stores & Utils ==="

# Stores
rename_if_exists "$BASE_DIR/js/stores/useStore.js" "old UI store"

# Utils - preserve shared ones
rename_if_exists "$BASE_DIR/js/utils/api.js" "old UI API utils"
rename_if_exists "$BASE_DIR/js/utils/d3-helpers.js" "old UI D3 helpers"
rename_if_exists "$BASE_DIR/js/utils/debug.js" "old UI debug utils"
rename_if_exists "$BASE_DIR/js/utils/tabManager.js" "old UI tab manager"

echo ""
echo "=== Disabling Old UI Styles ==="

# Styles - preserve workbench styles
rename_if_exists "$BASE_DIR/styles/atuin" "old UI Atuin/SPARQL styles"
rename_if_exists "$BASE_DIR/styles/components/tabs.css" "old UI tab styles"
rename_if_exists "$BASE_DIR/styles/console.css" "old UI console styles"
rename_if_exists "$BASE_DIR/styles/main.css" "old UI main styles"
rename_if_exists "$BASE_DIR/styles/tabs.css" "old UI tabs styles"
rename_if_exists "$BASE_DIR/styles/theme.css" "old UI theme"
rename_if_exists "$BASE_DIR/styles/vsom.css" "old UI VSOM styles"

echo ""
echo "=== Summary ==="
echo "Old UI files have been prefixed with underscore to disable them."
echo "The workbench UI should continue to function normally."
echo ""
echo "Files preserved (shared components):"
echo "- js/components/Console/"
echo "- js/components/Help/"
echo "- js/utils/logger.js"
echo "- js/utils/errorHandler.js"
echo "- js/services/apiService.js (potentially shared)"
echo "- js/services/eventBus.js (potentially shared)"
echo "- workbench/ (entire workbench directory)"
echo ""
echo "To test:"
echo "1. Try running the workbench: cd workbench && npm start"
echo "2. Check that the main API server still works"
echo "3. If everything works, you can delete the _prefixed files later"
echo ""
echo "To rollback (if something breaks):"
echo "cd $BASE_DIR"
echo "find . -name '_*' -type f -exec bash -c 'mv \"\$1\" \"\${1#*/}_\"' _ {} \\;"
echo "find . -name '_*' -type d -exec bash -c 'mv \"\$1\" \"\${1#*/}_\"' _ {} \\;"