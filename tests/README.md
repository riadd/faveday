# FaveDay Tag System Unit Tests

This directory contains unit tests for the FaveDay tag handling system, extracted into isolated, testable modules.

## Structure

```
tests/
├── package.json          # Test dependencies and scripts
├── test-runner.js         # Simple test framework
├── tag-parser.test.js     # Tests for tag parsing functionality
├── tag-cache.test.js      # Tests for tag cache operations
├── demo.js               # Interactive demo script
└── README.md             # This file

app/lib/faveday/          # App libraries (tests import from here)
├── tag-parser.js         # Tag parsing logic
└── tag-cache.js          # Tag cache operations
```

## Running Tests

### Prerequisites
- Node.js installed
- No external dependencies (uses built-in Node.js modules)

### Run All Tests
```bash
cd tests
node test-runner.js
```

### Run Tests via npm
```bash
cd tests
npm test
```

## Test Coverage

### Tag Parser Tests (`tag-parser.test.js`)
- ✅ Basic tag extraction (#hashtags and @mentions)
- ✅ Unicode character support in tags
- ✅ Position tracking for tags
- ✅ Tag classification (person vs topic)
- ✅ CamelCase to space conversion
- ✅ First name extraction from person tags
- ✅ Overlap detection with existing tags
- ✅ Word boundary regex creation
- ✅ Person suggestion finding
- ✅ Topic suggestion finding
- ✅ Minimum usage thresholds
- ✅ Duplicate prevention

### Tag Cache Tests (`tag-cache.test.js`)
- ✅ Basic tag statistics calculation
- ✅ Average score computation
- ✅ Original tag casing preservation
- ✅ Person vs topic tag identification
- ✅ Year-based usage statistics
- ✅ Peak year calculation
- ✅ First/last usage date tracking
- ✅ Recent activity marking
- ✅ Tag queries and filtering
- ✅ Sorting by different criteria
- ✅ Edge cases (empty data, malformed tags)
- ✅ Case-insensitive deduplication

## Key Features Tested

### Tag Detection Regex
The system uses `/([#@])\\p{L}[\\p{L}\\d]*/gui` to detect:
- Topic tags: `#javascript`, `#webDev`, `#café`
- Person tags: `@john`, `@marySue`, `@naïve`
- Unicode support for international characters
- Numbers in tags: `#web2`, `@user123`

### Tag Cache System
- Comprehensive statistics per tag
- Usage counts and average scores
- Year-based breakdowns
- Peak activity periods
- Recent activity tracking
- Person vs topic classification
- Original casing preservation

### Suggestion Engine
- Person suggestions based on first names
- Topic suggestions from full names and camelCase parts
- Overlap prevention with existing tags
- Configurable thresholds
- Duplicate prevention

## Benefits of This Test Suite

1. **Isolated Testing**: Tests run without requiring the full Electron app
2. **Fast Feedback**: Quick iteration on tag-related features
3. **Regression Prevention**: Catch tag parsing/cache issues early
4. **Documentation**: Tests serve as living documentation of tag behavior
5. **Refactoring Safety**: Safe to modify tag code with test coverage
6. **No Code Duplication**: Tests use the actual app libraries, not duplicated code

## Development Workflow

1. **Make Changes**: Modify tag logic in `app/lib/faveday/tag-parser.js` or `app/lib/faveday/tag-cache.js`
2. **Run Tests**: Execute `node test-runner.js` to verify changes
3. **Update Tests**: Add new tests for new features
4. **No Integration Step**: Changes are automatically reflected in both app and tests!

## Adding New Tests

To add a new test:

```javascript
describe('New Feature Tests', () => {
  it('should do something specific', () => {
    // Test code here
    assert.strictEqual(actual, expected);
  });
});
```

The test runner will automatically discover and run any `.test.js` files in the tests directory.

## Future Enhancements

Potential areas for additional testing:
- Performance benchmarks for large tag datasets
- Memory usage analysis
- Tag rendering HTML output validation
- Integration tests with mock score data
- Fuzzing tests for edge cases
- Tag migration/upgrade scenarios