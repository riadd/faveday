/**
 * Unified FaveDay Test Framework
 * Comprehensive testing for all app functionality
 */

class UnifiedTestFramework {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.results = {
      totalSuites: 0,
      totalTests: 0,
      passed: 0,
      failed: 0,
      suites: []
    };
    
    this.setupMocks();
  }

  setupMocks() {
    // Mock localStorage for Node.js environment
    if (typeof localStorage === 'undefined') {
      global.localStorage = {
        data: {},
        getItem: function(key) { return this.data[key] || null; },
        setItem: function(key, value) { this.data[key] = value; },
        clear: function() { this.data = {}; }
      };
    }

    // Mock window object for browser APIs
    if (typeof window === 'undefined') {
      global.window = {
        api: {
          getConfig: async () => ({ birthdate: '1990-01-01' })
        },
        app: {
          showMonth: (year, month) => ({ year, month })
        }
      };
    }
  }

  describe(suiteName, testFunction) {
    this.currentSuite = {
      name: suiteName,
      tests: [],
      passed: 0,
      failed: 0,
      startTime: Date.now()
    };

    console.log(`\n📋 ${suiteName}`);
    console.log('─'.repeat(suiteName.length + 3));

    try {
      testFunction.call(this);
      this.currentSuite.endTime = Date.now();
      this.currentSuite.duration = this.currentSuite.endTime - this.currentSuite.startTime;
      this.suites.push(this.currentSuite);
    } catch (error) {
      console.error(`💥 Suite setup failed: ${error.message}`);
      this.currentSuite.error = error.message;
      this.currentSuite.endTime = Date.now();
      this.currentSuite.duration = 0;
      this.suites.push(this.currentSuite);
    }

    this.currentSuite = null;
  }

  test(testName, testFunction) {
    if (!this.currentSuite) {
      throw new Error('test() must be called within describe()');
    }

    const testResult = {
      name: testName,
      passed: false,
      error: null,
      output: null,
      startTime: Date.now()
    };

    try {
      const result = testFunction.call(this);
      testResult.passed = result !== false;
      testResult.endTime = Date.now();
      
      if (testResult.passed) {
        console.log(`  ✅ ${testName}`);
        this.currentSuite.passed++;
        this.results.passed++;
      } else {
        console.log(`  ❌ ${testName}: Test returned false`);
        this.currentSuite.failed++;
        this.results.failed++;
      }
    } catch (error) {
      testResult.passed = false;
      testResult.error = error.message;
      testResult.endTime = Date.now();
      
      console.log(`  ❌ ${testName}`);
      console.log(`     Error: ${error.message}`);
      
      this.currentSuite.failed++;
      this.results.failed++;
    }

    this.currentSuite.tests.push(testResult);
    this.results.totalTests++;
  }

  // Enhanced widget-specific test method
  testWidget(widgetName, testFunction) {
    this.test(`${widgetName} Widget`, () => {
      console.log(`     🔧 Testing ${widgetName}...`);
      return testFunction.call(this);
    });
  }

  // Assertion methods
  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
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

  assertBetween(actual, min, max, message = '') {
    if (actual < min || actual > max) {
      throw new Error(`Expected ${actual} to be between ${min} and ${max}. ${message}`);
    }
    return true;
  }

  assertExists(value, message = '') {
    if (value === null || value === undefined) {
      throw new Error(`Expected value to exist. ${message}`);
    }
    return true;
  }

  assertArrayLength(arr, expectedLength, message = '') {
    if (!Array.isArray(arr)) {
      throw new Error(`Expected array, got ${typeof arr}. ${message}`);
    }
    if (arr.length !== expectedLength) {
      throw new Error(`Expected array length ${expectedLength}, got ${arr.length}. ${message}`);
    }
    return true;
  }

  // Data generation utilities
  generateScoreEntry(daysAgo, score, notes) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return { date, summary: score, notes };
  }

  generateWorkweekData(mondayDaysAgo, dailyScores, notes = '#work') {
    const entries = [];
    const monday = new Date();
    monday.setDate(monday.getDate() - mondayDaysAgo);
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      entries.push({
        date,
        summary: dailyScores[i] || 3,
        notes: `Workday ${i + 1} ${notes}`
      });
    }
    return entries;
  }

  generateTaggedEntries(count, startDaysAgo, tag, avgScore = 4) {
    const entries = [];
    for (let i = 0; i < count; i++) {
      entries.push(this.generateScoreEntry(
        startDaysAgo + i,
        avgScore + (Math.random() - 0.5),
        `Entry with ${tag} #test`
      ));
    }
    return entries;
  }

  generateSpacedHighScores(count, startDaysAgo, daySpacing) {
    const entries = [];
    for (let i = 0; i < count; i++) {
      const daysAgo = startDaysAgo + (i * daySpacing);
      entries.push(this.generateScoreEntry(daysAgo, 4 + Math.floor(Math.random() * 2), `#high #spaced`)); // Random 4 or 5 score
    }
    return entries;
  }

  // Final results summary
  printResults() {
    console.log('\n' + '═'.repeat(80));
    console.log('📊 COMPREHENSIVE TEST RESULTS');
    console.log('═'.repeat(80));

    // Detailed suite results
    this.suites.forEach(suite => {
      const status = suite.failed === 0 ? '✅ PASS' : '❌ FAIL';
      const duration = suite.duration ? `${suite.duration}ms` : 'failed';
      const testCount = `${suite.passed + suite.failed} tests`;
      
      console.log(`${status} ${suite.name.padEnd(25)} (${testCount}, ${duration})`);
      
      if (suite.failed > 0) {
        const failedTests = suite.tests.filter(t => !t.passed);
        failedTests.forEach(test => {
          console.log(`     ❌ ${test.name}`);
          if (test.error) {
            console.log(`        ${test.error}`);
          }
        });
      }
    });

    // Overall statistics
    console.log('\n📈 Summary Statistics:');
    console.log(`   Test Suites: ${this.suites.filter(s => s.failed === 0).length}/${this.suites.length} passed`);
    console.log(`   Individual Tests: ${this.results.passed}/${this.results.totalTests} passed`);
    console.log(`   Success Rate: ${Math.round((this.results.passed / this.results.totalTests) * 100)}%`);
    console.log(`   Total Duration: ${this.suites.reduce((sum, s) => sum + (s.duration || 0), 0)}ms`);

    const allPassed = this.results.failed === 0;
    console.log(`   Overall Status: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);

    if (!allPassed) {
      console.log('\n💡 Debug Tips:');
      console.log('   • Check widget calculation logic for failed tests');
      console.log('   • Verify mock data represents realistic scenarios');
      console.log('   • Run individual test suites for detailed analysis');
    }

    return allPassed;
  }
}

/**
 * Unified Mock FaveDay App
 * Single mock implementation for all widget testing
 */
class MockFaveDayApp {
  constructor(testData = []) {
    this.all = testData;
    this.setupTagCache();
  }

  setupTagCache() {
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
            yearStats: {},
            firstUsage: entry.date,
            lastUsage: entry.date
          };
        }
        tagCache[cleanTag].totalUses++;
        const currentSum = tagCache[cleanTag].avgScore * (tagCache[cleanTag].totalUses - 1);
        tagCache[cleanTag].avgScore = (currentSum + entry.summary) / tagCache[cleanTag].totalUses;
        
        const year = entry.date.getFullYear();
        if (!tagCache[cleanTag].yearStats[year]) {
          tagCache[cleanTag].yearStats[year] = 0;
        }
        tagCache[cleanTag].yearStats[year]++;
        
        if (entry.date < tagCache[cleanTag].firstUsage) {
          tagCache[cleanTag].firstUsage = entry.date;
        }
        if (entry.date > tagCache[cleanTag].lastUsage) {
          tagCache[cleanTag].lastUsage = entry.date;
        }
      });
    });
    
    localStorage.setItem('tagCache', JSON.stringify(tagCache));
  }

  // Widget methods - all the calculations from faveday.js
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

    const currentWordCount = currentPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
    const previousWordCount = previousPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
    const currentAvgWords = currentPeriod.length > 0 ? Math.round(currentWordCount / 30) : 0;
    const previousAvgWords = previousPeriod.length > 0 ? Math.round(previousWordCount / 30) : 0;
    const wordsDiff = currentAvgWords - previousAvgWords;

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
    const wordsTrend = formatPctTrend(currentAvgWords, previousAvgWords);
    const scoreTrend = formatPctTrend(currentAvgScore, previousAvgScore);

    return {
      entries: {
        current: currentEntries,
        previous: previousEntries,
        diff: entriesDiff,
        trend: entriesTrend.trend,
        trendDisplay: entriesTrend.trendDisplay
      },
      words: {
        current: currentAvgWords,
        previous: previousAvgWords,
        diff: wordsDiff,
        trend: wordsTrend.trend,
        trendDisplay: wordsTrend.trendDisplay
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

    return {
      percentage: currentPercentage,
      activeCount: currentActiveWorkweeks.length,
      totalWorkweeks: currentTotalWorkweeks,
      trend: currentPercentage > 50 ? 'up' : currentPercentage < 50 ? 'down' : 'same'
    };
  }

  getSeasonProgress() {
    const now = new Date();
    const year = now.getFullYear();
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

  getCoverageProgress() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    
    const currentEntries = this.all.filter(score => score.date >= threeSixtyFiveDaysAgo);
    const daysPassed = Math.floor((now - threeSixtyFiveDaysAgo) / (1000 * 60 * 60 * 24)) + 1;
    const percentage = daysPassed > 0 ? Math.round((currentEntries.length / daysPassed) * 100) : 0;
    
    return {
      entriesMade: currentEntries.length,
      daysPassed: daysPassed,
      percentage: percentage,
      trend: percentage > 50 ? 'up' : percentage < 50 ? 'down' : 'same'
    };
  }

  getAverageDurationBetweenHighScores() {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    
    // Helper function to calculate average duration
    const calculateAverageDuration = (entries) => {
      const highScoreEntries = entries.filter(score => score.summary >= 4)
        .sort((a, b) => a.date - b.date);
      
      if (highScoreEntries.length < 2) return null;
      
      const durations = [];
      for (let i = 1; i < highScoreEntries.length; i++) {
        const daysDiff = Math.floor((highScoreEntries[i].date - highScoreEntries[i-1].date) / (1000 * 60 * 60 * 24));
        durations.push(daysDiff);
      }
      
      return durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : null;
    };
    
    // Current year (last 365 days)
    const currentYearEntries = this.all.filter(score => score.date >= oneYearAgo);
    const currentAvgDuration = calculateAverageDuration(currentYearEntries);
    
    // Previous year (365 days before that)
    const previousYearEntries = this.all.filter(score => 
      score.date >= twoYearsAgo && score.date < oneYearAgo
    );
    const previousAvgDuration = calculateAverageDuration(previousYearEntries);
    
    // Calculate trend (lower duration = better, so invert args)
    let trend = 'same';
    let trendDisplay = '';

    if (currentAvgDuration !== null && previousAvgDuration !== null) {
      if (previousAvgDuration === 0) {
        trend = 'same';
        trendDisplay = '';
      } else {
        const pct = ((previousAvgDuration - currentAvgDuration) / currentAvgDuration) * 100;
        if (Math.abs(pct) < 0.5) {
          trend = 'same';
          trendDisplay = '';
        } else if (pct > 0) {
          trend = 'up';
          trendDisplay = `↗ +${Math.abs(pct).toFixed(1)}%`;
        } else {
          trend = 'down';
          trendDisplay = `↘ -${Math.abs(pct).toFixed(1)}%`;
        }
      }
    }
    
    return {
      averageDays: currentAvgDuration,
      previousAverageDays: previousAvgDuration,
      trend: trend,
      trendDisplay: trendDisplay
    };
  }

  getDaysSinceLastScore(targetScore) {
    const now = new Date();
    const targetScores = this.all.filter(s => s.summary === targetScore);
    
    if (targetScores.length === 0) {
      return null; // No scores of this type found
    }
    
    const latestScore = targetScores.sort((a, b) => b.date - a.date)[0];
    const daysDiff = Math.floor((now - latestScore.date) / (1000 * 60 * 60 * 24));
    
    // Calculate trend by comparing current vs previous 30-day periods
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    
    // Get most recent target score in last 30 days
    const currentPeriodScores = this.all.filter(s => 
      s.summary === targetScore && s.date >= thirtyDaysAgo
    );
    const currentDays = currentPeriodScores.length > 0 ? 
      Math.floor((now - currentPeriodScores.sort((a, b) => b.date - a.date)[0].date) / (1000 * 60 * 60 * 24)) : 
      null;
    
    // Get most recent target score in previous 30 days (30-60 days ago)
    const previousPeriodScores = this.all.filter(s => 
      s.summary === targetScore && s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo
    );
    const previousDays = previousPeriodScores.length > 0 ? 
      Math.floor((thirtyDaysAgo - previousPeriodScores.sort((a, b) => b.date - a.date)[0].date) / (1000 * 60 * 60 * 24)) : 
      null;
    
    // Calculate trend as percentage change
    let trend = 'same';
    let trendDisplay = '';

    if (currentDays !== null && previousDays !== null) {
      const formatPct = (cur, prev) => {
        if (prev === 0 && cur === 0) return { trend: 'same', trendDisplay: '' };
        if (prev === 0) return { trend: 'up', trendDisplay: `↗ +${Math.round(cur)}%` };
        const pct = ((cur - prev) / prev) * 100;
        if (Math.abs(pct) < 0.5) return { trend: 'same', trendDisplay: '' };
        if (pct > 0) return { trend: 'up', trendDisplay: `↗ +${Math.abs(pct).toFixed(1)}%` };
        return { trend: 'down', trendDisplay: `↘ -${Math.abs(pct).toFixed(1)}%` };
      };

      if (targetScore >= 4) {
        // For high scores (4+): lower days since = better, so invert args
        const pctTrend = formatPct(previousDays, currentDays);
        trend = pctTrend.trend;
        trendDisplay = pctTrend.trendDisplay;
      } else {
        // For low scores (1-2): higher days since = better
        const pctTrend = formatPct(currentDays, previousDays);
        trend = pctTrend.trend;
        trendDisplay = pctTrend.trendDisplay;
      }
    }
    
    // Mock dateStr and dateId methods for testing
    const mockDateStr = () => latestScore.date.toLocaleDateString();
    const mockDateId = () => latestScore.date.toISOString().split('T')[0];
    
    return {
      days: daysDiff,
      lastDate: mockDateStr(),
      dateId: mockDateId(),
      trend: trend,
      trendDisplay: trendDisplay
    };
  }
}

module.exports = { UnifiedTestFramework, MockFaveDayApp };