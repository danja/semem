#!/bin/bash
set -e

# wait-for-services.sh
# Utility script to wait for external services to be ready
# Can be used independently or as part of the docker-entrypoint.sh

# Default configuration
DEFAULT_TIMEOUT=60
DEFAULT_RETRY_INTERVAL=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[WAIT]${NC} $(date '+%H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WAIT]${NC} $(date '+%H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[WAIT]${NC} $(date '+%H:%M:%S') $1"
}

log_debug() {
    if [ "${DEBUG:-}" = "1" ]; then
        echo -e "${BLUE}[DEBUG]${NC} $(date '+%H:%M:%S') $1"
    fi
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] SERVICE1 SERVICE2 ...

Wait for one or more services to become available before proceeding.

Services can be specified as:
  - HOST:PORT                 (TCP connection check)
  - http://HOST:PORT/PATH     (HTTP request check)
  - https://HOST:PORT/PATH    (HTTPS request check)

Options:
  -t, --timeout SECONDS       Timeout in seconds (default: $DEFAULT_TIMEOUT)
  -i, --interval SECONDS      Retry interval in seconds (default: $DEFAULT_RETRY_INTERVAL)
  -v, --verbose               Enable verbose output
  -h, --help                  Show this help message

Examples:
  $0 fuseki:3030
  $0 http://fuseki:3030/\$/ping
  $0 -t 120 fuseki:3030 ollama:11434
  $0 http://api:4100/health http://workbench:4102/health

Environment Variables:
  DEBUG=1                     Enable debug output
  WAIT_TIMEOUT               Default timeout (overridden by -t)
  WAIT_INTERVAL              Default interval (overridden by -i)
EOF
}

# Function to check TCP connection
check_tcp() {
    local host=$1
    local port=$2
    local timeout=${3:-5}
    
    log_debug "Checking TCP connection to $host:$port"
    
    if command -v nc >/dev/null 2>&1; then
        # Use netcat if available
        nc -z -w "$timeout" "$host" "$port" >/dev/null 2>&1
    elif command -v timeout >/dev/null 2>&1; then
        # Use timeout + bash tcp redirect
        timeout "$timeout" bash -c "</dev/tcp/$host/$port" >/dev/null 2>&1
    else
        # Fallback: try to connect with bash
        (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1
    fi
}

# Function to check HTTP/HTTPS endpoint
check_http() {
    local url=$1
    local timeout=${2:-10}
    
    log_debug "Checking HTTP endpoint: $url"
    
    if command -v curl >/dev/null 2>&1; then
        curl -f -s --max-time "$timeout" --connect-timeout "$timeout" "$url" >/dev/null 2>&1
    elif command -v wget >/dev/null 2>&1; then
        wget -q --timeout="$timeout" --tries=1 -O /dev/null "$url" >/dev/null 2>&1
    else
        log_error "Neither curl nor wget available for HTTP checks"
        return 1
    fi
}

# Function to parse service specification
parse_service() {
    local service=$1
    
    if [[ $service =~ ^https?:// ]]; then
        echo "http|$service"
    elif [[ $service =~ ^([^:]+):([0-9]+)$ ]]; then
        echo "tcp|${BASH_REMATCH[1]}|${BASH_REMATCH[2]}"
    else
        log_error "Invalid service specification: $service"
        log_error "Expected format: HOST:PORT or http[s]://HOST:PORT/PATH"
        return 1
    fi
}

# Function to wait for a single service
wait_for_service() {
    local service=$1
    local timeout=$2
    local interval=$3
    
    local service_info
    service_info=$(parse_service "$service") || return 1
    
    IFS='|' read -r type host port_or_url <<< "$service_info"
    
    local service_name
    if [ "$type" = "http" ]; then
        service_name="$port_or_url"
    else
        service_name="$host:$port_or_url"
    fi
    
    log_info "Waiting for $service_name (timeout: ${timeout}s, interval: ${interval}s)"
    
    local elapsed=0
    local success=false
    
    while [ $elapsed -lt $timeout ]; do
        if [ "$type" = "http" ]; then
            if check_http "$port_or_url" 5; then
                success=true
                break
            fi
        else
            if check_tcp "$host" "$port_or_url" 5; then
                success=true
                break
            fi
        fi
        
        sleep "$interval"
        elapsed=$((elapsed + interval))
        
        if [ $((elapsed % 10)) -eq 0 ] && [ $elapsed -gt 0 ]; then
            log_debug "Still waiting for $service_name... (${elapsed}s elapsed)"
        fi
    done
    
    if [ "$success" = true ]; then
        log_info "✓ $service_name is ready"
        return 0
    else
        log_error "✗ $service_name failed to become ready within ${timeout}s"
        return 1
    fi
}

# Main function
main() {
    local timeout=${WAIT_TIMEOUT:-$DEFAULT_TIMEOUT}
    local interval=${WAIT_INTERVAL:-$DEFAULT_RETRY_INTERVAL}
    local services=()
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--timeout)
                timeout="$2"
                shift 2
                ;;
            -i|--interval)
                interval="$2"
                shift 2
                ;;
            -v|--verbose)
                verbose=true
                export DEBUG=1
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                services+=("$1")
                shift
                ;;
        esac
    done
    
    # Validate arguments
    if [ ${#services[@]} -eq 0 ]; then
        log_error "No services specified"
        usage
        exit 1
    fi
    
    if ! [[ $timeout =~ ^[0-9]+$ ]] || [ $timeout -le 0 ]; then
        log_error "Invalid timeout: $timeout (must be positive integer)"
        exit 1
    fi
    
    if ! [[ $interval =~ ^[0-9]+$ ]] || [ $interval -le 0 ]; then
        log_error "Invalid interval: $interval (must be positive integer)"
        exit 1
    fi
    
    # Wait for all services
    local failed_services=()
    local total_services=${#services[@]}
    
    log_info "Waiting for $total_services service(s) with ${timeout}s timeout..."
    
    for service in "${services[@]}"; do
        if ! wait_for_service "$service" "$timeout" "$interval"; then
            failed_services+=("$service")
        fi
    done
    
    # Report results
    local successful_count=$((total_services - ${#failed_services[@]}))
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        log_info "✓ All $total_services service(s) are ready!"
        exit 0
    else
        log_error "✗ $successful_count/$total_services service(s) ready. Failed services:"
        for service in "${failed_services[@]}"; do
            log_error "  - $service"
        done
        exit 1
    fi
}

# Handle signals
trap 'log_warn "Interrupted"; exit 1' INT TERM

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi