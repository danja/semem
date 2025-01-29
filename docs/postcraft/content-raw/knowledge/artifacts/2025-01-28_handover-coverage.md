# Coverage Configuration & Tools

## Istanbul/nyc Setup

### Configuration (.nycrc.json)
```json
{
  "extends": "@istanbuljs/nyc-config-babel",
  "all": true,
  "check-coverage": true,
  "include": ["src/**/*.js"],
  "exclude": [
    "src/**/*.spec.js",
    "src/types/**"
  ],
  "reporter": [
    "text",
    "html",
    "lcov"
  ],
  "branches": 80,
  "lines": 85,
  "functions": 85,
  "statements": 85
}
```

## CI Integration

### GitHub Actions Workflow
```yaml
name: Test & Coverage
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run coverage
        run: npm run test:coverage
      - name: Upload to Codecov
        uses: codecov/codecov-action@v3
```

## Scripts

### Package.json
```json
{
  "scripts": {
    "test:coverage": "nyc npm test",
    "test:report": "nyc report --reporter=html"
  }
}
```

## Coverage Reports

### Locations
```
coverage/
├── lcov-report/     # HTML reports
├── coverage.json    # Raw data
└── lcov.info       # LCOV format
```

### Report Types
1. HTML Report
   - Interactive browsing
   - Line-by-line coverage
   - Branch coverage visualization

2. LCOV Report
   - CI integration
   - Tool consumption
   - Historical tracking

3. Console Summary
   - Quick feedback
   - CI output
   - Threshold checking

## Coverage Exclusions

### File Patterns
```javascript
/* istanbul ignore file */  // Ignore entire file
/* istanbul ignore next */  // Ignore next block
```

### Configuration
```json
{
  "exclude": [
    "src/generated/**",
    "**/*.spec.js"
  ]
}
```

## Integration Points

### 1. VS Code
- Coverage highlighting
- Inline coverage info
- Quick navigation

### 2. GitHub
- PR comments
- Status checks
- Coverage badges

### 3. Codecov
- Trend analysis
- PR feedback
- Team notifications

## Usage Instructions

### Local Development
```bash
# Run tests with coverage
npm run test:coverage

# View report
npm run test:report

# Check thresholds
npm run test:check
```

### CI Pipeline
1. Automated on push/PR
2. Coverage thresholds enforced
3. Reports uploaded to Codecov
4. Status checks updated

## Common Issues

### 1. False Negatives
- Async code coverage
- Branch coverage in promises
- Error handlers

### 2. Configuration
- Path mapping
- Source maps
- Report formats

### 3. Performance
- Instrumentation overhead
- Report generation time
- CI integration

## Maintenance Tasks

### Regular
1. Review coverage reports
2. Update thresholds
3. Clean old reports
4. Check exclusions

### Occasional
1. Update tools
2. Verify CI integration
3. Review patterns
4. Update documentation