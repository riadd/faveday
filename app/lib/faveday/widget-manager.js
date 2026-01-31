/**
 * WidgetManager - Analytics and Dashboard Widget Management
 * 
 * Centralized module for all widget calculations and analytics functions.
 * Extracted from the monolithic FaveDayApp class to improve maintainability,
 * testability, and separation of concerns.
 */
class WidgetManager {
  constructor(dataManager, scoreCalculator, router) {
    this.dataManager = dataManager;
    this.scoreCalculator = scoreCalculator;
    this.router = router;
  }

  /**
   * Get all scores data (delegated to DataManager)
   * @returns {Array} All score entries
   */
  getAllScores() {
    return this.dataManager.getAllScores();
  }

  /**
   * Get years array (delegated to DataManager)
   * @returns {Array} Array of years with data
   */
  getYears() {
    return this.dataManager.getYears();
  }

  /**
   * Load tag cache from DataManager
   * @returns {Object} Tag cache data
   */
  getTagCache() {
    return this.dataManager.getTagCache() || {};
  }

  /**
   * Helper method to format trend indicators
   * @param {number} diff - Difference value
   * @returns {Object} Trend object with direction and display
   */
  formatTrend(diff) {
    const absDiff = Math.abs(diff);
    let trend, trendDisplay;
    
    if (diff > 0) {
      trend = 'up';
      trendDisplay = `+${absDiff.toFixed(1)}`;
    } else if (diff < 0) {
      trend = 'down'; 
      trendDisplay = `-${absDiff.toFixed(1)}`;
    } else {
      trend = 'same';
      trendDisplay = '0.0';
    }
    
    return { trend, trendDisplay };
  }

  /**
   * Helper method to format percentage trend indicators
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {Object} Percentage trend object
   */
  formatPercentageTrend(current, previous) {
    if (previous === 0) {
      if (current === 0) {
        return { trend: 'same', trendDisplay: '' };
      } else {
        return { trend: 'up', trendDisplay: `↗ +${Math.round(current)}%` };
      }
    }

    const percentChange = ((current - previous) / previous) * 100;
    const absChange = Math.abs(percentChange);

    if (absChange < 0.5) {
      return { trend: 'same', trendDisplay: '' };
    }

    if (percentChange > 0) {
      return { trend: 'up', trendDisplay: `↗ +${absChange.toFixed(1)}%` };
    } else {
      return { trend: 'down', trendDisplay: `↘ -${absChange.toFixed(1)}%` };
    }
  }

  // =============================================================================
  // CORE ANALYTICS / DASHBOARD WIDGETS
  // =============================================================================

  /**
   * Get score distribution overview
   * @param {Array} scores - Array of score objects
   * @returns {Object} Percentage breakdown by score value
   */
  getOverview(scores) {
    let overview = [0,0,0,0,0];
    
    for (let score of scores) {
      if (score.summary >= 1 && score.summary <= 5) {
        overview[score.summary-1] += 1;
      }
    }
    
    const total = overview.reduce((sum, count) => sum + count, 0);
    if (total === 0) {
      return { count1: 0, count2: 0, count3: 0, count4: 0, count5: 0 };
    }
    
    return {
      count1: Math.round(100 * overview[0] / total * 10) / 10,
      count2: Math.round(100 * overview[1] / total * 10) / 10,
      count3: Math.round(100 * overview[2] / total * 10) / 10,
      count4: Math.round(100 * overview[3] / total * 10) / 10,
      count5: Math.round(100 * overview[4] / total * 10) / 10,
    };
  }

  /**
   * Get 30-day vs previous 30-day comparisons
   * @returns {Object} Comparison metrics for entries, words, and scores
   */
  async getThirtyDayComparisons() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // Current 30 days
    const currentPeriod = this.getAllScores().filter(s => s.date >= thirtyDaysAgo && s.date <= now);
    
    // Previous 30 days (31-60 days ago)
    const previousPeriod = this.getAllScores().filter(s => s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo);

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
    const currentAvgScore = currentPeriod.length > 0 ? this.scoreCalculator.calculate(currentPeriod) : 0;
    const previousAvgScore = previousPeriod.length > 0 ? this.scoreCalculator.calculate(previousPeriod) : 0;
    const scoreDiff = currentAvgScore - previousAvgScore;

    // Format trends as percentage changes
    const wordsTrend = this.formatPercentageTrend(currentAvgWords, previousAvgWords);
    const entriesTrend = this.formatPercentageTrend(currentEntries, previousEntries);
    const scoreTrend = this.formatPercentageTrend(currentAvgScore, previousAvgScore);

    return {
      // Words per day
      currentAvgWords: currentAvgWords,
      previousAvgWords: previousAvgWords,
      wordsDiff: wordsDiff,
      wordsTrend: wordsTrend.trend,
      wordsTrendDisplay: wordsTrend.trendDisplay,

      // Entry count  
      currentEntries: currentEntries,
      previousEntries: previousEntries,
      entriesDiff: entriesDiff,
      entriesTrend: entriesTrend.trend,
      entriesTrendDisplay: entriesTrend.trendDisplay,

      // Average score
      currentAvgScore: currentAvgScore.toFixed(2),
      previousAvgScore: previousAvgScore.toFixed(2),
      scoreDiff: scoreDiff.toFixed(2),
      scoreTrend: scoreTrend.trend,
      scoreTrendDisplay: scoreTrend.trendDisplay
    };
  }

  /**
   * Get total overview statistics
   * @returns {Object} Total entries and average score
   */
  getTotalOverview() {
    const allScores = this.getAllScores();
    const totalEntries = allScores.length;
    const avgScore = totalEntries > 0 ? this.scoreCalculator.calculate(allScores).toFixed(1) : '0.0';
    
    return {
      totalEntries: totalEntries,
      totalScoreAvg: avgScore
    };
  }

  /**
   * Get calendar year progress
   * @returns {Object} Current year progress information
   */
  getCalendarYearProgress() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const isLeapYear = ((currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0));
    const totalDaysInYear = isLeapYear ? 366 : 365;
    
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
    const percentage = Math.round((dayOfYear / totalDaysInYear) * 100);
    
    return {
      year: currentYear,
      dayOfYear: dayOfYear,
      daysPassed: dayOfYear,
      totalDays: totalDaysInYear,
      percentage: percentage
    };
  }

  /**
   * Get life year progress based on birthdate
   * @param {string} birthdate - User's birthdate in YYYY-MM-DD format
   * @returns {Object} Life year progress information
   */
  getLifeYearProgress(birthdate) {
    if (!birthdate) {
      return null;
    }
    
    const birth = new Date(birthdate);
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear();
    
    // Calculate the birthday for this year
    const thisYearBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    const nextYearBirthday = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
    
    // Check if birthday has passed this year
    const birthdayPassed = now >= thisYearBirthday;
    const currentAge = birthdayPassed ? age : age - 1;
    
    // Calculate progress through current life year
    const yearStart = birthdayPassed ? thisYearBirthday : new Date(now.getFullYear() - 1, birth.getMonth(), birth.getDate());
    const yearEnd = birthdayPassed ? nextYearBirthday : thisYearBirthday;
    
    const yearLength = yearEnd - yearStart;
    const daysSinceYearStart = now - yearStart;
    const percentage = Math.round((daysSinceYearStart / yearLength) * 100);
    
    // Calculate day counts for footer
    const daysPassed = Math.floor(daysSinceYearStart / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = Math.floor(yearLength / (1000 * 60 * 60 * 24)) + 1;
    const nextAge = currentAge + 1;
    
    return {
      age: currentAge,
      nextAge: nextAge,
      daysPassed: Math.max(1, daysPassed),
      totalDays: totalDays,
      percentage: Math.max(0, Math.min(100, percentage))
    };
  }

  /**
   * Get diary coverage progress for the last year (most recent 365 days at most)
   * @returns {Object} Coverage statistics and trends
   */
  getCoverageProgress() {
    const allScores = this.getAllScores();
    if (allScores.length === 0) {
      return { percentage: 0, trend: 'same', trendDisplay: '0%' };
    }
    
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setDate(now.getDate() - 365);
    
    // Count entries in the last year (or since first entry if less than a year)
    const firstEntry = new Date(Math.min(...allScores.map(s => s.date)));
    const periodStart = firstEntry > oneYearAgo ? firstEntry : oneYearAgo;
    const recentEntries = allScores.filter(s => s.date >= periodStart);
    
    const totalDaysInPeriod = Math.floor((now - periodStart) / (1000 * 60 * 60 * 24)) + 1;
    const entriesCount = recentEntries.length;
    const currentPercentage = Math.round((entriesCount / totalDaysInPeriod) * 100);
    
    // Compare with 30 days ago (same period length, ending 30 days ago)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const previousPeriodStart = new Date(periodStart);
    previousPeriodStart.setDate(periodStart.getDate() - 30);
    
    const entriesInPreviousPeriod = allScores.filter(s => 
      s.date >= previousPeriodStart && s.date <= thirtyDaysAgo
    ).length;
    const previousTotalDays = Math.floor((thirtyDaysAgo - previousPeriodStart) / (1000 * 60 * 60 * 24)) + 1;
    const previousPercentage = previousTotalDays > 0 ? Math.round((entriesInPreviousPeriod / previousTotalDays) * 100) : 0;
    
    const percentageTrend = this.formatPercentageTrend(currentPercentage, previousPercentage);
    
    return {
      percentage: currentPercentage,
      entriesMade: entriesCount,
      daysPassed: totalDaysInPeriod,
      trend: percentageTrend.trend,
      trendDisplay: percentageTrend.trendDisplay
    };
  }

  // =============================================================================
  // TIME-BASED ANALYTICS WIDGETS
  // =============================================================================

  /**
   * Get days since last score of a specific value
   * @param {number} targetScore - Score value to search for (1-5)
   * @returns {Object|null} Days since information with trend
   */
  getDaysSinceLastScore(targetScore) {
    const now = new Date();
    const allScores = this.getAllScores();
    const targetScores = allScores.filter(s => s.summary === targetScore);
    
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
    const currentPeriodScores = allScores.filter(s => 
      s.summary === targetScore && s.date >= thirtyDaysAgo
    );
    const currentDays = currentPeriodScores.length > 0 ? 
      Math.floor((now - currentPeriodScores.sort((a, b) => b.date - a.date)[0].date) / (1000 * 60 * 60 * 24)) : 
      null;
    
    // Get most recent target score in previous 30 days (30-60 days ago)
    const previousPeriodScores = allScores.filter(s => 
      s.summary === targetScore && s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo
    );
    const previousDays = previousPeriodScores.length > 0 ? 
      Math.floor((thirtyDaysAgo - previousPeriodScores.sort((a, b) => b.date - a.date)[0].date) / (1000 * 60 * 60 * 24)) : 
      null;
    
    // Calculate trend as percentage change
    let trend = 'same';
    let trendDisplay = '';

    if (currentDays !== null && previousDays !== null) {
      if (targetScore >= 4) {
        // For high scores (4+): lower days since = better, so invert args
        const pctTrend = this.formatPercentageTrend(previousDays, currentDays);
        trend = pctTrend.trend;
        trendDisplay = pctTrend.trendDisplay;
      } else {
        // For low scores (1-2): higher days since = better
        const pctTrend = this.formatPercentageTrend(currentDays, previousDays);
        trend = pctTrend.trend;
        trendDisplay = pctTrend.trendDisplay;
      }
    }
    
    return {
      days: daysDiff,
      lastDate: latestScore.dateStr(),
      dateId: latestScore.dateId(),
      trend: trend,
      trendDisplay: trendDisplay
    };
  }

  /**
   * Get count of 5-score days with trend comparison
   * @returns {Object} Count and trend information for perfect days
   */
  getFiveScoreDaysCount() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    const sevenThirtyDaysAgo = new Date(now);
    sevenThirtyDaysAgo.setDate(now.getDate() - 730);
    
    const allScores = this.getAllScores();
    
    // Current period
    const currentFiveScoreDays = allScores.filter(score => 
      score.date >= threeSixtyFiveDaysAgo && score.summary === 5
    );
    
    // Previous period  
    const previousFiveScoreDays = allScores.filter(score => 
      score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo && score.summary === 5
    );
    
    const currentCount = currentFiveScoreDays.length;
    const previousCount = previousFiveScoreDays.length;
    const countDiff = currentCount - previousCount;
    
    const percentageTrend = this.formatPercentageTrend(currentCount, previousCount);

    return {
      currentCount: currentCount,
      previousCount: previousCount,
      countDiff: countDiff,
      trend: percentageTrend.trend,
      trendDisplay: percentageTrend.trendDisplay
    };
  }

  /**
   * Get average duration between high scores (4+ rating)
   * @returns {Object} Duration statistics with trend
   */
  getAverageDurationBetweenHighScores() {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setDate(now.getDate() - 365);
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setDate(now.getDate() - 730);
    
    const allScores = this.getAllScores();
    
    // Helper function to calculate average duration between high scores
    const calculateAverageDuration = (scores) => {
      const highScoreEntries = scores.filter(entry => entry.summary >= 4).sort((a, b) => a.date - b.date);
      
      if (highScoreEntries.length < 2) {
        return null; // Need at least 2 high scores to calculate duration
      }
      
      const durations = [];
      for (let i = 1; i < highScoreEntries.length; i++) {
        const daysDiff = Math.floor((highScoreEntries[i].date - highScoreEntries[i-1].date) / (1000 * 60 * 60 * 24));
        durations.push(daysDiff);
      }
      
      return durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : null;
    };
    
    // Current year (last 365 days)
    const currentYearEntries = allScores.filter(score => score.date >= oneYearAgo);
    const currentAvgDuration = calculateAverageDuration(currentYearEntries);
    
    // Previous year (365-730 days ago)
    const previousYearEntries = allScores.filter(score => 
      score.date >= twoYearsAgo && score.date < oneYearAgo
    );
    const previousAvgDuration = calculateAverageDuration(previousYearEntries);
    
    // Calculate trend (lower duration = better, so invert args)
    let trend = 'same';
    let trendDisplay = '';

    if (currentAvgDuration !== null && previousAvgDuration !== null) {
      const pctTrend = this.formatPercentageTrend(previousAvgDuration, currentAvgDuration);
      trend = pctTrend.trend;
      trendDisplay = pctTrend.trendDisplay;
    }
    
    return {
      currentAvgDuration: currentAvgDuration,
      previousAvgDuration: previousAvgDuration,
      trend: trend,
      trendDisplay: trendDisplay
    };
  }

  /**
   * Get person mentions ratio statistics
   * @returns {Object} Person mention statistics with trend
   */
  getPersonMentionsRatio() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    const sevenThirtyDaysAgo = new Date(now);
    sevenThirtyDaysAgo.setDate(now.getDate() - 730);
    
    const allScores = this.getAllScores();
    
    // Current period (last 365 days)
    const currentEntries = allScores.filter(score => score.date >= threeSixtyFiveDaysAgo);
    const currentEntriesWithPeople = currentEntries.filter(score => 
      score.notes && score.notes.match(/@\p{L}[\p{L}\d]*/gu)
    );
    
    // Previous period (365 days before that)
    const previousEntries = allScores.filter(score => 
      score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo
    );
    const previousEntriesWithPeople = previousEntries.filter(score => 
      score.notes && score.notes.match(/@\p{L}[\p{L}\d]*/gu)
    );
    
    const currentPercentage = currentEntries.length > 0 ? 
      Math.round((currentEntriesWithPeople.length / currentEntries.length) * 100) : 0;
    const previousPercentage = previousEntries.length > 0 ? 
      Math.round((previousEntriesWithPeople.length / previousEntries.length) * 100) : 0;
    
    // Calculate trend
    const percentageTrend = this.formatPercentageTrend(currentPercentage, previousPercentage);

    return {
      percentage: currentPercentage,
      daysWithPeople: currentEntriesWithPeople.length,
      totalDays: currentEntries.length,
      trend: percentageTrend.trend,
      trendDisplay: percentageTrend.trendDisplay,
      previousPercentage: previousPercentage
    };
  }

  /**
   * Get season progress information
   * @returns {Object} Current season progress
   */
  getSeasonProgress() {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    
    // Define meteorological seasons (3 months each, starting 1st of month)
    const seasons = [
      { name: 'Winter', months: [11, 0, 1] }, // Dec, Jan, Feb
      { name: 'Spring', months: [2, 3, 4] },  // Mar, Apr, May
      { name: 'Summer', months: [5, 6, 7] },  // Jun, Jul, Aug
      { name: 'Autumn', months: [8, 9, 10] }  // Sep, Oct, Nov
    ];
    
    // Determine current season
    let currentSeason;
    let seasonStart, seasonEnd;
    
    if (month >= 11 || month <= 1) {
      currentSeason = seasons[0]; // Winter
      seasonStart = new Date(month >= 11 ? now.getFullYear() : now.getFullYear() - 1, 11, 1);
      seasonEnd = new Date(month <= 1 ? now.getFullYear() : now.getFullYear() + 1, 1, 28); // Feb 28/29
    } else if (month >= 2 && month <= 4) {
      currentSeason = seasons[1]; // Spring
      seasonStart = new Date(now.getFullYear(), 2, 1);
      seasonEnd = new Date(now.getFullYear(), 4, 31);
    } else if (month >= 5 && month <= 7) {
      currentSeason = seasons[2]; // Summer
      seasonStart = new Date(now.getFullYear(), 5, 1);
      seasonEnd = new Date(now.getFullYear(), 7, 31);
    } else {
      currentSeason = seasons[3]; // Autumn
      seasonStart = new Date(now.getFullYear(), 8, 1);
      seasonEnd = new Date(now.getFullYear(), 10, 30);
    }
    
    // Calculate progress through season
    const seasonLength = seasonEnd - seasonStart;
    const daysSinceStart = now - seasonStart;
    const percentage = Math.round((daysSinceStart / seasonLength) * 100);
    
    // Calculate day counts for footer
    const daysPassed = Math.floor(daysSinceStart / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = Math.floor(seasonLength / (1000 * 60 * 60 * 24)) + 1;
    
    // Add season emoji
    const seasonEmojis = {
      'Winter': '❄️',
      'Spring': '🌸', 
      'Summer': '☀️',
      'Autumn': '🍂'
    };
    
    return {
      season: currentSeason.name,
      emoji: seasonEmojis[currentSeason.name] || '🌍',
      daysPassed: Math.max(1, daysPassed),
      totalDays: totalDays,
      percentage: Math.max(0, Math.min(100, percentage))
    };
  }

  // =============================================================================
  // DAY-TYPE ANALYTICS WIDGETS
  // =============================================================================

  /**
   * Get active Sunday statistics
   * @returns {Object} Sunday activity analysis with trend
   */
  getActiveSundays() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    const sevenThirtyDaysAgo = new Date(now);
    sevenThirtyDaysAgo.setDate(now.getDate() - 730);

    const allScores = this.getAllScores();

    // Current period
    const currentSundays = allScores.filter(s => s.date >= threeSixtyFiveDaysAgo && s.date.getDay() === 0);
    const currentActiveSundays = currentSundays.filter(s => s.summary >= 3);

    // Previous period
    const previousSundays = allScores.filter(s =>
      s.date >= sevenThirtyDaysAgo && s.date < threeSixtyFiveDaysAgo && s.date.getDay() === 0
    );
    const previousActiveSundays = previousSundays.filter(s => s.summary >= 3);

    const currentPercentage = currentSundays.length > 0 ?
      Math.round((currentActiveSundays.length / currentSundays.length) * 100) : 0;
    const previousPercentage = previousSundays.length > 0 ?
      Math.round((previousActiveSundays.length / previousSundays.length) * 100) : 0;

    const percentageTrend = this.formatPercentageTrend(currentPercentage, previousPercentage);

    return {
      percentage: currentPercentage,
      activeCount: currentActiveSundays.length,
      totalSundays: currentSundays.length,
      trend: percentageTrend.trend,
      trendDisplay: percentageTrend.trendDisplay,
      previousPercentage: previousPercentage
    };
  }

  /**
   * Get active Saturday statistics
   * @returns {Object} Saturday activity analysis with trend
   */
  getActiveSaturdays() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    const sevenThirtyDaysAgo = new Date(now);
    sevenThirtyDaysAgo.setDate(now.getDate() - 730);

    const allScores = this.getAllScores();

    // Current period
    const currentSaturdays = allScores.filter(s => s.date >= threeSixtyFiveDaysAgo && s.date.getDay() === 6);
    const currentActiveSaturdays = currentSaturdays.filter(s => s.summary >= 3);

    // Previous period
    const previousSaturdays = allScores.filter(s =>
      s.date >= sevenThirtyDaysAgo && s.date < threeSixtyFiveDaysAgo && s.date.getDay() === 6
    );
    const previousActiveSaturdays = previousSaturdays.filter(s => s.summary >= 3);

    const currentPercentage = currentSaturdays.length > 0 ?
      Math.round((currentActiveSaturdays.length / currentSaturdays.length) * 100) : 0;
    const previousPercentage = previousSaturdays.length > 0 ?
      Math.round((previousActiveSaturdays.length / previousSaturdays.length) * 100) : 0;

    const percentageTrend = this.formatPercentageTrend(currentPercentage, previousPercentage);

    return {
      percentage: currentPercentage,
      activeCount: currentActiveSaturdays.length,
      totalSaturdays: currentSaturdays.length,
      trend: percentageTrend.trend,
      trendDisplay: percentageTrend.trendDisplay,
      previousPercentage: previousPercentage
    };
  }

  /**
   * Get active workweeks statistics
   * @returns {Object} Workweek activity analysis with trend
   */
  getActiveWorkweeks() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    const sevenThirtyDaysAgo = new Date(now);
    sevenThirtyDaysAgo.setDate(now.getDate() - 730);

    const allScores = this.getAllScores();

    // Helper function to get Monday of the week for a given date
    const getMondayOfWeek = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(d.setDate(diff));
    };

    // Current period workweeks
    const currentEntries = allScores.filter(score => score.date >= threeSixtyFiveDaysAgo);
    const currentWorkweeks = new Map();

    currentEntries.forEach(entry => {
      const dayOfWeek = entry.date.getDay();
      // Only count Monday (1) through Friday (5)
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

    // Previous period workweeks
    const previousEntries = allScores.filter(score =>
      score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo
    );
    const previousWorkweeks = new Map();

    previousEntries.forEach(entry => {
      const dayOfWeek = entry.date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const monday = getMondayOfWeek(entry.date);
        const weekKey = monday.toISOString().split('T')[0];

        if (!previousWorkweeks.has(weekKey)) {
          previousWorkweeks.set(weekKey, 0);
        }
        previousWorkweeks.set(weekKey, previousWorkweeks.get(weekKey) + entry.summary);
      }
    });

    const previousActiveWorkweeks = Array.from(previousWorkweeks.values()).filter(total => total > 10);
    const previousTotalWorkweeks = previousWorkweeks.size;

    const currentPercentage = currentTotalWorkweeks > 0 ?
      Math.round((currentActiveWorkweeks.length / currentTotalWorkweeks) * 100) : 0;
    const previousPercentage = previousTotalWorkweeks > 0 ?
      Math.round((previousActiveWorkweeks.length / previousTotalWorkweeks) * 100) : 0;

    const percentageTrend = this.formatPercentageTrend(currentPercentage, previousPercentage);

    return {
      percentage: currentPercentage,
      activeCount: currentActiveWorkweeks.length,
      totalWorkweeks: currentTotalWorkweeks,
      trend: percentageTrend.trend,
      trendDisplay: percentageTrend.trendDisplay,
      previousPercentage: previousPercentage
    };
  }

  // =============================================================================
  // TAG-BASED ANALYTICS WIDGETS  
  // =============================================================================

  /**
   * Get trending topic tags analysis
   * @returns {Array} List of trending topic tags with surge ratios
   */
  getTrendingTopics() {
    // Get recent 30-day usage for topic tags (#tags)
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const allScores = this.getAllScores();
    const recentEntries = allScores.filter(s => s.date >= thirtyDaysAgo);
    const recentTopicCounts = {};
    
    recentEntries.forEach(score => {
      if (!score.notes) return; // Skip entries without notes
      const topicTags = score.notes.match(/#\p{L}[\p{L}\d]*/gu) || [];
      topicTags.forEach(tag => {
        const cleanTag = tag.slice(1).toLowerCase();
        recentTopicCounts[cleanTag] = (recentTopicCounts[cleanTag] || 0) + 1;
      });
    });
    
    // Load tag cache to get historical usage
    const tagCache = this.getTagCache();
    
    // Find tags with recent surge that aren't staples
    const trendingTopics = [];
    Object.entries(recentTopicCounts).forEach(([tag, recentCount]) => {
      const cacheData = tagCache[tag];
      if (!cacheData || cacheData.isPerson) return; // Skip people tags or missing cache
      
      const totalUses = cacheData.totalUses || 0;
      const yearCount = Math.max(1, Object.keys(cacheData.yearStats || {}).length);
      const historicalAvgPerYear = totalUses > 0 ? totalUses / yearCount : 0;
      // Convert to monthly average for fair comparison with 30-day recent usage
      const historicalAvgPerMonth = historicalAvgPerYear / 12;
      
      // Only include tags that:
      // 1. Have recent activity (>= 2 uses in 30 days)  
      // 2. Show surge (recent usage > 1.5x historical monthly average - more reasonable threshold)
      // 3. Aren't super common staples (< 100 total historical uses - increased threshold)
      if (recentCount >= 2 && recentCount > (historicalAvgPerMonth * 1.5) && totalUses < 100) {
        const surgeRatio = historicalAvgPerMonth > 0 ? (recentCount / historicalAvgPerMonth) : recentCount;
        trendingTopics.push({
          tag: tag,
          recentCount: recentCount,
          surgeRatio: Math.round(surgeRatio * 10) / 10,
          avgScore: cacheData.avgScore || 0
        });
      }
    });
    
    // Sort by surge ratio (highest surge first)  
    let results = trendingTopics.sort((a, b) => b.surgeRatio - a.surgeRatio).slice(0, 3);
    
    // Fallback: If no trending topics found, show most frequently used recent topics
    if (results.length === 0) {
      const fallbackTopics = [];
      Object.entries(recentTopicCounts).forEach(([tag, recentCount]) => {
        const cacheData = tagCache[tag];
        // Only require cache data and not being a person - show ANY recent usage as fallback
        if (cacheData && !cacheData.isPerson && recentCount >= 1) {
          fallbackTopics.push({
            tag: tag,
            recentCount: recentCount,
            surgeRatio: 1.0, // Flat ratio for fallback items
            avgScore: cacheData.avgScore || 0,
            isFallback: true // Mark as fallback for UI
          });
        }
      });
      results = fallbackTopics.sort((a, b) => b.recentCount - a.recentCount).slice(0, 3);
    }
    
    // Return null instead of empty array to prevent template double-rendering
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get trending people tags analysis (similar to topics but for @mentions)
   * @returns {Object|null} Single trending person tag with surge ratio, or null if none
   */
  getTrendingPeople() {
    // Get recent 30-day usage for person tags (@tags)
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const allScores = this.getAllScores();
    const recentEntries = allScores.filter(s => s.date >= thirtyDaysAgo);
    const recentPeopleCounts = {};
    
    recentEntries.forEach(score => {
      if (!score.notes) return; // Skip entries without notes
      const peopleTags = score.notes.match(/@\p{L}[\p{L}\d]*/gu) || [];
      peopleTags.forEach(tag => {
        const cleanTag = tag.slice(1).toLowerCase();
        recentPeopleCounts[cleanTag] = (recentPeopleCounts[cleanTag] || 0) + 1;
      });
    });
    
    // Load tag cache to get historical usage
    const tagCache = this.getTagCache();
    
    // Find people with recent surge that aren't constant companions
    const trendingPeople = [];
    Object.entries(recentPeopleCounts).forEach(([tag, recentCount]) => {
      const cacheData = tagCache[tag];
      if (!cacheData || !cacheData.isPerson) return; // Skip non-people or missing cache
      
      const totalUses = cacheData.totalUses || 0;
      const yearCount = Math.max(1, Object.keys(cacheData.yearStats || {}).length);
      const historicalAvgPerYear = totalUses > 0 ? totalUses / yearCount : 0;
      // Convert to monthly average for fair comparison with 30-day recent usage
      const historicalAvgPerMonth = historicalAvgPerYear / 12;
      
      // Only include people that:
      // 1. Have recent activity (>= 2 mentions in 30 days)  
      // 2. Show surge (recent usage > 1.2x historical monthly average - lower threshold for people)
      // 3. Aren't constant companions (< 150 total historical mentions)
      if (recentCount >= 2 && recentCount > (historicalAvgPerMonth * 1.2) && totalUses < 150) {
        const surgeRatio = historicalAvgPerMonth > 0 ? (recentCount / historicalAvgPerMonth) : recentCount;
        trendingPeople.push({
          tag: tag,
          recentCount: recentCount,
          surgeRatio: Math.round(surgeRatio * 10) / 10,
          avgScore: cacheData.avgScore || 0
        });
      }
    });
    
    // Sort by surge ratio (highest surge first)
    let results = trendingPeople.sort((a, b) => b.surgeRatio - a.surgeRatio).slice(0, 3);
    
    // Fallback: If no trending people found, show most frequently mentioned recent people
    if (results.length === 0) {
      const fallbackPeople = [];
      Object.entries(recentPeopleCounts).forEach(([tag, recentCount]) => {
        const cacheData = tagCache[tag];
        // Only require cache data and being a person - show ANY recent usage as fallback
        if (cacheData && cacheData.isPerson && recentCount >= 1) {
          fallbackPeople.push({
            tag: tag,
            recentCount: recentCount,
            surgeRatio: 1.0, // Flat ratio for fallback items
            avgScore: cacheData.avgScore || 0,
            isFallback: true // Mark as fallback for UI
          });
        }
      });
      results = fallbackPeople.sort((a, b) => b.recentCount - a.recentCount).slice(0, 3);
    }
    
    // Return null instead of empty array to prevent template double-rendering
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get super tag calculation - the most impactful tag
   * @returns {Object|null} The highest scoring tag based on weighted formula
   */
  getSuperTag() {
    // Get recent 30-day usage for all tags
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const allScores = this.getAllScores();
    const recentEntries = allScores.filter(s => s.date >= thirtyDaysAgo);
    const recentTagData = {};
    
    // Collect recent tag usage with scores
    recentEntries.forEach(score => {
      const allTags = score.notes.match(/[#@]\p{L}[\p{L}\d]*/gu) || [];
      allTags.forEach(tag => {
        const cleanTag = tag.slice(1).toLowerCase();
        if (!recentTagData[cleanTag]) {
          recentTagData[cleanTag] = {
            scores: [],
            count: 0,
            isPersonTag: tag.startsWith('@')
          };
        }
        recentTagData[cleanTag].scores.push(score.summary);
        recentTagData[cleanTag].count++;
      });
    });
    
    // Load tag cache for historical context
    const tagCache = this.getTagCache();
    
    // Calculate Super Tag score using weighted formula
    const superTagCandidates = [];
    Object.entries(recentTagData).forEach(([tag, data]) => {
      // Must have at least 2 recent uses to be considered
      if (data.count < 2) return;
      
      // Convert raw scores to score objects for scoreCalculator
      const scoreObjects = data.scores.map(score => ({ summary: score }));
      const avgScore = this.scoreCalculator.calculate(scoreObjects);
      const recentCount = data.count;
      
      // Get historical context from cache
      const cacheData = tagCache[tag] || {};
      const totalHistoricalUses = cacheData.totalUses || recentCount;
      
      /**
       * SUPER TAG WEIGHTED FORMULA:
       * 
       * superScore = (avgScore * sqrt(recentCount)) / frequencyBias
       * 
       * Where:
       * - avgScore: Average score of entries with this tag (quality component)
       * - sqrt(recentCount): Diminishing returns on usage (prevents spam, rewards meaningful use)
       * - frequencyBias: Normalizes against over/under-used tags
       * 
       * frequencyBias = 1 + (totalUses / expectedUses)^0.5
       * - expectedUses = estimated reasonable usage over time
       * - This prevents both single-use bias AND overused tag bias
       */
      
      const expectedUses = Math.max(5, Math.min(30, totalHistoricalUses * 0.3)); // Reasonable range
      const frequencyBias = 1 + Math.pow(totalHistoricalUses / expectedUses, 0.5);
      const usageWeight = Math.sqrt(recentCount);
      const superScore = (avgScore * usageWeight) / frequencyBias;
      
      superTagCandidates.push({
        tag: tag,
        superScore: Math.round(superScore * 100) / 100,
        avgScore: Math.round(avgScore * 10) / 10,
        recentCount: recentCount,
        totalUses: totalHistoricalUses,
        frequencyBias: Math.round(frequencyBias * 100) / 100,
        isPersonTag: data.isPersonTag
      });
    });
    
    // Sort by super score (highest first)
    superTagCandidates.sort((a, b) => b.superScore - a.superScore);
    
    return superTagCandidates.length > 0 ? superTagCandidates[0] : null;
  }

  // =============================================================================
  // ADVANCED ANALYTICS WIDGETS
  // =============================================================================

  /**
   * Get score consistency metrics
   * @returns {Object} Consistency analysis with standard deviation and trends
   */
  getScoreConsistency() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    const sevenThirtyDaysAgo = new Date(now);
    sevenThirtyDaysAgo.setDate(now.getDate() - 730);
    
    const allScores = this.getAllScores();
    
    // Helper function to calculate standard deviation using scoreCalculator for mean
    const calculateStandardDeviation = (entries) => {
      if (entries.length === 0) return 0;
      const mean = this.scoreCalculator.calculate(entries);
      const scores = entries.map(entry => entry.summary || 0);
      const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
      return Math.sqrt(avgSquaredDiff);
    };
    
    // Current period (last 365 days)
    const currentEntries = allScores.filter(score => score.date >= threeSixtyFiveDaysAgo);
    const currentStdDev = calculateStandardDeviation(currentEntries);
    
    // Previous period (365 days before that)
    const previousEntries = allScores.filter(score => 
      score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo
    );
    const previousStdDev = calculateStandardDeviation(previousEntries);
    
    // Calculate consistency score (inverted - lower std dev = higher consistency)
    const currentConsistency = currentStdDev > 0 ? Math.round((2.0 / currentStdDev) * 100) / 100 : 5.0;
    const previousConsistency = previousStdDev > 0 ? Math.round((2.0 / previousStdDev) * 100) / 100 : 5.0;
    
    // Calculate trend (higher consistency = better trend)
    const percentageTrend = this.formatPercentageTrend(currentConsistency, previousConsistency);

    return {
      consistency: currentConsistency,
      stdDev: Math.round(currentStdDev * 100) / 100,
      previousConsistency: previousConsistency,
      previousStdDev: Math.round(previousStdDev * 100) / 100,
      entryCount: currentEntries.length,
      trend: percentageTrend.trend,
      trendDisplay: percentageTrend.trendDisplay
    };
  }
  
  /**
   * Get score type information (delegated to ScoreCalculator)
   * @returns {Object} Score type metadata with icon and name
   */
  getScoreTypeInfo() {
    return this.scoreCalculator.getScoreTypeInfo();
  }

  /**
   * Get next future entry countdown
   * @returns {Object} Countdown information for next future letter
   */
  getNextFutureLetter() {
    const futureEntries = this.dataManager.getFutureEntries();
    
    if (!futureEntries || futureEntries.length === 0) {
      return {
        hasEntry: false,
        message: 'No future letters'
      };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time for date comparison
    
    // Find the next future entry (earliest date after today)
    const upcomingEntries = futureEntries
      .filter(entry => new Date(entry.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (upcomingEntries.length === 0) {
      return {
        hasEntry: false,
        message: 'No upcoming letters'
      };
    }

    const nextEntry = upcomingEntries[0];
    const targetDate = new Date(nextEntry.date);
    targetDate.setHours(0, 0, 0, 0);
    
    // Calculate days until
    const timeDiff = targetDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return {
      hasEntry: true,
      daysUntil: daysUntil,
      targetDate: targetDate,
      message: daysUntil === 1 ? 'Tomorrow' : 
               daysUntil === 0 ? 'Today' : 
               `in ${daysUntil} days`
    };
  }

}

// Export for Node.js (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WidgetManager;
}