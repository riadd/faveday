/**
 * Quality Aggregation Test
 * 
 * Tests that the score aggregation respects the quality setting
 * and that all calculations use the centralized ScoreCalculator
 */

const fs = require('fs');
const vm = require('vm');

// Load ScoreCalculator and configStore
const ScoreCalculator = require('../app/lib/faveday/score-calculator.js');
const configStore = require('../app/lib/faveday/config-store.js');

// Create a mock environment
global.window = {
  configStore: configStore
};

// Create test data
const testScores = [
  { summary: 1 },
  { summary: 2 },  
  { summary: 3 },
  { summary: 4 },
  { summary: 5 }
];

function runTests() {
  console.log('🧪 Running Quality Aggregation Tests...\n');
  
  let passed = 0;
  let total = 0;
  
  function test(description, testFn) {
    total++;
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        console.log(`  ✅ ${description}`);
        passed++;
      } else {
        console.log(`  ❌ ${description} - Expected true, got ${result}`);
      }
    } catch (error) {
      console.log(`  ❌ ${description} - Error: ${error.message}`);
    }
  }
  
  const calculator = new ScoreCalculator();
  
  // Test 1: Default average calculation
  test('Average calculation should work by default', () => {
    configStore.load({
      scoreType: 'average',
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const result = calculator.calculate(testScores);
    const expected = (1 + 2 + 3 + 4 + 5) / 5; // = 3
    return Math.abs(result - expected) < 0.001;
  });
  
  // Test 2: Quality calculation should be different
  test('Quality calculation should use weights', () => {
    configStore.load({
      scoreType: 'quality',
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const result = calculator.calculate(testScores);
    // Expected: (0.2 + 1.0 + 3.0 + 8.0 + 25.0) / 5 = 7.44
    const expected = (0.2 + 1.0 + 3.0 + 8.0 + 25.0) / 5;
    return Math.abs(result - expected) < 0.001;
  });
  
  // Test 3: Median calculation should be different from both
  test('Median calculation should find middle value', () => {
    configStore.load({
      scoreType: 'median',
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const result = calculator.calculate(testScores);
    // Expected: median of [1,2,3,4,5] = 3
    return result === 3;
  });
  
  // Test 4: Quality calculation should handle different data
  test('Quality calculation should handle skewed data correctly', () => {
    const skewedScores = [{ summary: 5 }, { summary: 5 }, { summary: 1 }];
    configStore.load({
      scoreType: 'quality',
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const result = calculator.calculate(skewedScores);
    // Expected: (25.0 + 25.0 + 0.2) / 3 = 16.73
    const expected = (25.0 + 25.0 + 0.2) / 3;
    return Math.abs(result - expected) < 0.01;
  });
  
  // Test 5: Score type changes should be reflected
  test('Changing score type should affect results', () => {
    const scoreData = [{ summary: 1 }, { summary: 5 }];
    
    // Test average
    configStore.load({
      scoreType: 'average',
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const avgResult = calculator.calculate(scoreData);
    
    // Test quality 
    configStore.load({
      scoreType: 'quality',
      lifeQualityWeights: { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 }
    });
    const qualityResult = calculator.calculate(scoreData);
    
    // These should be different
    return Math.abs(avgResult - qualityResult) > 0.1;
  });
  
  console.log('\n📋 Test Results Summary:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${total - passed}`);
  console.log(`  📊 Total:  ${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
    return true;
  } else {
    console.log('\n💥 Some tests failed!');
    return false;
  }
}

if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };