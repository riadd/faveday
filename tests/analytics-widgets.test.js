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