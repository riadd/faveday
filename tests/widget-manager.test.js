/**
 * WidgetManager Unit Tests
 * 
 * Tests for the WidgetManager module that handles all analytics and dashboard widgets
 */

const fs = require('fs');

// Mock dependencies
const MockDataManager = {
  getAllScores: function() {
    return this.mockData || [];
  },
  getYears: function() {
    return [2023, 2024, 2025];
  },
  setMockData: function(data) {
    this.mockData = data;
  }
};

const MockScoreCalculator = {
  calculate: function(scores) {
    if (!scores || scores.length === 0) return 0;
    const sum = scores.reduce((total, s) => total + (s.summary || 0), 0);
    return sum / scores.length;
  },
  calculateQuality: function(scores) {
    if (!scores || scores.length === 0) return 0;
    const weights = { 1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0 };
    const totalQuality = scores.reduce((sum, entry) => {
      const score = entry.summary || 0;
      return sum + (weights[score] || 0);
    }, 0);
    return totalQuality / scores.length;
  },
  getScoreTypeInfo: function() {
    return { icon: '⭐', name: 'Average' };
  }
};

const MockRouter = {
  pushHistory: function() {},
  getCurrentRoute: function() { return '/'; }
};

// Load WidgetManager
const WidgetManager = require('../app/lib/faveday/widget-manager.js');

// Mock localStorage for tag cache
global.localStorage = {
  getItem: function(key) {
    if (key === 'tagCache') {
      return JSON.stringify({
        'work': { totalUses: 10, avgScore: 4.2, isPerson: false },
        'john': { totalUses: 5, avgScore: 3.8, isPerson: true }
      });
    }
    return null;
  }
};

function runTests() {
  console.log('🧪 Running WidgetManager Unit Tests...\n');
  
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
  
  // Create WidgetManager instance
  const widgetManager = new WidgetManager(MockDataManager, MockScoreCalculator, MockRouter);
  
  console.log('🏗️ Testing Construction...');
  test('Should store dataManager reference', () => {
    return widgetManager.dataManager === MockDataManager;
  });
  
  test('Should store scoreCalculator reference', () => {
    return widgetManager.scoreCalculator === MockScoreCalculator;
  });
  
  test('Should store router reference', () => {
    return widgetManager.router === MockRouter;
  });
  
  console.log('📊 Testing Basic Widget Functions...');
  
  // Set up test data
  const testScores = [
    { summary: 1, notes: 'Bad day #work @john', date: new Date('2024-01-15') },
    { summary: 3, notes: 'Okay day #home', date: new Date('2024-01-16') },
    { summary: 5, notes: 'Great day #work @jane', date: new Date('2024-01-17') },
    { summary: 4, notes: 'Good day #exercise', date: new Date('2024-01-18') },
    { summary: 2, notes: 'Rough day #work', date: new Date('2024-01-19') }
  ];
  MockDataManager.setMockData(testScores);
  
  test('Should calculate score overview correctly', () => {
    const overview = widgetManager.getOverview(testScores);
    return overview.count1 === 20 && overview.count3 === 20 && overview.count5 === 20;
  });
  
  test('Should get total overview', () => {
    const total = widgetManager.getTotalOverview();
    return total.totalEntries === 5 && total.totalScoreAvg === '3.0';
  });
  
  test('Should get calendar year progress', () => {
    const progress = widgetManager.getCalendarYearProgress();
    return progress.year === new Date().getFullYear() && typeof progress.percentage === 'number';
  });
  
  test('Should get coverage progress', () => {
    const coverage = widgetManager.getCoverageProgress();
    return typeof coverage.percentage === 'number' && typeof coverage.trend === 'string';
  });
  
  test('Should get trending topics', () => {
    const trending = widgetManager.getTrendingTopics();
    return Array.isArray(trending);
  });
  
  test('Should get trending people', () => {
    const trending = widgetManager.getTrendingPeople();
    return Array.isArray(trending);
  });
  
  test('Should get person mentions ratio', () => {
    const ratio = widgetManager.getPersonMentionsRatio();
    return typeof ratio.percentage === 'number';
  });
  
  test('Should get season progress', () => {
    const season = widgetManager.getSeasonProgress();
    return typeof season.season === 'string' && typeof season.percentage === 'number';
  });
  
  test('Should get super tag', () => {
    const superTag = widgetManager.getSuperTag();
    // Can be null or object, both are valid
    return superTag === null || typeof superTag === 'object';
  });
  
  test('Should get score type info', () => {
    const info = widgetManager.getScoreTypeInfo();
    return info.icon === '⭐' && info.name === 'Average';
  });
  
  console.log('🔍 Testing Edge Cases...');
  
  test('Should handle empty data gracefully', () => {
    MockDataManager.setMockData([]);
    const overview = widgetManager.getOverview([]);
    return overview.count1 === 0 && overview.count5 === 0;
  });
  
  test('Should handle null data gracefully', () => {
    MockDataManager.setMockData(null);
    const total = widgetManager.getTotalOverview();
    return total.totalEntries === 0;
  });
  
  // Reset test data
  MockDataManager.setMockData(testScores);
  
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