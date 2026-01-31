/**
 * FaveDay Test Framework
 * Unified testing utilities and mocks for all widget and functionality tests
 */

class TestFramework {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, total: 0 };
    
    // Setup global mocks
    this.setupGlobalMocks();
  }

  setupGlobalMocks() {
    // Mock localStorage if not available (Node.js environment)
    if (typeof localStorage === 'undefined') {
      global.localStorage = {
        data: {},
        getItem: function(key) {
          return this.data[key] || null;
        },
        setItem: function(key, value) {
          this.data[key] = value;
        },
        clear: function() {
          this.data = {};
        }
      };
    }
  }

  // Test registration
  describe(suiteName, testFn) {
    console.log(`\n🧪 ${suiteName}`);
    console.log('─'.repeat(suiteName.length + 3));
    testFn();
  }

  test(testName, testFn) {
    this.results.total++;
    try {
      const result = testFn();
      if (result === false) {
        throw new Error('Test assertion failed');
      }
      console.log(`✅ ${testName}`);
      this.results.passed++;
      return true;
    } catch (error) {
      console.log(`❌ ${testName}`);
      console.log(`   Error: ${error.message}`);
      this.results.failed++;
      return false;
    }
  }

  // Assertions
  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
    }
    return true;
  }

  assertGreaterThan(actual, threshold, message = '') {
    if (actual <= threshold) {
      throw new Error(`Expected ${actual} > ${threshold}. ${message}`);
    }
    return true;
  }

  assertBetween(actual, min, max, message = '') {
    if (actual < min || actual > max) {
      throw new Error(`Expected ${actual} to be between ${min} and ${max}. ${message}`);
    }
    return true;
  }

  assertTrend(trend, expected, message = '') {
    const validTrends = ['up', 'down', 'same'];
    if (!validTrends.includes(trend)) {
      throw new Error(`Invalid trend: ${trend}. Must be one of ${validTrends.join(', ')}`);
    }
    if (trend !== expected) {
      throw new Error(`Expected trend ${expected}, got ${trend}. ${message}`);
    }
    return true;
  }

  assertExists(value, message = '') {
    if (value === null || value === undefined) {
      throw new Error(`Expected value to exist. ${message}`);
    }
    return true;
  }

  // Test data generators
  generateScoreEntry(daysAgo, score, notes) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      date: date,
      summary: score,
      notes: notes
    };
  }

  generateWorkweekData(mondayDaysAgo, dailyScores, notes = '#work') {
    const entries = [];
    const monday = new Date();
    monday.setDate(monday.getDate() - mondayDaysAgo);
    
    for (let i = 0; i < 5; i++) { // Monday through Friday
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      entries.push({
        date: date,
        summary: dailyScores[i] || 3,
        notes: `Day ${i + 1} ${notes}`
      });
    }
    return entries;
  }

  generateTaggedEntries(count, daysAgo, tag, avgScore = 4) {
    const entries = [];
    for (let i = 0; i < count; i++) {
      entries.push(this.generateScoreEntry(
        daysAgo + i,
        avgScore + (Math.random() - 0.5), // Slight variation
        `Entry with ${tag} tag #test`
      ));
    }
    return entries;
  }

  // Summary
  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('═'.repeat(25));
    console.log(`Total tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`Success rate: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n⚠️  Some tests failed. Check the output above for details.');
      return false;
    } else {
      console.log('\n🎉 All tests passed!');
      return true;
    }
  }
}

/**
 * Mock FaveDayApp class for testing
 * Implements all widget calculation methods with test data
 */
class MockFaveDayApp {
  constructor(testData = []) {
    this.all = testData;
    this.setupTagCache();
  }

  setupTagCache() {
    // Create basic tag cache for testing
    const tagCache = {};
    this.all.forEach(entry => {
      const tags = entry.notes.match(/[#@]\p{L}[\p{L}\d]*/gu) || [];
      tags.forEach(tag => {
        const cleanTag = tag.slice(1).toLowerCase();
        if (!tagCache[cleanTag]) {
          tagCache[cleanTag] = {
            totalUses: 0,
            avgScore: 0,
            isPerson: tag.startsWith('@'),
            yearStats: {}
          };
        }
        tagCache[cleanTag].totalUses++;
        tagCache[cleanTag].avgScore = ((tagCache[cleanTag].avgScore * (tagCache[cleanTag].totalUses - 1)) + entry.summary) / tagCache[cleanTag].totalUses;
      });
    });
    
    localStorage.setItem('tagCache', JSON.stringify(tagCache));
  }

  // Widget calculation methods (copy from main app)
  getThirtyDayComparisons() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const currentPeriod = this.all.filter(s => s.date >= thirtyDaysAgo && s.date <= now);
    const previousPeriod = this.all.filter(s => s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo);

    const currentEntries = currentPeriod.length;
    const previousEntries = previousPeriod.length;
    const entriesDiff = currentEntries - previousEntries;

    const currentAvgScore = currentPeriod.length > 0 ? currentPeriod.reduce((sum, s) => sum + s.summary, 0) / currentPeriod.length : 0;
    const previousAvgScore = previousPeriod.length > 0 ? previousPeriod.reduce((sum, s) => sum + s.summary, 0) / previousPeriod.length : 0;
    const scoreDiff = currentAvgScore - previousAvgScore;

    const formatPctTrend = (current, previous) => {
      if (previous === 0 && current === 0) return { trend: 'same', trendDisplay: '' };
      if (previous === 0) return { trend: 'up', trendDisplay: `↗ +${Math.round(current)}%` };
      const pct = ((current - previous) / previous) * 100;
      if (Math.abs(pct) < 0.5) return { trend: 'same', trendDisplay: '' };
      if (pct > 0) return { trend: 'up', trendDisplay: `↗ +${Math.abs(pct).toFixed(1)}%` };
      return { trend: 'down', trendDisplay: `↘ -${Math.abs(pct).toFixed(1)}%` };
    };

    const entriesTrend = formatPctTrend(currentEntries, previousEntries);
    const scoreTrend = formatPctTrend(currentAvgScore, previousAvgScore);

    return {
      entries: {
        current: currentEntries,
        previous: previousEntries,
        diff: entriesDiff,
        trend: entriesTrend.trend,
        trendDisplay: entriesTrend.trendDisplay
      },
      score: {
        current: Math.round(currentAvgScore * 10) / 10,
        previous: Math.round(previousAvgScore * 10) / 10,
        diff: Math.round(scoreDiff * 10) / 10,
        trend: scoreTrend.trend,
        trendDisplay: scoreTrend.trendDisplay
      }
    };
  }

  getActiveWorkweeks() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);

    const getMondayOfWeek = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    };

    const currentEntries = this.all.filter(score => score.date >= threeSixtyFiveDaysAgo);
    const currentWorkweeks = new Map();

    currentEntries.forEach(entry => {
      const dayOfWeek = entry.date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const monday = getMondayOfWeek(entry.date);
        const weekKey = monday.toISOString().split('T')[0];
        
        if (!currentWorkweeks.has(weekKey)) {
          currentWorkweeks.set(weekKey, 0);
        }
        currentWorkweeks.set(weekKey, currentWorkweeks.get(weekKey) + entry.summary);
      }
    });

    const currentActiveWorkweeks = Array.from(currentWorkweeks.values()).filter(total => total > 10);
    const currentTotalWorkweeks = currentWorkweeks.size;

    const currentPercentage = currentTotalWorkweeks > 0 ?
      Math.round((currentActiveWorkweeks.length / currentTotalWorkweeks) * 100) : 0;

    const trend = currentPercentage > 50 ? 'up' : currentPercentage < 50 ? 'down' : 'same';

    return {
      percentage: currentPercentage,
      activeCount: currentActiveWorkweeks.length,
      totalWorkweeks: currentTotalWorkweeks,
      trend: trend
    };
  }

  getSeasonProgress() {
    const now = new Date();
    const year = now.getFullYear();
    
    // Simplified season logic for testing
    const month = now.getMonth();
    let currentSeason, seasonStart, seasonEnd;
    
    if (month >= 2 && month <= 4) {
      currentSeason = 'Spring';
      seasonStart = new Date(year, 2, 20);
      seasonEnd = new Date(year, 5, 20);
    } else if (month >= 5 && month <= 7) {
      currentSeason = 'Summer';
      seasonStart = new Date(year, 5, 21);
      seasonEnd = new Date(year, 8, 22);
    } else if (month >= 8 && month <= 10) {
      currentSeason = 'Fall';
      seasonStart = new Date(year, 8, 23);
      seasonEnd = new Date(year, 11, 20);
    } else {
      currentSeason = 'Winter';
      seasonStart = new Date(year, 11, 21);
      seasonEnd = new Date(year + 1, 2, 19);
    }
    
    const totalDays = Math.ceil((seasonEnd - seasonStart) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now - seasonStart) / (1000 * 60 * 60 * 24));
    const percentage = Math.round((daysPassed / totalDays) * 100);
    
    const seasonEmojis = { 'Spring': '🌸', 'Summer': '☀️', 'Fall': '🍂', 'Winter': '❄️' };
    
    return {
      season: currentSeason,
      emoji: seasonEmojis[currentSeason] || '📅',
      percentage: Math.min(100, Math.max(0, percentage)),
      daysPassed: Math.max(0, daysPassed),
      totalDays: totalDays
    };
  }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestFramework, MockFaveDayApp };
} else {
  // Browser environment - make available globally
  window.TestFramework = TestFramework;
  window.MockFaveDayApp = MockFaveDayApp;
}