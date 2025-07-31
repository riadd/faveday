/**
 * Unit tests for ScoreCalculator NaN edge cases and expected days calculation
 * Run with: node tests/score-calculator-nan.test.js
 */

// Import ScoreCalculator
const ScoreCalculator = require('../app/lib/faveday/score-calculator');

// Mock window.api for testing
global.window = {
  api: {
    getConfig: () => ({
      scoreType: 'average',
      defaultEmptyScore: null,
      lifeQualityWeights: {
        1: 0.2,
        2: 1.0,
        3: 3.0,
        4: 8.0,
        5: 25.0
      }
    })
  }
};

// Test runner
let tests = [];
let passed = 0;
let failed = 0;

function addTest(name, testFunc) {
  tests.push({ name, testFunc });
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
  }
}

function assertFalse(condition, message = '') {
  if (condition) {
    throw new Error(`Expected false, got ${condition}. ${message}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(`Expected true, got ${condition}. ${message}`);
  }
}

function runTests() {
  console.log(`Running ${tests.length} tests...\n`);
  
  tests.forEach(test => {
    try {
      test.testFunc();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Test basic calculation with valid data
addTest('Basic average calculation', () => {
  const calculator = new ScoreCalculator();
  const scores = [
    { date: new Date('2024-01-01'), summary: 3, notes: 'test' },
    { date: new Date('2024-01-02'), summary: 4, notes: 'test' },
    { date: new Date('2024-01-03'), summary: 5, notes: 'test' }
  ];
  
  const result = calculator.calculate(scores);
  assertEqual(result, 4); // (3+4+5)/3 = 4
});

// Test with empty scores
addTest('Empty scores returns 0', () => {
  const calculator = new ScoreCalculator();
  const result = calculator.calculate([]);
  assertEqual(result, 0);
});

// Test with undefined/null scores
addTest('Null scores returns 0', () => {
  const calculator = new ScoreCalculator();
  const result = calculator.calculate(null);
  assertEqual(result, 0);
});

// Test with scores containing NaN values
addTest('Scores with NaN values should not return NaN', () => {
  const calculator = new ScoreCalculator();
  const scores = [
    { date: new Date('2024-01-01'), summary: 3, notes: 'test' },
    { date: new Date('2024-01-02'), summary: NaN, notes: 'test' },
    { date: new Date('2024-01-03'), summary: 5, notes: 'test' }
  ];
  
  const result = calculator.calculate(scores);
  assertFalse(isNaN(result), 'Result should not be NaN');
});

// Test with scores containing undefined summary
addTest('Scores with undefined summary should not return NaN', () => {
  const calculator = new ScoreCalculator();
  const scores = [
    { date: new Date('2024-01-01'), summary: 3, notes: 'test' },
    { date: new Date('2024-01-02'), summary: undefined, notes: 'test' },
    { date: new Date('2024-01-03'), summary: 5, notes: 'test' }
  ];
  
  const result = calculator.calculate(scores);
  assertFalse(isNaN(result), 'Result should not be NaN');
});

// Test expected days calculation with default empty score
addTest('Expected days calculation with default empty score', () => {
  // Mock config with default empty score
  global.window.api.getConfig = () => ({
    scoreType: 'average',
    defaultEmptyScore: 2.5,
    lifeQualityWeights: {
      1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
    }
  });
  
  const calculator = new ScoreCalculator();
  const scores = [
    { date: new Date('2024-01-01'), summary: 4, notes: 'test' },
    { date: new Date('2024-01-02'), summary: 5, notes: 'test' }
  ];
  
  // 365 expected days, 2 actual scores, 363 missing days with default 2.5
  // (4 + 5 + 363 * 2.5) / 365 = (9 + 907.5) / 365 = 916.5 / 365 ≈ 2.51
  const result = calculator.calculate(scores, 365);
  assertFalse(isNaN(result), 'Result should not be NaN');
  assertTrue(result > 2.4 && result < 2.6, `Expected ~2.51, got ${result}`);
});

// Test expected days calculation without default empty score
addTest('Expected days calculation without default empty score', () => {
  // Mock config without default empty score
  global.window.api.getConfig = () => ({
    scoreType: 'average',
    defaultEmptyScore: null,
    lifeQualityWeights: {
      1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
    }
  });
  
  const calculator = new ScoreCalculator();
  const scores = [
    { date: new Date('2024-01-01'), summary: 4, notes: 'test' },
    { date: new Date('2024-01-02'), summary: 5, notes: 'test' }
  ];
  
  // Should ignore expected days and just calculate average of actual scores
  const result = calculator.calculate(scores, 365);
  assertEqual(result, 4.5); // (4+5)/2 = 4.5
});

// Test year calculation (leap year vs non-leap year)
addTest('Leap year has 366 days', () => {
  const year = 2024; // leap year
  const isLeapYear = ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0));
  const expectedDays = isLeapYear ? 366 : 365;
  assertEqual(expectedDays, 366);
});

addTest('Non-leap year has 365 days', () => {
  const year = 2023; // non-leap year
  const isLeapYear = ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0));
  const expectedDays = isLeapYear ? 366 : 365;
  assertEqual(expectedDays, 365);
});

// Test month calculation
addTest('February 2024 has 29 days', () => {
  const daysInMonth = new Date(2024, 2, 0).getDate(); // Feb 2024
  assertEqual(daysInMonth, 29);
});

addTest('February 2023 has 28 days', () => {
  const daysInMonth = new Date(2023, 2, 0).getDate(); // Feb 2023
  assertEqual(daysInMonth, 28);
});

// Test median calculation
addTest('Median calculation with odd number of scores', () => {
  const calculator = new ScoreCalculator();
  
  // Mock config for median
  global.window.api.getConfig = () => ({
    scoreType: 'median',
    defaultEmptyScore: null
  });
  
  const scores = [
    { summary: 1 }, { summary: 3 }, { summary: 5 }
  ];
  
  const result = calculator.calculate(scores);
  assertEqual(result, 3); // median of [1,3,5] is 3
});

addTest('Median calculation with even number of scores', () => {
  const calculator = new ScoreCalculator();
  
  // Mock config for median
  global.window.api.getConfig = () => ({
    scoreType: 'median',
    defaultEmptyScore: null
  });
  
  const scores = [
    { summary: 2 }, { summary: 4 }, { summary: 6 }, { summary: 8 }
  ];
  
  const result = calculator.calculate(scores);
  assertEqual(result, 5); // median of [2,4,6,8] is (4+6)/2 = 5
});

// Test quality calculation
addTest('Quality calculation', () => {
  const calculator = new ScoreCalculator();
  
  // Mock config for quality
  global.window.api.getConfig = () => ({
    scoreType: 'quality',
    defaultEmptyScore: null,
    lifeQualityWeights: {
      1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
    }
  });
  
  const scores = [
    { summary: 1 }, { summary: 5 }
  ];
  
  const result = calculator.calculate(scores);
  // (0.2 + 25.0) / 2 = 12.6
  assertEqual(result, 12.6);
});

// Test edge case: Division by zero protection
addTest('Division by zero protection', () => {
  const calculator = new ScoreCalculator();
  const result = calculator.calculateAverage([], 0, 0);
  assertEqual(result, 0);
});

// Test edge case: Invalid expectedCount
addTest('Invalid expectedCount should not cause NaN', () => {
  const calculator = new ScoreCalculator();
  const scores = [{ summary: 3 }];
  
  const result1 = calculator.calculate(scores, NaN);
  const result2 = calculator.calculate(scores, undefined);
  const result3 = calculator.calculate(scores, "invalid");
  
  assertFalse(isNaN(result1), 'NaN expectedCount should not return NaN');
  assertFalse(isNaN(result2), 'Undefined expectedCount should not return NaN');
  assertFalse(isNaN(result3), 'String expectedCount should not return NaN');
});

// Run the tests
runTests();