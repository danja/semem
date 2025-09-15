#!/bin/bash

# Workbench Integration Test Runner
# Runs comprehensive integration tests for the workbench upload and search workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKBENCH_URL="http://localhost:3000"
MCP_URL="http://localhost:4101"
TIMEOUT=30

echo -e "${BLUE}🧪 Workbench Integration Test Runner${NC}"
echo "=================================================="

# Function to check if a service is running
check_service() {
    local name=$1
    local url=$2
    local max_attempts=10
    local attempt=1

    echo -n "Checking $name service at $url... "

    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Running${NC}"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ Not responding${NC}"
    return 1
}

# Function to run specific test suite
run_test_suite() {
    local test_file=$1
    local description=$2

    echo -e "\n${YELLOW}📋 Running: $description${NC}"
    echo "Test file: $test_file"
    echo "----------------------------------------"

    if INTEGRATION_TESTS=true npx vitest run "$test_file" --reporter=verbose; then
        echo -e "${GREEN}✅ $description: PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ $description: FAILED${NC}"
        return 1
    fi
}

# Check command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [options] [test-suite]"
    echo ""
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --check-only        Only check services, don't run tests"
    echo "  --skip-checks       Skip service health checks"
    echo ""
    echo "Test suites:"
    echo "  upload              Document upload workflow tests"
    echo "  search              Search consistency tests"
    echo "  chunking            Chunking and embedding tests"
    echo "  all                 All workbench integration tests (default)"
    echo ""
    echo "Examples:"
    echo "  $0                  # Run all tests"
    echo "  $0 upload           # Run only upload tests"
    echo "  $0 --check-only     # Only check if services are running"
    exit 0
fi

# Parse arguments
CHECK_ONLY=false
SKIP_CHECKS=false
TEST_SUITE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --skip-checks)
            SKIP_CHECKS=true
            shift
            ;;
        upload|search|chunking|all)
            TEST_SUITE=$1
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Service health checks
if [ "$SKIP_CHECKS" = false ]; then
    echo -e "${BLUE}🔍 Checking service availability...${NC}"

    services_ok=true

    if ! check_service "Workbench" "$WORKBENCH_URL"; then
        echo -e "${RED}❌ Workbench service not available at $WORKBENCH_URL${NC}"
        echo "Please start the workbench server first:"
        echo "  npm run start:workbench"
        services_ok=false
    fi

    if ! check_service "MCP API" "$WORKBENCH_URL/api"; then
        echo -e "${RED}❌ MCP API not accessible through workbench proxy${NC}"
        echo "Please ensure MCP server is running and properly configured"
        services_ok=false
    fi

    if [ "$services_ok" = false ]; then
        echo -e "\n${RED}❌ Required services are not available${NC}"
        echo "Please start all required services before running tests"
        exit 1
    fi

    echo -e "${GREEN}✅ All required services are running${NC}"

    if [ "$CHECK_ONLY" = true ]; then
        echo -e "\n${GREEN}✅ Service check complete - all systems operational${NC}"
        exit 0
    fi
fi

# Verify INTEGRATION_TESTS environment
if [ -z "$INTEGRATION_TESTS" ]; then
    echo -e "\n${YELLOW}⚠️  Setting INTEGRATION_TESTS=true${NC}"
    export INTEGRATION_TESTS=true
fi

# Run tests based on suite selection
echo -e "\n${BLUE}🚀 Starting integration tests...${NC}"
echo "Test suite: $TEST_SUITE"

failed_tests=0
total_tests=0

case $TEST_SUITE in
    "upload")
        total_tests=1
        run_test_suite "tests/integration/workbench/DocumentUploadWorkflow.integration.test.js" "Document Upload Workflow" || ((failed_tests++))
        ;;
    "search")
        total_tests=1
        run_test_suite "tests/integration/workbench/SearchConsistency.integration.test.js" "Search Consistency" || ((failed_tests++))
        ;;
    "chunking")
        total_tests=1
        run_test_suite "tests/integration/workbench/ChunkingEmbedding.integration.test.js" "Chunking and Embedding" || ((failed_tests++))
        ;;
    "all")
        total_tests=3
        run_test_suite "tests/integration/workbench/DocumentUploadWorkflow.integration.test.js" "Document Upload Workflow" || ((failed_tests++))
        run_test_suite "tests/integration/workbench/SearchConsistency.integration.test.js" "Search Consistency" || ((failed_tests++))
        run_test_suite "tests/integration/workbench/ChunkingEmbedding.integration.test.js" "Chunking and Embedding" || ((failed_tests++))
        ;;
    *)
        echo -e "${RED}❌ Unknown test suite: $TEST_SUITE${NC}"
        exit 1
        ;;
esac

# Summary
echo -e "\n=================================================="
echo -e "${BLUE}📊 Test Summary${NC}"
echo "=================================================="

passed_tests=$((total_tests - failed_tests))
echo "Total test suites: $total_tests"
echo -e "Passed: ${GREEN}$passed_tests${NC}"
echo -e "Failed: ${RED}$failed_tests${NC}"

if [ $failed_tests -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All workbench integration tests passed!${NC}"
    echo -e "${GREEN}✅ Upload -> Chunk -> Embed -> Search workflow is working correctly${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    echo -e "${YELLOW}💡 Check the test output above for details${NC}"
    echo -e "${YELLOW}💡 Ensure all services are properly configured and running${NC}"
    exit 1
fi