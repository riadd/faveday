// Comprehensive Unit Tests for ScoreCalculator
// Run with: node tests/score-calculator.test.js

const fs = require('fs');
const path = require('path');

// Import the ScoreCalculator class and config store
const ScoreCalculator = require('../app/lib/faveday/score-calculator');
const configStore = require('../app/lib/faveday/config-store');

// Mock Sugar.js array extensions for testing
Array.prototype.average = function(mapper) {
  if (this.length === 0) return 0;
  const sum = this.reduce((acc, item) => acc + (mapper ? mapper(item) : item), 0);
  return sum / this.length;
};

Array.prototype.median = function(mapper) {
  if (this.length === 0) return 0;
  const mapped = this.map(mapper || (x => x)).sort((a, b) => a - b);
  const mid = Math.floor(mapped.length / 2);
  return mapped.length % 2 === 0 
    ? (mapped[mid - 1] + mapped[mid]) / 2 
    : mapped[mid];
};

// Mock window.configStore for testing
global.window = {
  configStore: configStore
};

// Test Suite
class ScoreCalculatorTest {
  constructor() {
    this.calculator = new ScoreCalculator();
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Running ScoreCalculator Unit Tests...\n');

    await this.testBasicCalculations();
    await this.testDefaultEmptyScoreHandling();
    await this.testScoreTypeCalculations();
    await this.testEdgeCases();
    await this.testConfigCaching();

    this.printResults();
  }

  testBasicCalculations() {
    console.log('📊 Testing Basic Calculations...');

    // Test average calculation
    const scores1 = [
      { summary: 1 }, { summary: 2 }, { summary: 3 }, { summary: 4 }, { summary: 5 }
    ];
    const avgResult = this.calculator.calculate(scores1);
    this.assertEqual(avgResult, 3, 'Average of 1,2,3,4,5 should be 3');

    // Test with empty scores mixed in
    const scores2 = [
      { summary: 2 }, { summary: 0 }, { summary: 4 }, { summary: 0 }, { summary: 4 }
    ];
    const avgResult2 = this.calculator.calculate(scores2);
    this.assertEqual(avgResult2, (2 + 4 + 4) / 3, 'Should skip empty scores by default');
  }

  testDefaultEmptyScoreHandling() {
    console.log('🔢 Testing Default Empty Score Handling...');

    // Test with default empty score
    configStore.load({
      scoreType: 'average',
      defaultEmptyScore: 2.5,
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });

    const scores = [
      { summary: 4 }, { summary: 0 }, { summary: 3 }, { summary: 0 }, { summary: 5 }
    ];
    
    // Test with expectedCount to trigger default score behavior
    const result = this.calculator.calculate(scores, 5);
    const expected = (4 + 2.5 + 3 + 2.5 + 5) / 5; // 17 / 5 = 3.4
    this.assertEqual(result, expected, 'Should use 2.5 for empty scores with expectedCount');

    // Test with null (skip empty)
    configStore.load({
      scoreType: 'average',
      defaultEmptyScore: null,
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });

    const result2 = this.calculator.calculate(scores);
    const expected2 = (4 + 3 + 5) / 3; // 12 / 3 = 4
    this.assertEqual(result2, expected2, 'Should skip empty scores when defaultEmptyScore is null');
  }

  testScoreTypeCalculations() {
    console.log('📈 Testing Different Score Types...');

    const scores = [
      { summary: 1 }, { summary: 2 }, { summary: 3 }, { summary: 4 }, { summary: 5 }
    ];

    // Test Average
    configStore.load({
      scoreType: 'average',
      defaultEmptyScore: null,
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const avgResult = this.calculator.calculate(scores);
    this.assertEqual(avgResult, 3, 'Average should be 3');

    // Test Median
    configStore.load({
      scoreType: 'median',
      defaultEmptyScore: null,
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const medianResult = this.calculator.calculate(scores);
    this.assertEqual(medianResult, 3, 'Median should be 3');

    // Test Quality
    configStore.load({
      scoreType: 'quality',
      defaultEmptyScore: null,
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const qualityResult = this.calculator.calculate(scores);
    const expectedQuality = (0.2 + 1.0 + 3.0 + 8.0 + 25.0) / 5; // 37.2 / 5 = 7.44
    this.assertEqual(qualityResult, expectedQuality, 'Quality calculation should use weights');
  }

  testEdgeCases() {
    console.log('🔍 Testing Edge Cases...');

    // Set config for edge case tests
    configStore.load({
      scoreType: 'average',
      defaultEmptyScore: null,
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });

    // Empty array
    const emptyResult = this.calculator.calculate([]);
    this.assertEqual(emptyResult, 0, 'Empty array should return 0');

    // All zero scores
    const zeroScores = [{ summary: 0 }, { summary: 0 }, { summary: 0 }];
    const zeroResult = this.calculator.calculate(zeroScores);
    this.assertEqual(zeroResult, 0, 'All zero scores should return 0');

    // Single score
    const singleScore = [{ summary: 4 }];
    const singleResult = this.calculator.calculate(singleScore);
    this.assertEqual(singleResult, 4, 'Single score should return that score');
  }

  testConfigCaching() {
    console.log('⚡ Testing Config Storage...');

    // Test that configStore properly stores configuration
    const testConfig = {
      scoreType: 'quality',
      defaultEmptyScore: 3,
      lifeQualityWeights: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }
    };
    
    configStore.load(testConfig);

    // Verify stored values
    this.assertEqual(this.calculator.getScoreType(), 'quality', 'Score type should be stored correctly');
    this.assertEqual(this.calculator.getDefaultEmptyScore(), 3, 'Default empty score should be stored correctly');
    
    const weights = this.calculator.getLifeQualityWeights();
    this.assertEqual(weights[5], 5, 'Quality weights should be stored correctly');

    // Test that config persists across multiple calls
    this.assertEqual(this.calculator.getScoreType(), 'quality', 'Config should persist across calls');
    this.assertEqual(this.calculator.getScoreType(), 'quality', 'Config should persist across multiple calls');
  }

  assertEqual(actual, expected, message) {
    let passed;
    if (typeof expected === 'number' && typeof actual === 'number') {
      // Handle floating point precision for numbers
      passed = Math.abs(actual - expected) < 0.0001;
    } else {
      // Exact equality for strings and other types
      passed = actual === expected;
    }
    
    this.testResults.push({ passed, message, actual, expected });
    
    if (passed) {
      console.log(`  ✅ ${message}`);
    } else {
      console.log(`  ❌ ${message}`);
      console.log(`     Expected: ${expected}, Got: ${actual}`);
    }
  }

  printResults() {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const failed = total - passed;

    console.log('\n📋 Test Results Summary:');
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📊 Total:  ${total}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.passed).forEach(test => {
        console.log(`  - ${test.message} (Expected: ${test.expected}, Got: ${test.actual})`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new ScoreCalculatorTest();
  testSuite.runAllTests().catch(console.error);
}

module.exports = ScoreCalculatorTest;