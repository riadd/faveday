// Unit Tests for DataManager
// Run with: node tests/data-manager.test.js

const DataManager = require('../app/lib/faveday/data-manager');

// Mock Score class for testing
global.Score = class Score {
  constructor(date, summary, notes) {
    this.date = new Date(date);
    this.summary = summary;
    this.notes = notes;
  }
  
  dateId() {
    return this.date.toISOString().split('T')[0];
  }
  
  dateStr() {
    return this.date.toLocaleDateString();
  }
  
  monthId() {
    return `${this.date.getFullYear()}-${(this.date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  
  weekday() {
    return this.date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  empty() {
    return this.summary == null ? 'empty' : '';
  }
  
  styleClass() {
    return `score-${this.summary}`;
  }
  
  summaryText() {
    return this.summary || "?";
  }
  
  enhancedText(tagCache) {
    return this.notes;
  }
};

// Mock window.api for testing
global.window = {
  api: {
    loadScores: () => Promise.resolve([
      { date: '2024-01-01', summary: 4, notes: 'Good start to the year' },
      { date: '2024-01-02', summary: 3, notes: 'Regular day' },
      { date: '2024-01-03', summary: 5, notes: 'Amazing day!' }
    ]),
    saveScores: (scores) => Promise.resolve(),
    getTagCache: () => Promise.resolve({})
  }
};

// Test Suite
class DataManagerTest {
  constructor() {
    this.dataManager = new DataManager();
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Running DataManager Unit Tests...\n');

    await this.testLoadScores();
    await this.testGetScores();
    await this.testScoreFiltering();
    await this.testScoreEnhancement();
    await this.testScoreUpdates();
    await this.testDemoDataGeneration();

    this.printResults();
  }

  async testLoadScores() {
    console.log('📥 Testing Score Loading...');
    
    await this.dataManager.loadScores();
    
    this.assertEqual(this.dataManager.getAllScores().length, 3, 'Should load 3 scores');
    this.assertEqual(this.dataManager.getYears().length, 1, 'Should have 1 year');
    this.assertEqual(this.dataManager.getYears()[0], 2024, 'Should be year 2024');
  }

  async testGetScores() {
    console.log('🔍 Testing Score Retrieval...');
    
    // Test year filtering
    const scoresFor2024 = this.dataManager.getScores(2024);
    this.assertEqual(scoresFor2024.length, 3, 'Should get 3 scores for 2024');
    
    // Test month filtering  
    const scoresForJan = this.dataManager.getScores(2024, 1);
    this.assertEqual(scoresForJan.length, 3, 'Should get 3 scores for January 2024');
    
    // Test date filtering
    const scoresForJan1 = this.dataManager.getScores(2024, 1, 1);
    this.assertEqual(scoresForJan1.length, 1, 'Should get 1 score for Jan 1, 2024');
  }

  async testScoreFiltering() {
    console.log('🎯 Testing Score Filtering...');
    
    // Test no filters (should return all)
    const allScores = this.dataManager.getScores();
    this.assertEqual(allScores.length, 3, 'Should return all scores with no filters');
    
    // Test non-existent year
    const noScores = this.dataManager.getScores(2023);
    this.assertEqual(noScores.length, 0, 'Should return no scores for non-existent year');
  }

  async testScoreEnhancement() {
    console.log('✨ Testing Score Enhancement...');
    
    const scores = this.dataManager.getAllScores().slice(0, 1);
    const enhanced = this.dataManager.enhanceScoresForDisplay(scores);
    
    this.assertTrue(enhanced[0].hasOwnProperty('dateId'), 'Enhanced score should have dateId');
    this.assertTrue(enhanced[0].hasOwnProperty('dateStr'), 'Enhanced score should have dateStr');
    this.assertTrue(enhanced[0].hasOwnProperty('monthId'), 'Enhanced score should have monthId');
  }

  async testScoreUpdates() {
    console.log('📝 Testing Score Updates...');
    
    const initialCount = this.dataManager.getAllScores().length;
    
    // Test adding a score
    const newScore = new global.Score('2024-01-04', 4, 'New day');
    this.dataManager.addScore(newScore);
    
    this.assertEqual(this.dataManager.getAllScores().length, initialCount + 1, 'Should add one score');
    
    // Test updating a score
    this.dataManager.updateScore('2024-01-04', 5, 'Updated notes');
    const updatedScore = this.dataManager.getAllScores().find(s => s.dateId() === '2024-01-04');
    this.assertEqual(updatedScore.summary, 5, 'Should update score summary');
    this.assertEqual(updatedScore.notes, 'Updated notes', 'Should update score notes');
  }

  async testDemoDataGeneration() {
    console.log('🎭 Testing Demo Data Generation...');
    
    const demoManager = new DataManager();
    const demoScores = demoManager.setupDemoUser();
    
    this.assertEqual(demoScores.length, 30, 'Should generate 30 demo scores');
    this.assertTrue(demoScores.every(s => s.summary >= 1 && s.summary <= 5), 'All demo scores should be 1-5');
    this.assertTrue(demoScores.every(s => s.notes.length > 0), 'All demo scores should have notes');
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
  const testSuite = new DataManagerTest();
  testSuite.runAllTests().catch(console.error);
}

module.exports = DataManagerTest;