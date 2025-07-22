/**
 * Core Widget Tests
 * Tests for essential dashboard widgets: 30-day comparisons, coverage, etc.
 */

const { TestFramework, MockFaveDayApp } = require('../test-framework');

function runCoreWidgetTests() {
  const framework = new TestFramework();

  framework.describe('Core Widget Tests', () => {
    
    // Test: 30-Day Entry Comparison
    framework.test('30-Day Entry Comparison - More Recent Entries', () => {
      const testData = [
        // Current period (last 30 days) - 5 entries
        ...framework.generateTaggedEntries(5, 5, '#work', 4),
        // Previous period (31-60 days ago) - 2 entries  
        ...framework.generateTaggedEntries(2, 35, '#work', 3)
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.entries.current, 5, 'Should have 5 current entries');
      framework.assertEqual(result.entries.previous, 2, 'Should have 2 previous entries');
      framework.assertEqual(result.entries.diff, 3, 'Difference should be +3');
      framework.assertTrend(result.entries.trend, 'up', 'More recent entries should show up trend');
      
      return true;
    });

    framework.test('30-Day Entry Comparison - Fewer Recent Entries', () => {
      const testData = [
        // Current period (last 30 days) - 2 entries
        ...framework.generateTaggedEntries(2, 5, '#work', 4),
        // Previous period (31-60 days ago) - 5 entries
        ...framework.generateTaggedEntries(5, 35, '#work', 3)
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.entries.current, 2, 'Should have 2 current entries');
      framework.assertEqual(result.entries.previous, 5, 'Should have 5 previous entries');
      framework.assertEqual(result.entries.diff, -3, 'Difference should be -3');
      framework.assertTrend(result.entries.trend, 'down', 'Fewer recent entries should show down trend');
      
      return true;
    });

    framework.test('30-Day Score Comparison - Improving Scores', () => {
      const testData = [
        // Current period - high scores (avg = 4)
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 1, 4, '#good')),
        // Previous period - lower scores (avg = 2) 
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 35, 2, '#meh'))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.score.current, 4, 'Current average should be 4');
      framework.assertEqual(result.score.previous, 2, 'Previous average should be 2');
      framework.assertEqual(result.score.diff, 2, 'Score improvement should be +2');
      framework.assertTrend(result.score.trend, 'up', 'Better scores should show up trend');
      
      return true;
    });

    framework.test('30-Day Score Comparison - Declining Scores', () => {
      const testData = [
        // Current period - lower scores (avg = 2)
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 1, 2, '#tired')),
        // Previous period - higher scores (avg = 4)
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 35, 4, '#energy'))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.score.current, 2, 'Current average should be 2');
      framework.assertEqual(result.score.previous, 4, 'Previous average should be 4');
      framework.assertEqual(result.score.diff, -2, 'Score decline should be -2');
      framework.assertTrend(result.score.trend, 'down', 'Worse scores should show down trend');
      
      return true;
    });

    framework.test('Edge Case - No Data', () => {
      const app = new MockFaveDayApp([]);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.entries.current, 0, 'Should handle empty data');
      framework.assertEqual(result.entries.previous, 0, 'Should handle empty data');
      framework.assertTrend(result.entries.trend, 'same', 'No data should show same trend');
      
      return true;
    });

    framework.test('Edge Case - Single Entry in Current Period', () => {
      const testData = [
        framework.generateScoreEntry(5, 5, '#single #test')
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.entries.current, 1, 'Should have 1 current entry');
      framework.assertEqual(result.entries.previous, 0, 'Should have 0 previous entries');
      framework.assertTrend(result.entries.trend, 'up', 'New activity should show up trend');
      
      return true;
    });
  });

  return framework.printResults();
}

// Export and run if called directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runCoreWidgetTests };
  
  // Run tests if this file is executed directly
  if (require.main === module) {
    runCoreWidgetTests();
  }
} else {
  runCoreWidgetTests();
}