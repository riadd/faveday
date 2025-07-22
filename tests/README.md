# FaveDay Test Suite

A comprehensive, organized test suite for the FaveDay journaling application.

## 📁 Test Structure

```
tests/
├── test-framework.js          # Unified testing framework and utilities
├── run-all-tests.js           # Main test runner
├── widgets/                   # Widget-specific tests
│   ├── core-widgets.test.js   # Tests for essential dashboard widgets
│   └── new-widgets.test.js    # Tests for newly added widgets
├── tag-parser.test.js         # Tag parsing functionality tests
├── tag-cache.test.js          # Tag cache operations tests
├── navigation.test.js         # UI navigation tests
├── journey-analytics.test.js  # Analytics page tests
├── test-runner.js             # Legacy test runner
├── package.json               # Test dependencies
└── README.md                  # This file
```

## 🚀 Running Tests

### Run All Modern Tests (Recommended)
```bash
node tests/run-all-tests.js
```

### Run Specific Test Suite
```bash
node tests/run-all-tests.js --suite "Core Widgets"
node tests/run-all-tests.js --suite "New Widgets"
```

### List Available Test Suites
```bash
node tests/run-all-tests.js --list
```

### Run Individual Test Files
```bash
node tests/widgets/core-widgets.test.js
node tests/widgets/new-widgets.test.js
```

### Run Legacy Tests
```bash
node tests/test-runner.js              # Tag system tests
```

## 🧪 Test Framework Features

### Unified Test Framework
- **Consistent API**: `describe()`, `test()`, assertions
- **Built-in Mocks**: MockFaveDayApp, localStorage simulation
- **Test Data Generators**: Helper functions for creating realistic test data
- **Comprehensive Assertions**: `assertEqual()`, `assertTrend()`, `assertBetween()`, etc.

### Mock Data Utilities
```javascript
// Generate score entries
framework.generateScoreEntry(daysAgo, score, notes)

// Generate workweek data
framework.generateWorkweekData(mondayDaysAgo, [scores], notes)

// Generate tagged entries
framework.generateTaggedEntries(count, daysAgo, tag, avgScore)
```

### Widget Testing
- **MockFaveDayApp**: Simulates real app with test data
- **Tag Cache Simulation**: Automatic tag cache generation for realistic testing
- **Date-aware Testing**: Handles relative dates and time periods correctly

## 📊 Test Categories

### Core Widgets Tests
Tests essential dashboard functionality:
- **30-Day Comparisons**: Entry counts, score averages, trends
- **Edge Cases**: Empty data, single entries, boundary conditions
- **Trend Logic**: Proper up/down/same trend calculations

### New Widgets Tests  
Tests recently added analytics widgets:
- **Lazy Workweeks**: Workday point calculations, weekend filtering
- **Season Progress**: Current season detection, progress calculation
- **Trending Tags**: Surge detection, staple filtering (future)
- **Consistency Metrics**: Standard deviation calculations (future)

### Legacy Tests (Individual Files)
- **Tag Parser Tests**: Tag extraction, Unicode support, position tracking
- **Tag Cache Tests**: Statistics, average scores, year-based data
- **Navigation Tests**: UI flow and interaction testing
- **Analytics Tests**: Journey analytics page validation

## 🎯 Best Practices

### Test Naming Convention
- **Descriptive Names**: "30-Day Entry Comparison - More Recent Entries"
- **Scenario-Based**: What situation is being tested
- **Expected Outcome**: What should happen

### Test Structure
```javascript
framework.test('Widget Feature - Specific Scenario', () => {
  // 1. Setup test data
  const testData = [...];
  
  // 2. Execute widget function
  const app = new MockFaveDayApp(testData);
  const result = app.getWidgetFunction();
  
  // 3. Assert expected outcomes
  framework.assertEqual(result.value, expected, 'Description');
  framework.assertTrend(result.trend, 'up', 'Trend explanation');
  
  return true; // Test passed
});
```

### Data Generation
- **Realistic Scenarios**: Use representative data patterns
- **Edge Cases**: Test boundary conditions
- **Date Handling**: Use relative dates (daysAgo) for consistency

## 🔧 Extending Tests

### Adding New Test Suites
1. Create test file in appropriate directory (e.g., `tests/features/new-feature.test.js`)
2. Import test framework: `const { TestFramework, MockFaveDayApp } = require('../test-framework');`
3. Export test function: `module.exports = { runNewFeatureTests };`
4. Register in `run-all-tests.js`: `this.registerTestSuite('New Feature', runNewFeatureTests);`

### Adding New Widget Methods to Mock
Update `MockFaveDayApp` in `test-framework.js` with new widget calculation methods.

### Custom Assertions
Add specialized assertion methods to `TestFramework` class for domain-specific testing needs.

## 📈 Test Results

The test runner provides comprehensive results:
- **Individual Test Status**: ✅ Pass or ❌ Fail with error details
- **Suite Summary**: Pass/fail counts and success rates
- **Overall Results**: Multi-suite summary with timing
- **Failure Analysis**: Detailed error messages and debugging tips

## 🛠️ Troubleshooting

### Common Issues
- **Date Dependencies**: Tests may behave differently based on current date
- **Mock Data**: Ensure test data represents realistic usage patterns
- **Async Operations**: Widget functions are synchronous, but framework supports async

### Debug Mode
Add `console.log` statements in test data or mock functions to debug issues:
```javascript
const result = app.getWidget();
console.log('Debug result:', JSON.stringify(result, null, 2));
```

## 🎉 Success Metrics

A successful test run should show:
- All test suites passing (100% success rate)
- Fast execution times (< 100ms per suite)
- Clear, descriptive test names
- Comprehensive coverage of widget functionality

## 🔄 Migration Notes

### New vs Legacy Tests
- **New Tests**: Use unified framework, located in `widgets/` subdirectory
- **Legacy Tests**: Individual files, existing functionality testing
- **Both Are Valid**: Legacy tests continue to work for tag system validation

### Gradual Migration
- New widget tests use modern framework
- Legacy tests remain for existing features
- Future tests should use unified framework

This test suite ensures FaveDay widgets are reliable, consistent, and working as expected across all scenarios.