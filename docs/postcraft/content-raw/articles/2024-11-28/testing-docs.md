# Testing Documentation

## Unit Tests
Run with: `npm test`

### Storage Tests
```javascript
import { InMemoryStorage } from '../src/inMemoryStorage.js';

describe('InMemoryStorage', () => {
  it('should store and retrieve memories', async () => {
    const storage = new InMemoryStorage();
    // Test implementation
  });
});
```

### Integration Tests
```javascript
describe('MemoryManager Integration', () => {
  it('should generate and store responses', async () => {
    const manager = new MemoryManager({...});
    // Test implementation
  });
});
```

## Mocking
```javascript
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn()
}));
```
