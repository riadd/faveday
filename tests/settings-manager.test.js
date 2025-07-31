// Unit Tests for SettingsManager
// Run with: node tests/settings-manager.test.js

const SettingsManager = require('../app/lib/faveday/settings-manager');

// Mock dependencies
const mockScoreCalculator = {
  clearCache: () => {},
  getLifeQualityWeights: () => Promise.resolve({
    1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
  })
};

const mockRouter = {
  pushHistory: () => {}
};

const mockDataManager = {
  getYears: () => [2023, 2024],
  getAllScores: () => [
    { summary: 4, notes: 'Good day' },
    { summary: 3, notes: 'Average day' },
    { summary: 5, notes: 'Great day' }
  ]
};

// Mock window.api
global.window = {
  api: {
    getConfig: () => Promise.resolve({
      scoreType: 'average',
      defaultEmptyScore: null,
      birthdate: '1990-01-01',
      filesPath: '/test/path',
      lifeQualityWeights: {
        1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
      }
    }),
    setBirthdate: () => Promise.resolve(),
    setLifeQualityWeights: () => Promise.resolve(),
    setScoreType: () => Promise.resolve(),
    setDefaultEmptyScore: () => Promise.resolve()
  },
  app: {
    render: () => '<div>settings</div>',
    showDashboard: () => {}
  },
  Hogan: {
    compile: () => ({ render: () => '<div>template</div>' })
  }
};

// Mock DOM elements
global.document = {
  getElementById: (id) => ({
    value: id === 'birthdate-input' ? '1990-01-01' : '3.0',
    textContent: 'Save',
    style: {},
    nextElementSibling: { textContent: 'Save', style: {} }
  }),
  querySelector: () => ({
    textContent: 'Save',
    style: {}
  })
};

// Mock jQuery
global.$ = () => ({
  html: () => '<template></template>'
});

// Test Suite
class SettingsManagerTest {
  constructor() {
    this.settingsManager = new SettingsManager(mockScoreCalculator, mockRouter, mockDataManager);
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Running SettingsManager Unit Tests...\n');

    await this.testConstruction();
    await this.testConfigAccess();
    await this.testValidation();

    this.printResults();
  }

  async testConstruction() {
    console.log('🏗️ Testing Construction...');
    
    this.assertTrue(this.settingsManager.scoreCalculator === mockScoreCalculator, 'Should store scoreCalculator reference');
    this.assertTrue(this.settingsManager.router === mockRouter, 'Should store router reference');
    this.assertTrue(this.settingsManager.dataManager === mockDataManager, 'Should store dataManager reference');
  }

  async testConfigAccess() {
    console.log('⚙️ Testing Config Access...');
    
    const config = await this.settingsManager.getConfig();
    this.assertEqual(config.scoreType, 'average', 'Should get score type from config');
    this.assertEqual(config.birthdate, '1990-01-01', 'Should get birthdate from config');
  }

  async testValidation() {
    console.log('✅ Testing Validation...');
    
    const validation = this.settingsManager.validateSettings();
    this.assertTrue(validation.hasOwnProperty('isValid'), 'Should return validation object with isValid property');
    this.assertTrue(validation.hasOwnProperty('errors'), 'Should return validation object with errors array');
  }

  assertEqual(actual, expected, message) {
    const passed = actual === expected;
    this.testResults.push({ passed, message, actual, expected });
    
    if (passed) {
      console.log(`  ✅ ${message}`);
    } else {
      console.log(`  ❌ ${message}`);
      console.log(`     Expected: ${expected}, Got: ${actual}`);
    }
  }

  assertTrue(condition, message) {
    const passed = !!condition;
    this.testResults.push({ passed, message, actual: condition, expected: true });
    
    if (passed) {
      console.log(`  ✅ ${message}`);
    } else {
      console.log(`  ❌ ${message}`);
      console.log(`     Expected: true, Got: ${condition}`);
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
  const testSuite = new SettingsManagerTest();
  testSuite.runAllTests().catch(console.error);
}

module.exports = SettingsManagerTest;