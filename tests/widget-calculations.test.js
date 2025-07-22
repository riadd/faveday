/**
 * Widget Calculations Unit Tests
 * Tests for FaveDay dashboard and analytics widget calculations
 */

// Mock FaveDayApp class with test data
class MockFaveDayApp {
  constructor(testData) {
    this.all = testData;
  }

  // Copy the exact getThirtyDayComparisons function from faveday.js
  getThirtyDayComparisons() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // Current 30 days
    const currentPeriod = this.all.filter(s => s.date >= thirtyDaysAgo && s.date <= now);
    
    // Previous 30 days (31-60 days ago)
    const previousPeriod = this.all.filter(s => s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo);

    // Word count comparison
    const currentWordCount = currentPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
    const previousWordCount = previousPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
    const currentAvgWords = currentPeriod.length > 0 ? Math.round(currentWordCount / 30) : 0;
    const previousAvgWords = previousPeriod.length > 0 ? Math.round(previousWordCount / 30) : 0;
    const wordsDiff = currentAvgWords - previousAvgWords;

    // Entry count comparison
    const currentEntries = currentPeriod.length;
    const previousEntries = previousPeriod.length;
    const entriesDiff = currentEntries - previousEntries;

    // Average score comparison
    const currentAvgScore = currentPeriod.length > 0 ? currentPeriod.reduce((sum, s) => sum + s.summary, 0) / currentPeriod.length : 0;
    const previousAvgScore = previousPeriod.length > 0 ? previousPeriod.reduce((sum, s) => sum + s.summary, 0) / previousPeriod.length : 0;
    const scoreDiff = currentAvgScore - previousAvgScore;

    // Most used tag in recent 30 days
    const tagCounts = {};
    currentPeriod.forEach(score => {
      const tags = score.notes.match(/[#@]\p{L}+/gui) || [];
      tags.forEach(tag => {
        const cleanTag = tag.slice(1).toLowerCase();
        tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
      });
    });
    
    const topTag = Object.entries(tagCounts).length > 0 
      ? Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0] 
      : null;

    const formatTrend = (diff, trend, currentVal) => {
      if (diff === 0) return '';
      const arrow = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
      const sign = diff > 0 ? '+' : '';
      
      // Calculate percentage change
      const percentageChange = currentVal > 0 ? Math.round((diff / currentVal) * 100) : 0;
      const absPercentage = Math.abs(percentageChange);
      
      return ` ${arrow} ${sign}${absPercentage}%`;
    };

    return {
      words: {
        current: currentAvgWords,
        previous: previousAvgWords,
        diff: wordsDiff,
        trend: wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same',
        trendDisplay: formatTrend(wordsDiff, wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same', previousAvgWords)
      },
      entries: {
        current: currentEntries,
        previous: previousEntries,
        diff: entriesDiff,
        trend: entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same',
        trendDisplay: formatTrend(entriesDiff, entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same', previousEntries)
      },
      score: {
        current: Math.round(currentAvgScore * 10) / 10,
        previous: Math.round(previousAvgScore * 10) / 10,
        diff: Math.round(scoreDiff * 10) / 10,
        trend: scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same',
        trendDisplay: formatTrend(Math.round(scoreDiff * 10) / 10, scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same', Math.round(previousAvgScore * 10) / 10),
        trendEmoji: scoreDiff > 0 ? '📈' : scoreDiff < 0 ? '📉' : '➡️'
      },
      topTag: topTag ? { tag: topTag[0], count: topTag[1] } : null,
      // Debug info
      _debug: {
        now: now.toISOString(),
        thirtyDaysAgo: thirtyDaysAgo.toISOString(),
        sixtyDaysAgo: sixtyDaysAgo.toISOString(),
        currentPeriodDates: currentPeriod.map(s => s.date.toISOString()),
        previousPeriodDates: previousPeriod.map(s => s.date.toISOString())
      }
    };
  }
}

// Test cases
function runWidgetTests() {
  console.log('🧪 Running Widget Calculation Tests...\n');

  // Test Case 1: More entries in current period (should show "up" trend)
  console.log('📊 Test Case 1: More entries recently (should be UP trend)');
  const testData1 = [
    // Current period (last 30 days) - 5 entries
    { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), summary: 4, notes: 'Recent entry #work' },
    { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), summary: 3, notes: 'Another recent entry #project' },
    { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), summary: 5, notes: 'Good day #success' },
    { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), summary: 2, notes: 'Meh day #tired' },
    { date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), summary: 4, notes: 'Okay day #normal' },
    
    // Previous period (31-60 days ago) - 2 entries  
    { date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), summary: 3, notes: 'Old entry #work' },
    { date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), summary: 4, notes: 'Older entry #project' }
  ];
  
  const app1 = new MockFaveDayApp(testData1);
  const result1 = app1.getThirtyDayComparisons();
  
  console.log('Current entries:', result1.entries.current, '(expected: 5)');
  console.log('Previous entries:', result1.entries.previous, '(expected: 2)');
  console.log('Entries diff:', result1.entries.diff, '(expected: +3)');
  console.log('Entries trend:', result1.entries.trend, '(expected: up)');
  console.log('Entries trend display:', result1.entries.trendDisplay);
  
  const test1Pass = result1.entries.current === 5 && 
                   result1.entries.previous === 2 && 
                   result1.entries.diff === 3 && 
                   result1.entries.trend === 'up';
  console.log('✅ Test 1 Result:', test1Pass ? 'PASS' : '❌ FAIL');
  console.log('');

  // Test Case 2: Fewer entries in current period (should show "down" trend)
  console.log('📊 Test Case 2: Fewer entries recently (should be DOWN trend)');
  const testData2 = [
    // Current period (last 30 days) - 2 entries
    { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), summary: 4, notes: 'Recent entry #work' },
    { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), summary: 3, notes: 'Another recent #project' },
    
    // Previous period (31-60 days ago) - 5 entries
    { date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), summary: 3, notes: 'Old entry #work' },
    { date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), summary: 4, notes: 'Old entry 2 #project' },
    { date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), summary: 2, notes: 'Old entry 3 #tired' },
    { date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), summary: 5, notes: 'Old entry 4 #success' },
    { date: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000), summary: 3, notes: 'Old entry 5 #normal' }
  ];
  
  const app2 = new MockFaveDayApp(testData2);
  const result2 = app2.getThirtyDayComparisons();
  
  console.log('Current entries:', result2.entries.current, '(expected: 2)');
  console.log('Previous entries:', result2.entries.previous, '(expected: 5)');
  console.log('Entries diff:', result2.entries.diff, '(expected: -3)');
  console.log('Entries trend:', result2.entries.trend, '(expected: down)');
  console.log('Entries trend display:', result2.entries.trendDisplay);
  
  const test2Pass = result2.entries.current === 2 && 
                   result2.entries.previous === 5 && 
                   result2.entries.diff === -3 && 
                   result2.entries.trend === 'down';
  console.log('✅ Test 2 Result:', test2Pass ? 'PASS' : '❌ FAIL');
  console.log('');

  // Test Case 3: Edge case - entries exactly on boundaries
  console.log('📊 Test Case 3: Boundary date testing');
  const now = new Date();
  const exactly30DaysAgo = new Date(now);
  exactly30DaysAgo.setDate(now.getDate() - 30);
  const exactly60DaysAgo = new Date(now);
  exactly60DaysAgo.setDate(now.getDate() - 60);

  const testData3 = [
    // Right on the boundary (should be included in current)
    { date: new Date(exactly30DaysAgo.getTime() + 1000), summary: 4, notes: 'Boundary test 1' },
    // Right on the other boundary (should be included in previous)  
    { date: new Date(exactly60DaysAgo.getTime() + 1000), summary: 3, notes: 'Boundary test 2' },
    // Just outside current period (should be in previous)
    { date: new Date(exactly30DaysAgo.getTime() - 1000), summary: 5, notes: 'Just outside current' }
  ];
  
  const app3 = new MockFaveDayApp(testData3);
  const result3 = app3.getThirtyDayComparisons();
  
  console.log('Current entries:', result3.entries.current, '(expected: 1)');
  console.log('Previous entries:', result3.entries.previous, '(expected: 2)');
  console.log('Debug info:');
  console.log('  Now:', result3._debug.now);
  console.log('  30 days ago:', result3._debug.thirtyDaysAgo);  
  console.log('  60 days ago:', result3._debug.sixtyDaysAgo);
  console.log('  Current period dates:', result3._debug.currentPeriodDates);
  console.log('  Previous period dates:', result3._debug.previousPeriodDates);
  console.log('');

  return { test1Pass, test2Pass };
}

// Run the tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runWidgetTests, MockFaveDayApp };
} else {
  // Run tests immediately if in browser
  runWidgetTests();
}