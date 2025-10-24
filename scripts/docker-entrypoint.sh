#!/bin/bash
set -e

# Docker entrypoint script for Semem
# Handles service startup, configuration generation, and dependency management

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[ENTRYPOINT]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Function to optionally load environment variables from a file inside the container
load_environment_file() {
    local env_file="${SEMEM_ENV_FILE:-/app/.env}"

    if [ -f "$env_file" ]; then
        log_info "Loading environment variables from ${env_file}"
        set -a
        # shellcheck source=/dev/null
        . "$env_file"
        set +a
    else
        if [ -n "$SEMEM_ENV_FILE" ]; then
            log_error "Environment file specified at ${env_file} but not found"
            exit 1
        fi
        log_info "No environment file found at ${env_file}; relying on container environment variables"
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local timeout=${4:-60}
    
    log_info "Waiting for $service_name at $host:$port..."
    
    local count=0
    while ! nc -z "$host" "$port" >/dev/null 2>&1; do
        if [ $count -ge $timeout ]; then
            log_error "Timeout waiting for $service_name at $host:$port"
            return 1
        fi
        count=$((count + 1))
        sleep 1
    done
    
    log_info "$service_name is ready at $host:$port"
    return 0
}

# Function to wait for HTTP service
wait_for_http_service() {
    local url=$1
    local service_name=$2
    local timeout=${3:-60}
    
    log_info "Waiting for $service_name at $url..."
    
    local count=0
    while ! curl -f -s "$url" >/dev/null 2>&1; do
        if [ $count -ge $timeout ]; then
            log_error "Timeout waiting for $service_name at $url"
            return 1
        fi
        count=$((count + 1))
        sleep 1
    done
    
    log_info "$service_name is ready at $url"
    return 0
}

# Function to verify configuration exists
verify_config() {
    local config_file="/app/config/config.json"
    
    if [ ! -f "$config_file" ]; then
        log_error "Configuration file not found at $config_file"
        log_error "Make sure to mount config.json as a volume"
        exit 1
    fi
    
    log_info "Using existing configuration file: $config_file"
}

# Function to setup directories and permissions
setup_directories() {
    log_info "Setting up directories and permissions..."
    
    # Create necessary directories
    mkdir -p /app/logs /app/data /app/tmp
    
    # Ensure proper permissions (assuming running as semem user)
    if [ "$(id -u)" = "1001" ]; then
        log_info "Running as semem user (1001)"
    else
        log_warn "Not running as expected semem user (current: $(id -u))"
    fi
}

# Function to check environment variables
check_environment() {
    log_info "Checking environment configuration..."
    
    # Check critical environment variables
    local missing_vars=""
    
    # SPARQL configuration
    if [ -z "$SPARQL_USER" ]; then
        log_warn "SPARQL_USER not set, using default 'admin'"
        export SPARQL_USER="admin"
    fi
    
    if [ -z "$SPARQL_PASSWORD" ]; then
        log_warn "SPARQL_PASSWORD not set, using default 'admin123'"
        export SPARQL_PASSWORD="admin123"
    fi
    
    # API key
    if [ -z "$SEMEM_API_KEY" ]; then
        log_error "SEMEM_API_KEY not set. Provide it via environment variables or mount a .env file."
        exit 1
    fi

    log_info "SEMEM_API_KEY loaded from environment"
    
    # LLM provider check (at least one should be configured)
    local has_llm_provider=false
    
    if [ -n "$MISTRAL_API_KEY" ]; then
        log_info "Mistral API key configured"
        has_llm_provider=true
    fi
    
    if [ -n "$CLAUDE_API_KEY" ]; then
        log_info "Claude API key configured"
        has_llm_provider=true
    fi
    
    if [ -n "$OPENAI_API_KEY" ]; then
        log_info "OpenAI API key configured"
        has_llm_provider=true
    fi
    
    if [ -n "$OLLAMA_HOST" ]; then
        log_info "Ollama host configured: $OLLAMA_HOST"
        has_llm_provider=true
    fi
    
    if [ "$has_llm_provider" = false ]; then
        log_info "No LLM providers configured - configure external Ollama or cloud providers via environment variables"
    fi
}

# Function to wait for dependencies
wait_for_dependencies() {
    log_info "Waiting for service dependencies..."
    
    # Wait for Fuseki (SPARQL database)
    if [ -n "$FUSEKI_HOST" ]; then
        wait_for_http_service "$FUSEKI_HOST/$/ping" "Fuseki SPARQL" 120
    else
        # Default Fuseki locations
        if wait_for_service "fuseki" 3030 "Fuseki SPARQL" 5 || wait_for_service "fuseki-dev" 3030 "Fuseki SPARQL (dev)" 5; then
            log_info "Fuseki SPARQL database is available"
        else
            log_warn "Fuseki SPARQL database not available - will use fallback configuration"
        fi
    fi
    
    # Note: Ollama support is external only - no container waiting
}

# Main entrypoint logic
main() {
    log "Starting Semem Docker container..."
    log "Node.js version: $(node --version)"
    log "npm version: $(npm --version)"
    
    # Setup
    load_environment_file
    setup_directories
    check_environment
    verify_config
    wait_for_dependencies
    
    log "Initialization complete. Starting application..."
    
    # Execute the command passed to the container
    exec "$@"
}

# Handle signals for graceful shutdown
trap 'log "Received shutdown signal"; exit 0' SIGTERM SIGINT

# Run main function
main "$@"
