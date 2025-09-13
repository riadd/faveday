/**
 * Lazy Widgets Unit Tests
 * 
 * Tests for lazy Saturday, Sunday, and Workweek calculations in WidgetManager
 */

// Import dependencies
const { UnifiedTestFramework } = require('./unified-test-framework');
const WidgetManager = require('../app/lib/faveday/widget-manager');

// Create test framework instance
const testFramework = new UnifiedTestFramework();

// Mock dependencies
const mockDataManager = {
  getAllScores: () => [],
  getYears: () => []
};

const mockScoreCalculator = {
  calculate: (scores) => scores.length > 0 ? scores.reduce((sum, s) => sum + s.summary, 0) / scores.length : 0
};

const mockRouter = {};

// Helper function to set day of week for a date
Date.prototype.setDay = function(dayOfWeek) {
  const currentDay = this.getDay();
  const diff = dayOfWeek - currentDay;
  this.setDate(this.getDate() + diff);
  return this;
};

// Test suite for lazy widgets
testFramework.describe('Lazy Widgets Tests', () => {
  let widgetManager;
  
  // Setup before each test
  widgetManager = new WidgetManager(mockDataManager, mockScoreCalculator, mockRouter);
  
  testFramework.test('formatPercentageTrend should handle zero previous value correctly', () => {
    const result = widgetManager.formatPercentageTrend(50, 0);
    testFramework.assertEqual(result.trend, 'up', 'Trend should be up when going from 0 to positive');
    testFramework.assertEqual(result.trendDisplay, '+50%', 'Should show the actual percentage when previous is 0');
  });
  
  testFramework.test('formatPercentageTrend should handle normal percentage changes', () => {
    const result = widgetManager.formatPercentageTrend(60, 40);
    testFramework.assertEqual(result.trend, 'up', 'Trend should be up for increase');
    testFramework.assertEqual(result.trendDisplay, '+50.0%', 'Should calculate percentage increase correctly');
  });
  
  testFramework.test('formatPercentageTrend should handle negative changes', () => {
    const result = widgetManager.formatPercentageTrend(30, 50);
    testFramework.assertEqual(result.trend, 'down', 'Trend should be down for decrease');
    testFramework.assertEqual(result.trendDisplay, '-40.0%', 'Should calculate percentage decrease correctly');
  });
  
  testFramework.test('formatPercentageTrend should handle no change', () => {
    const result = widgetManager.formatPercentageTrend(50, 50);
    testFramework.assertEqual(result.trend, 'same', 'Trend should be same for no change');
    testFramework.assertEqual(result.trendDisplay, '0.0%', 'Should show 0% for no change');
  });
  
  testFramework.test('formatPercentageTrend should handle both values being zero', () => {
    const result = widgetManager.formatPercentageTrend(0, 0);
    testFramework.assertEqual(result.trend, 'same', 'Trend should be same when both are zero');
    testFramework.assertEqual(result.trendDisplay, '0%', 'Should show 0% when both are zero');
  });
  
  testFramework.test('getLazySaturdays should handle no Saturday data', () => {
    mockDataManager.getAllScores = () => [];
    
    const result = widgetManager.getLazySaturdays();
    testFramework.assertEqual(result.percentage, 0, 'Percentage should be 0 with no data');
    testFramework.assertEqual(result.lazyCount, 0, 'Lazy count should be 0 with no data');
    testFramework.assertEqual(result.totalSaturdays, 0, 'Total Saturdays should be 0 with no data');
  });
  
  testFramework.test('getLazySaturdays should handle previous period with no data', () => {
    const now = new Date();
    const recentSaturday = new Date(now);
    recentSaturday.setDate(now.getDate() - 7);
    recentSaturday.setDay(6); // Saturday
    
    // Only current period has data
    mockDataManager.getAllScores = () => [
      { date: recentSaturday, summary: 2 }
    ];
    
    const result = widgetManager.getLazySaturdays();
    testFramework.assertEqual(result.percentage, 100, 'Should be 100% lazy when all Saturdays are lazy');
    testFramework.assertEqual(result.previousPercentage, 0, 'Previous period should be 0%');
    testFramework.assertEqual(result.trendDisplay, '+100%', 'Should show actual percentage when previous is 0');
  });
  
  testFramework.test('getLazySundays should handle no Sunday data', () => {
    mockDataManager.getAllScores = () => [];
    
    const result = widgetManager.getLazySundays();
    testFramework.assertEqual(result.percentage, 0, 'Percentage should be 0 with no data');
    testFramework.assertEqual(result.lazyCount, 0, 'Lazy count should be 0 with no data');
    testFramework.assertEqual(result.totalSundays, 0, 'Total Sundays should be 0 with no data');
  });
  
  testFramework.test('getLazyWorkweeks should handle no workweek data', () => {
    mockDataManager.getAllScores = () => [];
    
    const result = widgetManager.getLazyWorkweeks();
    testFramework.assertEqual(result.percentage, 0, 'Percentage should be 0 with no data');
    testFramework.assertEqual(result.lazyCount, 0, 'Lazy count should be 0 with no data');
    testFramework.assertEqual(result.totalWorkweeks, 0, 'Total workweeks should be 0 with no data');
  });
  
  testFramework.test('getLazyWorkweeks should calculate lazy workweek correctly', () => {
    const now = new Date();
    
    // Create a workweek with total score of 8 (lazy, ≤ 10)
    const monday = new Date(now);
    monday.setDate(now.getDate() - 7);
    monday.setDay(1); // Monday
    
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);
    
    mockDataManager.getAllScores = () => [
      { date: monday, summary: 3 },
      { date: tuesday, summary: 2 },
      { date: wednesday, summary: 3 }
      // Total: 8 (lazy workweek)
    ];
    
    const result = widgetManager.getLazyWorkweeks();
    testFramework.assertEqual(result.percentage, 100, '1 out of 1 workweek should be 100% lazy');
    testFramework.assertEqual(result.lazyCount, 1, 'Should have 1 lazy workweek');
    testFramework.assertEqual(result.totalWorkweeks, 1, 'Should have 1 total workweek');
  });
  
  testFramework.test('getLazyWorkweeks should handle good workweeks (score > 10)', () => {
    const now = new Date();
    
    const monday = new Date(now);
    monday.setDate(now.getDate() - 7);
    monday.setDay(1); // Monday
    
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);
    
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    
    mockDataManager.getAllScores = () => [
      { date: monday, summary: 4 },
      { date: tuesday, summary: 4 },
      { date: wednesday, summary: 3 },
      { date: thursday, summary: 3 },
      { date: friday, summary: 2 }
      // Total: 16 (not lazy workweek)
    ];
    
    const result = widgetManager.getLazyWorkweeks();
    testFramework.assertEqual(result.percentage, 0, '0 out of 1 workweek should be 0% lazy');
    testFramework.assertEqual(result.lazyCount, 0, 'Should have 0 lazy workweeks');
    testFramework.assertEqual(result.totalWorkweeks, 1, 'Should have 1 total workweek');
  });
});

// Run the tests
if (require.main === module) {
  testFramework.runAllTests();
}

module.exports = testFramework;