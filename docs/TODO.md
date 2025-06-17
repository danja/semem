# TODO List

## Console.log Replacement

### Overview
We need to replace all direct `console.log` calls with appropriate loglevel methods throughout the codebase. This will provide better log management, filtering, and consistency across the application.

### Files to Update
Run the following command to find all instances of `console.log` that need to be replaced:

```bash
grep -r "console\.log" --include="*.js" src/
```

### Replacement Guidelines

1. **Basic Logging**
   - `console.log('message')` → `logger.info('message')`
   - `console.info('message')` → `logger.info('message')`

2. **Warnings**
   - `console.warn('warning message')` → `logger.warn('warning message')`

3. **Errors**
   - `console.error('error message')` → `logger.error('error message')`

4. **Debug Information**
   - `console.debug('debug info')` → `logger.debug('debug info')`

5. **Trace Information**
   - `console.trace('trace info')` → `logger.trace('trace info')`

### Module-Specific Loggers
For better log filtering, create a module-specific logger:

```javascript
import { createLogger } from '../../utils/logger.js';
const logger = createLogger('module:name');

// Then use it in the module
logger.info('Module initialized');
logger.debug('Debug information', { someData });
```

### Progress
- [ ] Audit all `console.log` usage
- [ ] Replace with appropriate loglevel methods
- [ ] Test logging after replacements
- [ ] Document logging standards in CONTRIBUTING.md

### Notes
- The new logger automatically captures stack traces for error levels
- Log levels can be controlled at runtime
- The console UI shows all logs but can be filtered by level
