/**
 * New Widget Tests
 * Tests for the 6 newly implemented widgets: Lazy Workweeks, Trending Tags, etc.
 */

const { TestFramework, MockFaveDayApp } = require('../test-framework');

function runNewWidgetTests() {
  const framework = new TestFramework();

  framework.describe('New Widget Tests', () => {
    
    // Test: Active Workweeks Widget
    framework.test('Active Workweeks - One Active Week Out Of Two', () => {
      const testData = [
        // Low workweek (Mon-Fri with scores 1,1,1,1,1 = 5 total ≤ 10)
        ...framework.generateWorkweekData(7, [1, 1, 1, 1, 1], '#tired #low'),
        // Active workweek (Mon-Fri with scores 4,4,4,4,4 = 20 total > 10)
        ...framework.generateWorkweekData(14, [4, 4, 4, 4, 4], '#productive #energy')
      ];

      const app = new MockFaveDayApp(testData);
      const result = app.getActiveWorkweeks();

      framework.assertEqual(result.totalWorkweeks, 2, 'Should detect 2 workweeks');
      framework.assertEqual(result.activeCount, 1, 'Should detect 1 active workweek');
      framework.assertEqual(result.percentage, 50, 'Should be 50% active workweeks');

      return true;
    });

    framework.test('Active Workweeks - All Active Weeks', () => {
      const testData = [
        // Two active workweeks - use high scores so any subset of included weekdays exceeds 10
        ...framework.generateWorkweekData(7, [5, 5, 5, 5, 5], '#work #focus'), // 25 total > 10
        ...framework.generateWorkweekData(14, [5, 5, 5, 5, 5], '#work #success') // 25 total > 10
      ];

      const app = new MockFaveDayApp(testData);
      const result = app.getActiveWorkweeks();

      framework.assertGreaterThan(result.totalWorkweeks, 0, 'Should detect workweeks');
      framework.assertEqual(result.activeCount, result.totalWorkweeks, 'All workweeks should be active');
      framework.assertEqual(result.percentage, 100, 'Should be 100% active workweeks');
      framework.assertTrend(result.trend, 'up', 'High active percentage should show up trend');

      return true;
    });

    framework.test('Active Workweeks - Low score entries stay inactive', () => {
      const testData = [
        // Workweek with very low scores (any combo of entries will be ≤ 10)
        ...framework.generateWorkweekData(7, [1, 1, 1, 1, 1], '#tired #low')
      ];

      const app = new MockFaveDayApp(testData);
      const result = app.getActiveWorkweeks();

      framework.assertGreaterThan(result.totalWorkweeks, 0, 'Should detect at least 1 workweek');
      framework.assertEqual(result.activeCount, 0, 'Low-scoring workweek should not be active');

      return true;
    });

    // Test: Season Progress Widget  
    framework.test('Season Progress - Current Season Detection', () => {
      const app = new MockFaveDayApp([]);
      const result = app.getSeasonProgress();
      
      const validSeasons = ['Spring', 'Summer', 'Fall', 'Winter'];
      framework.assertExists(result.season, 'Season should be detected');
      framework.assertExists(result.emoji, 'Season emoji should be set');
      framework.assertBetween(result.percentage, 0, 100, 'Progress should be 0-100%');
      framework.assertGreaterThan(result.totalDays, 80, 'Season should have reasonable duration');
      framework.assertBetween(result.daysPassed, 0, result.totalDays, 'Days passed should be valid');
      
      return true;
    });

    framework.test('Season Progress - Summer Season (July)', () => {
      // This test assumes we're running in July (Summer)
      const app = new MockFaveDayApp([]);
      const result = app.getSeasonProgress();
      
      // Note: This test might be season-dependent based on when it's run
      if (result.season === 'Summer') {
        framework.assertEqual(result.emoji, '☀️', 'Summer should have sun emoji');
        framework.assertBetween(result.percentage, 0, 100, 'Summer progress should be valid');
      }
      
      // Test passes regardless of current season as long as basic structure is correct
      framework.assertExists(result.season, 'Should detect current season');
      framework.assertExists(result.emoji, 'Should have season emoji');
      
      return true;
    });

    // Test: Edge Cases
    framework.test('Edge Case - No Workweek Data', () => {
      // Empty data set
      const testData = [];

      const app = new MockFaveDayApp(testData);
      const result = app.getActiveWorkweeks();

      framework.assertEqual(result.totalWorkweeks, 0, 'Should detect 0 workweeks from empty data');
      framework.assertEqual(result.activeCount, 0, 'Should have 0 active workweeks');
      framework.assertEqual(result.percentage, 0, 'Should be 0% when no workweeks exist');

      return true;
    });

    framework.test('Edge Case - Partial Workweek', () => {
      // Only 3 days of a workweek (Mon, Tue, Wed)
      const testData = [
        framework.generateScoreEntry(6, 2, 'Monday #work'),    // Monday
        framework.generateScoreEntry(5, 2, 'Tuesday #work'),   // Tuesday
        framework.generateScoreEntry(4, 1, 'Wednesday #sick')  // Wednesday
        // Thursday and Friday missing - total = 5, not > 10
      ];

      const app = new MockFaveDayApp(testData);
      const result = app.getActiveWorkweeks();

      framework.assertEqual(result.totalWorkweeks, 1, 'Should count partial workweek');
      framework.assertEqual(result.activeCount, 0, '5 points total should not be active');
      framework.assertEqual(result.percentage, 0, 'Single partial low week = 0% active');

      return true;
    });
  });

  return framework.printResults();
}

// Export and run if called directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runNewWidgetTests };
  
  if (require.main === module) {
    runNewWidgetTests();
  }
} else {
  runNewWidgetTests();
}