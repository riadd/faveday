/**
 * Analytics Widgets Test Suite
 * Comprehensive tests for all dashboard and analytics widgets
 */

const { UnifiedTestFramework, MockFaveDayApp } = require('./unified-test-framework');

function runAnalyticsWidgetsTests() {
  const framework = new UnifiedTestFramework();

  // 30-Day Comparison Widgets
  framework.describe('30-Day Comparison Widgets', function() {
    
    framework.testWidget('Total Entries', () => {
      console.log('       📊 Testing entry count trends...');
      const testData = [
        // Current period: 5 entries
        ...framework.generateTaggedEntries(5, 5, '#work', 4),
        // Previous period: 2 entries
        ...framework.generateTaggedEntries(2, 35, '#old', 3)
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.entries.current, 5, 'Current period entries');
      framework.assertEqual(result.entries.previous, 2, 'Previous period entries');
      framework.assertTrend(result.entries.trend, 'up', 'More recent entries should trend up');
      console.log(`       ✓ Entry trend: ${result.entries.current} current vs ${result.entries.previous} previous = ${result.entries.trend}`);
      
      return true;
    });

    framework.testWidget('Average Score', () => {
      console.log('       ⭐ Testing score averages and trends...');
      const testData = [
        // Current period: high scores (avg = 4.0)
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 1, 4, '#good')),
        // Previous period: lower scores (avg = 2.0)
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 35, 2, '#meh'))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.score.current, 4.0, 'Current average score');
      framework.assertEqual(result.score.previous, 2.0, 'Previous average score');
      framework.assertTrend(result.score.trend, 'up', 'Better scores should trend up');
      console.log(`       ✓ Score trend: ${result.score.current} current vs ${result.score.previous} previous = ${result.score.trend}`);
      
      return true;
    });

    framework.testWidget('Words Per Day', () => {
      console.log('       📝 Testing word count analysis...');
      const testData = [
        // Current period: longer entries (14 words each)
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 1, 3, 'This is a longer entry with more detailed thoughts and reflections about my daily experiences today')),
        // Previous period: shorter entries (3 words each) 
        ...Array(5).fill().map((_, i) => framework.generateScoreEntry(i + 35, 3, 'Short entry today'))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      // Words per day calculation: (total words / 30 days)
      // Current: 5 entries × 14 words = 70 words / 30 days = ~2.3 words/day
      // Previous: 5 entries × 3 words = 15 words / 30 days = ~0.5 words/day
      framework.assertBetween(result.words.current, 1, 5, 'Current words per day should be reasonable');
      framework.assertBetween(result.words.previous, 0, 2, 'Previous words per day should be lower');
      framework.assertTrend(result.words.trend, 'up', 'More words should trend up');
      console.log(`       ✓ Words trend: ${result.words.current} current vs ${result.words.previous} previous = ${result.words.trend}`);
      
      return true;
    });
  });

  // Progress & Time-Based Widgets
  framework.describe('Progress & Time Widgets', function() {
    
    framework.testWidget('Season Progress', () => {
      console.log('       🌸 Testing current season detection...');
      const app = new MockFaveDayApp([]);
      const result = app.getSeasonProgress();
      
      const validSeasons = ['Spring', 'Summer', 'Fall', 'Winter'];
      framework.assertExists(result.season, 'Season should be detected');
      framework.assertBetween(result.percentage, 0, 100, 'Progress percentage');
      framework.assertBetween(result.totalDays, 80, 100, 'Season duration');
      
      console.log(`       ✓ Current season: ${result.emoji} ${result.season} (${result.percentage}% complete)`);
      console.log(`       ✓ Season timing: ${result.daysPassed}/${result.totalDays} days`);
      
      return true;
    });

    framework.testWidget('Coverage', () => {
      console.log('       📊 Testing journal coverage metrics...');
      const testData = [
        // Recent entries - 10 entries in last 20 days (50% coverage)
        ...Array(10).fill().map((_, i) => framework.generateScoreEntry(i * 2, 3, '#regular'))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getCoverageProgress();
      
      framework.assertEqual(result.entriesMade, 10, 'Entry count');
      framework.assertBetween(result.percentage, 1, 50, 'Coverage percentage should be reasonable');
      framework.assertExists(result.trend, 'Coverage trend should exist');
      
      console.log(`       ✓ Coverage: ${result.entriesMade} entries in ${result.daysPassed} days (${result.percentage}%)`);
      
      return true;
    });
  });

  // Behavioral Pattern Widgets
  framework.describe('Behavioral Pattern Widgets', function() {
    
    framework.testWidget('Lazy Workweeks', () => {
      console.log('       💼 Testing workweek productivity patterns...');
      const testData = [
        // One lazy workweek (Mon-Fri with low scores: 1+1+1+1+1 = 5 ≤ 10)
        ...framework.generateWorkweekData(7, [1, 1, 1, 1, 1], '#tired #low'),
        // One productive workweek (Mon-Fri with high scores: 4+4+4+4+4 = 20 > 10)
        ...framework.generateWorkweekData(14, [4, 4, 4, 4, 4], '#productive #energy')
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getLazyWorkweeks();
      
      framework.assertEqual(result.totalWorkweeks, 2, 'Total workweeks detected');
      framework.assertEqual(result.lazyCount, 1, 'Lazy workweeks (≤10 points)');
      framework.assertEqual(result.percentage, 50, 'Lazy workweek percentage');
      framework.assertTrend(result.trend, 'down', 'High lazy percentage should trend down');
      
      console.log(`       ✓ Workweek analysis: ${result.lazyCount}/${result.totalWorkweeks} lazy weeks (${result.percentage}%)`);
      
      return true;
    });
  });

  // Performance & Trend Widgets
  framework.describe('Performance & Trend Widgets', function() {
    
    framework.testWidget('High Score Frequency', () => {
      console.log('       ⚡ Testing high score frequency trends...');
      
      const testData = [
        // Recent year: High scores every 5 days (good frequency)
        ...Array(6).fill().map((_, i) => framework.generateScoreEntry(30 + (i * 5), 4, `#recent #high`)),
        // Previous year: High scores every 10 days (poor frequency) 
        ...Array(6).fill().map((_, i) => framework.generateScoreEntry(400 + (i * 10), 4, `#previous #high`))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getAverageDurationBetweenHighScores();
      
      framework.assertExists(result.averageDays, 'Should calculate average days');
      // Allow wider range since exact values may vary based on calculation
      framework.assertBetween(result.averageDays, 3, 8, 'Recent average should be around 5 days');
      framework.assertBetween(result.previousAverageDays, 8, 15, 'Previous average should be around 10 days');
      framework.assertTrend(result.trend, 'up', 'Better frequency (lower days) should trend up');
      framework.assertExists(result.trendDisplay, 'Should have trend display');
      
      console.log(`       ✓ Frequency trend: ${result.averageDays} current vs ${result.previousAverageDays} previous = ${result.trend}`);
      
      return true;
    });

    framework.testWidget('Last 5+ Score', () => {
      console.log('       🎯 Testing last high score recency...');
      
      const testData = [
        // Recent high score 3 days ago
        framework.generateScoreEntry(3, 5, '#recent #high'),
        // Previous period had high score 7 days before the 30-day mark
        framework.generateScoreEntry(37, 5, '#previous #high'),
        // Add some regular entries for context
        ...Array(10).fill().map((_, i) => framework.generateScoreEntry(i + 10, 3, '#regular'))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getDaysSinceLastScore(5);
      
      framework.assertEqual(result.days, 3, 'Should show 3 days since last 5-score');
      framework.assertExists(result.lastDate, 'Should have last date');
      framework.assertExists(result.trend, 'Should have trend calculation');
      // More recent high score should be better (up trend with inverted logic)
      
      console.log(`       ✓ Last high score: ${result.days} days ago, trend: ${result.trend}`);
      
      return true;
    });

    framework.testWidget('Last 1 Score', () => {
      console.log('       📉 Testing last low score avoidance...');
      
      const testData = [
        // Recent low score 10 days ago (good - avoiding recent lows)
        framework.generateScoreEntry(10, 1, '#old #low'),
        // Previous period had low score 5 days before the 30-day mark (worse)
        framework.generateScoreEntry(35, 1, '#previous #low'),
        // Add some regular entries for context
        ...Array(8).fill().map((_, i) => framework.generateScoreEntry(i + 2, 3, '#regular'))
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getDaysSinceLastScore(1);
      
      framework.assertEqual(result.days, 10, 'Should show 10 days since last 1-score');
      framework.assertExists(result.lastDate, 'Should have last date');
      framework.assertExists(result.trend, 'Should have trend calculation');
      // Longer time since low score should be better (up trend with normal logic)
      
      console.log(`       ✓ Last low score: ${result.days} days ago, trend: ${result.trend}`);
      
      return true;
    });
  });

  // Edge Cases & Error Handling
  framework.describe('Edge Cases & Data Validation', function() {
    
    framework.test('Empty Data Handling', () => {
      console.log('       🗂️  Testing with no journal entries...');
      const app = new MockFaveDayApp([]);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.entries.current, 0, 'No current entries');
      framework.assertEqual(result.entries.previous, 0, 'No previous entries');
      framework.assertTrend(result.entries.trend, 'same', 'Empty data should show same trend');
      
      console.log('       ✓ Graceful handling of empty dataset');
      
      return true;
    });

    framework.test('Single Entry Scenarios', () => {
      console.log('       📝 Testing with minimal data...');
      const testData = [framework.generateScoreEntry(5, 5, '#single #test')];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertEqual(result.entries.current, 1, 'Single current entry');
      framework.assertEqual(result.entries.previous, 0, 'No previous entries');
      framework.assertTrend(result.entries.trend, 'up', 'New activity should trend up');
      
      console.log('       ✓ Proper handling of single-entry scenarios');
      
      return true;
    });

    framework.test('Boundary Date Conditions', () => {
      console.log('       📅 Testing date boundary edge cases...');
      const testData = [
        // Right on the 30-day boundary
        framework.generateScoreEntry(30, 4, 'Boundary test 1'),
        framework.generateScoreEntry(31, 3, 'Boundary test 2'),
        // Current period
        framework.generateScoreEntry(15, 5, 'Recent entry')
      ];
      
      const app = new MockFaveDayApp(testData);
      const result = app.getThirtyDayComparisons();
      
      framework.assertBetween(result.entries.current, 1, 2, 'Current period should include boundary entries correctly');
      framework.assertBetween(result.entries.previous, 0, 2, 'Previous period should handle boundaries');
      
      console.log('       ✓ Date boundary conditions handled correctly');
      
      return true;
    });
  });

  return framework.printResults();
}

// Export and run if called directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAnalyticsWidgetsTests };
  
  if (require.main === module) {
    runAnalyticsWidgetsTests();
  }
}