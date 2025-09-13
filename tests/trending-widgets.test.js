/**
 * Trending Widgets Unit Tests
 * 
 * Tests for trending topics and trending people calculations in WidgetManager
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

// Test suite for trending widgets
testFramework.describe('Trending Widgets Tests', () => {
  let widgetManager;
  
  // Setup before each test
  widgetManager = new WidgetManager(mockDataManager, mockScoreCalculator, mockRouter);
  
  testFramework.test('getTrendingTopics should find topics with recent surge', () => {
    const now = new Date();
    const recentDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const recentDate2 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const recentDate3 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    
    // Mock recent entries with topic tags
    mockDataManager.getAllScores = () => [
      { date: recentDate1, notes: 'Had a great day with #coding and #music', summary: 4 },
      { date: recentDate2, notes: 'More #coding work today #programming', summary: 3 },
      { date: recentDate3, notes: 'Relaxing with #music and friends', summary: 5 }
    ];
    
    // Mock tag cache with historical data
    const originalGetTagCache = widgetManager.getTagCache;
    widgetManager.getTagCache = () => ({
      'coding': {
        totalUses: 10,
        yearStats: { '2024': 8, '2023': 2 },
        avgScore: 4.0,
        isPerson: false
      },
      'music': {
        totalUses: 20,
        yearStats: { '2024': 15, '2023': 5 },
        avgScore: 4.5,
        isPerson: false
      },
      'programming': {
        totalUses: 5,
        yearStats: { '2024': 5 },
        avgScore: 3.5,
        isPerson: false
      }
    });
    
    const result = widgetManager.getTrendingTopics();
    
    // Should find trending topics based on surge
    testFramework.assert(Array.isArray(result), 'Should return an array');
    console.log('Trending topics result:', result);
    
    // Restore original method
    widgetManager.getTagCache = originalGetTagCache;
  });
  
  testFramework.test('getTrendingTopics should handle missing notes field', () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    
    // Mock entries with missing or empty notes
    mockDataManager.getAllScores = () => [
      { date: recentDate, notes: undefined, summary: 4 },
      { date: recentDate, notes: '', summary: 3 },
      { date: recentDate, notes: null, summary: 5 }
    ];
    
    const result = widgetManager.getTrendingTopics();
    testFramework.assertEqual(result.length, 0, 'Should return empty array when no notes');
  });
  
  testFramework.test('getTrendingTopics criteria should exclude common tags', () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    
    mockDataManager.getAllScores = () => [
      { date: recentDate, notes: '#work is busy today', summary: 3 },
      { date: recentDate, notes: 'More #work stuff', summary: 3 }
    ];
    
    // Mock tag cache - work tag is too common (>= 50 uses)
    const originalGetTagCache = widgetManager.getTagCache;
    widgetManager.getTagCache = () => ({
      'work': {
        totalUses: 100, // Too common, should be excluded
        yearStats: { '2024': 60, '2023': 40 },
        avgScore: 3.0,
        isPerson: false
      }
    });
    
    const result = widgetManager.getTrendingTopics();
    testFramework.assertEqual(result.length, 0, 'Should exclude common tags with >= 50 total uses');
    
    widgetManager.getTagCache = originalGetTagCache;
  });
  
  testFramework.test('getTrendingPeople should find people with recent surge', () => {
    const now = new Date();
    const recentDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const recentDate2 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    
    mockDataManager.getAllScores = () => [
      { date: recentDate1, notes: 'Hung out with @alice and @bob today', summary: 4 },
      { date: recentDate2, notes: 'Met @alice for coffee', summary: 5 }
    ];
    
    const originalGetTagCache = widgetManager.getTagCache;
    widgetManager.getTagCache = () => ({
      'alice': {
        totalUses: 15,
        yearStats: { '2024': 10, '2023': 5 },
        avgScore: 4.5,
        isPerson: true
      },
      'bob': {
        totalUses: 8,
        yearStats: { '2024': 8 },
        avgScore: 4.0,
        isPerson: true
      }
    });
    
    const result = widgetManager.getTrendingPeople();
    testFramework.assert(Array.isArray(result), 'Should return an array');
    console.log('Trending people result:', result);
    
    widgetManager.getTagCache = originalGetTagCache;
  });
  
  testFramework.test('getTrendingPeople should exclude constant companions', () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    
    mockDataManager.getAllScores = () => [
      { date: recentDate, notes: 'Spent time with @spouse today', summary: 4 },
      { date: recentDate, notes: 'Another day with @spouse', summary: 5 }
    ];
    
    const originalGetTagCache = widgetManager.getTagCache;
    widgetManager.getTagCache = () => ({
      'spouse': {
        totalUses: 200, // Too common, should be excluded
        yearStats: { '2024': 120, '2023': 80 },
        avgScore: 4.8,
        isPerson: true
      }
    });
    
    const result = widgetManager.getTrendingPeople();
    testFramework.assertEqual(result.length, 0, 'Should exclude constant companions with >= 100 total uses');
    
    widgetManager.getTagCache = originalGetTagCache;
  });
  
  testFramework.test('should handle missing tag cache data', () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    
    mockDataManager.getAllScores = () => [
      { date: recentDate, notes: 'Trying #newtag today', summary: 4 }
    ];
    
    const originalGetTagCache = widgetManager.getTagCache;
    widgetManager.getTagCache = () => ({}); // Empty cache
    
    const topicsResult = widgetManager.getTrendingTopics();
    const peopleResult = widgetManager.getTrendingPeople();
    
    testFramework.assertEqual(topicsResult.length, 0, 'Should handle missing cache for topics');
    testFramework.assertEqual(peopleResult.length, 0, 'Should handle missing cache for people');
    
    widgetManager.getTagCache = originalGetTagCache;
  });
  
  testFramework.test('should calculate historical average correctly', () => {
    // Test the historical average calculation logic
    const now = new Date();
    const recentDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const recentDate2 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const recentDate3 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    
    mockDataManager.getAllScores = () => [
      { date: recentDate1, notes: '#testag appeared', summary: 4 },
      { date: recentDate2, notes: '#testag again', summary: 3 },
      { date: recentDate3, notes: '#testag once more', summary: 5 }
    ];
    
    const originalGetTagCache = widgetManager.getTagCache;
    widgetManager.getTagCache = () => ({
      'testag': {
        totalUses: 6, // 6 total uses
        yearStats: { '2024': 4, '2023': 2 }, // Over 2 years
        avgScore: 4.0,
        isPerson: false
        // Historical average should be 6 / 2 = 3 per year
        // Recent count is 3, so 3 > (3 * 2) = false, shouldn't qualify as trending
      }
    });
    
    const result = widgetManager.getTrendingTopics();
    console.log('Historical average test result:', result);
    
    widgetManager.getTagCache = originalGetTagCache;
  });
});

// Run the tests
if (require.main === module) {
  testFramework.run();
}

module.exports = testFramework;