# Testing Guide - GenPwd Pro

## Overview

GenPwd Pro uses a comprehensive testing strategy covering unit tests, integration tests, and contract tests to ensure reliability and maintainability.

**Test Coverage Goals:**
- **Target:** 95%+ code coverage for core modules
- **Current:** See coverage reports via `npm run test:coverage`
- **Focus:** Core logic, utilities, and business rules

## Test Architecture

### Test Types

1. **Unit Tests** - Test individual functions and modules in isolation
2. **Integration Tests** - Test module interactions and workflows
3. **Contract Tests** - Test API contracts and interfaces (Vault module)
4. **Regression Tests** - Prevent previously fixed bugs from reoccurring

### Test Environments

- **Node.js Tests:** `tools/run_tests.cjs` - Fast, automated tests for core logic
- **Browser Tests:** `src/tests/test-suite.js` - UI and DOM-dependent tests
- **Coverage Tests:** c8 for ES module coverage tracking

## Running Tests

### Quick Reference

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run browser tests
npm run test:browser

# Run linter
npm run lint
```

### Test Structure

```
genpwd-pro/
├── src/tests/               # Browser-based test suites
│   ├── test-suite.js       # Main UI test suite
│   └── test-new-features.js # New features tests
├── src/js/vault/tests/     # Vault contract tests
│   └── contract-tests.js
└── tools/
    └── run_tests.cjs       # Node.js test runner
```

## Writing Tests

### Test Conventions

1. **Naming:** Use descriptive names that explain what is being tested
   ```javascript
   {
     name: 'Validators - validateString success',
     run: async () => { /* test implementation */ }
   }
   ```

2. **Assertions:** Use clear assertion messages
   ```javascript
   assert(result.valid === true, 'Should validate non-empty string');
   ```

3. **Test Coverage:** Each test should cover:
   - ✅ Success cases (happy path)
   - ❌ Failure cases (error handling)
   - 🔄 Edge cases (boundary conditions)

### Adding Tests to Node.js Test Runner

```javascript
// In tools/run_tests.cjs, add to buildTests() array:
{
  name: 'Your Test Name',
  run: async (ctx) => {
    // Import module if needed
    const { yourFunction } = this.modules.yourModule;

    // Test implementation
    const result = yourFunction('input');

    // Assertions
    assert(result === 'expected', 'Error message if failed');

    // Return sample for logging
    return { sample: 'Test passed' };
  }
}
```

### Test Module Structure

```javascript
// Import modules in main() function
const yourModule = await importModule('src/js/path/to/module.js');

// Pass to NodeTestRunner constructor
const runner = new NodeTestRunner({
  // ... existing modules
  yourModule: yourModule
});
```

## Test Coverage

### Current Coverage by Module

| Module | Coverage | Status |
|--------|----------|--------|
| **validators.js** | 99.39% | ✅ Excellent |
| **generators.js** | 90.16% | ✅ Good |
| **constants.js** | 93.20% | ✅ Good |
| **helpers.js** | 76.70% | ⚠️ Needs improvement |
| **casing.js** | 76.31% | ⚠️ Needs improvement |
| **vault/** | 80.00% | ✅ Good |
| **dictionaries.js** | 54.40% | ❌ Needs tests |
| **UI modules** | 0% | ⚠️ Requires browser testing |

### Viewing Coverage Reports

After running `npm run test:coverage`, open the HTML report:

```bash
# Generate coverage report
npm run test:coverage

# Open report in browser (Linux)
xdg-open coverage/index.html

# Open report in browser (macOS)
open coverage/index.html

# Open report in browser (Windows)
start coverage/index.html
```

### Coverage Configuration

Coverage thresholds are configured in `.c8rc.json`:

```json
{
  "lines": 95,
  "statements": 95,
  "functions": 90,
  "branches": 85
}
```

## Test Examples

### Unit Test Example

```javascript
{
  name: 'Validators - validateInteger success',
  run: async () => {
    const validators = this.modules.validators;

    // Test integer validation
    const r1 = validators.validateInteger(5, 1, 10, 'test');
    assert(r1.valid === true && r1.value === 5, 'Should validate integer');

    // Test string to integer conversion
    const r2 = validators.validateInteger('7', 1, 10, 'test');
    assert(r2.valid === true && r2.value === 7, 'Should validate string integer');

    return { sample: 'Valid integers' };
  }
}
```

### Integration Test Example

```javascript
{
  name: '#ENTROPY-MIN: Vérification entropie ≥100 bits',
  run: async () => {
    const generatorConfig = {
      length: 12,
      policy: 'standard',
      digits: 0,
      specials: 0
    };

    const entropyTest = await ensureMinimumEntropy(
      () => generateSyllables(generatorConfig),
      { mode: 'syllables', policy: 'standard' }
    );

    assert(entropyTest.entropy >= 100,
      `Entropie ${entropyTest.entropy} bits < 100`);

    return { sample: entropyTest.value, entropy: entropyTest.entropy };
  }
}
```

### Contract Test Example

```javascript
// In src/js/vault/tests/contract-tests.js
export const testCases = [
  {
    name: 'VaultRepository CRUD',
    test: async ({ repo, sampleEntries }) => {
      // Create
      await repo.create(sampleEntries[0]);

      // Read
      const entry = await repo.findById(sampleEntries[0].id);
      assert(entry !== null, 'Should find created entry');

      // Update
      entry.metadata.lastModified = Date.now();
      await repo.update(entry.id, entry);

      // Delete
      await repo.delete(entry.id);
      const deleted = await repo.findById(entry.id);
      assert(deleted === null, 'Should delete entry');
    }
  }
];
```

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on other tests:

```javascript
// ✅ Good - Self-contained test
{
  name: 'Test A',
  run: async () => {
    const input = createTestData();
    const result = processData(input);
    assert(result.valid === true, 'Should process data');
  }
}

// ❌ Bad - Depends on external state
let sharedState = null;
{
  name: 'Test B',
  run: async () => {
    sharedState = processData(input); // Modifies shared state
  }
}
```

### 2. Descriptive Assertions

Use clear, descriptive assertion messages:

```javascript
// ✅ Good - Clear message
assert(result.length === 20, 'Password length should be exactly 20 characters');

// ❌ Bad - Vague message
assert(result.length === 20, 'Length incorrect');
```

### 3. Test Edge Cases

Always test boundary conditions:

```javascript
{
  name: 'Validators - validatePercentage boundaries',
  run: async () => {
    // Test minimum boundary
    const r1 = validators.validatePercentage(0, 'test');
    assert(r1.valid === true, 'Should accept 0%');

    // Test maximum boundary
    const r2 = validators.validatePercentage(100, 'test');
    assert(r2.valid === true, 'Should accept 100%');

    // Test below minimum
    const r3 = validators.validatePercentage(-1, 'test');
    assert(r3.valid === false, 'Should reject negative percentage');

    // Test above maximum
    const r4 = validators.validatePercentage(101, 'test');
    assert(r4.valid === false, 'Should reject percentage > 100');
  }
}
```

### 4. Use Seeded Randomness

For deterministic tests with random components:

```javascript
// Use withSeed helper for reproducible randomness
{
  name: 'Syllables - Base',
  run: async (ctx) => withSeed(100 + ctx.run, () => {
    const result = generateSyllables({ length: 20 /* ... */ });
    assert(result.value.length === 20, 'Length should be 20');
    return { sample: result.value };
  })
}
```

### 5. Test Error Handling

Verify that errors are properly handled:

```javascript
{
  name: 'Validators - validateInteger failures',
  run: async () => {
    const r1 = validators.validateInteger(3.5, 1, 10, 'test');
    assert(r1.valid === false, 'Should reject non-integer');
    assert(r1.error.includes('integer'), 'Error message should mention integer');

    const r2 = validators.validateInteger(NaN, 1, 10, 'test');
    assert(r2.valid === false, 'Should reject NaN');
  }
}
```

## Debugging Tests

### Failed Test Analysis

When a test fails:

1. **Check the error message**
   ```
   ❌ Validators - validateInteger failures - Should reject float
   ```

2. **Review the assertion**
   ```javascript
   assert(r1.valid === false, 'Should reject float');
   ```

3. **Inspect the actual vs. expected values**
   ```javascript
   console.log('Expected:', false);
   console.log('Actual:', r1.valid);
   console.log('Full result:', r1);
   ```

4. **Run the specific test in isolation** (modify test runner to run only that test)

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Flaky tests** | Non-deterministic randomness | Use `withSeed()` helper |
| **DOM not available** | Browser APIs in Node.js tests | Mock DOM or move to browser tests |
| **Module not found** | Incorrect import path | Verify path relative to project root |
| **Timeout** | Async operation not awaited | Add `await` or increase timeout |

## Continuous Integration

### GitHub Actions CI/CD

Tests run automatically on:
- Every push to feature branches
- Every pull request
- Daily scheduled runs (main branch)

See `.github/workflows/ci.yml` for configuration.

### Pre-commit Hooks

Consider adding pre-commit hooks to run tests before committing:

```bash
# In package.json
{
  "scripts": {
    "precommit": "npm run lint && npm test"
  }
}
```

## Test Maintenance

### When to Update Tests

- **Adding new features:** Write tests first (TDD) or immediately after
- **Fixing bugs:** Add regression test to prevent recurrence
- **Refactoring:** Ensure tests still pass without modification
- **Deprecating features:** Remove or update corresponding tests

### Test Review Checklist

- [ ] Test names are descriptive and clear
- [ ] Both success and failure cases are covered
- [ ] Edge cases and boundaries are tested
- [ ] Assertions have clear error messages
- [ ] Tests are isolated and independent
- [ ] No hardcoded values that should be configurable
- [ ] Async operations are properly awaited
- [ ] Test performance is acceptable (< 100ms per test ideally)

## Resources

### Internal Documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development setup and workflow
- [API.md](./API.md) - API reference documentation
- [TECHNICAL.md](./TECHNICAL.md) - Technical architecture

### External Resources
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [c8 Documentation](https://github.com/bcoe/c8)
- [ES Modules Testing](https://nodejs.org/api/esm.html)

## FAQ

### Q: Why are UI modules showing 0% coverage?

**A:** UI modules require a browser environment (DOM APIs). Coverage is measured during Node.js tests which don't have a DOM. Use browser-based tests (`npm run test:browser`) for UI coverage.

### Q: How do I test async functions?

**A:** Use `async/await` in your test function:
```javascript
{
  name: 'Async Test',
  run: async () => {
    const result = await asyncFunction();
    assert(result.success === true, 'Should succeed');
  }
}
```

### Q: How do I mock dependencies?

**A:** For Node.js tests, set up mocks before importing modules:
```javascript
// Mock before import
global.localStorage = {
  getItem: (key) => mockStorage.get(key),
  setItem: (key, val) => mockStorage.set(key, val)
};

// Then import module
const module = await importModule('src/js/utils/module.js');
```

### Q: Why is coverage lower than expected?

**A:** Check:
1. Are all code paths exercised? (branches, conditions)
2. Are error handlers tested?
3. Are default parameters tested?
4. Run `npm run test:coverage` and open HTML report to see uncovered lines

## Contributing

When contributing tests:

1. Follow existing test structure and naming conventions
2. Ensure tests pass locally before pushing
3. Aim for 95%+ coverage on new code
4. Update this documentation if adding new test patterns

---

**Last Updated:** 2025-11-14
**Version:** 2.6.0
**Test Count:** 40+ unit tests, 5 contract tests
