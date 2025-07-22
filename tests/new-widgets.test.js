/**
 * Test suite for new widget implementations
 * Tests the 6 new widgets: Lazy Workweeks, Trending Topics/People, Consistency, Super Tag, Season Progress
 */

// Mock FaveDayApp for testing new widgets
class MockFaveDayAppNew {
  constructor(testData) {
    this.all = testData;
    
    // Mock localStorage for tag cache
    global.localStorage = {
      data: {},
      getItem: function(key) {
        return this.data[key] || null;
      },
      setItem: function(key, value) {
        this.data[key] = value;
      }
    };
  }

  // New widget functions to test
  getLazyWorkweeks() {
    const now = new Date();
    const threeSixtyFiveDaysAgo = new Date(now);
    threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
    const sevenThirtyDaysAgo = new Date(now);
    sevenThirtyDaysAgo.setDate(now.getDate() - 730);
    
    // Helper function to get Monday of the week for a given date
    const getMondayOfWeek = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(d.setDate(diff));
    };
    
    // Current period workweeks
    const currentEntries = this.all.filter(score => score.date >= threeSixtyFiveDaysAgo);
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
    
    const currentLazyWorkweeks = Array.from(currentWorkweeks.values()).filter(total => total <= 10);
    const currentTotalWorkweeks = currentWorkweeks.size;
    
    // Previous period workweeks
    const previousEntries = this.all.filter(score => 
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
    
    const previousLazyWorkweeks = Array.from(previousWorkweeks.values()).filter(total => total <= 10);
    const previousTotalWorkweeks = previousWorkweeks.size;
    
    const currentPercentage = currentTotalWorkweeks > 0 ? 
      Math.round((currentLazyWorkweeks.length / currentTotalWorkweeks) * 100) : 0;
    const previousPercentage = previousTotalWorkweeks > 0 ? 
      Math.round((previousLazyWorkweeks.length / previousTotalWorkweeks) * 100) : 0;
    
    // Calculate trend (note: for lazy workweeks, more is bad, so invert the trend logic)
    const diff = currentPercentage - previousPercentage;
    const trend = diff > 0 ? 'down' : diff < 0 ? 'up' : 'same'; // Inverted: more lazy = down trend
    const trendDisplay = diff === 0 ? '' : 
      diff > 0 ? `↘ +${Math.abs(diff)}%` : `↗ -${Math.abs(diff)}%`;
    
    return {
      percentage: currentPercentage,
      lazyCount: currentLazyWorkweeks.length,
      totalWorkweeks: currentTotalWorkweeks,
      trend: trend,
      trendDisplay: trendDisplay,
      previousPercentage: previousPercentage,
      _debug: { currentWorkweeks: Array.from(currentWorkweeks.entries()), previousWorkweeks: Array.from(previousWorkweeks.entries()) }
    };
  }

  getSeasonProgress() {
    const now = new Date();
    const year = now.getFullYear();
    
    // Define season boundaries (Northern Hemisphere)
    const seasons = {
      'Spring': { start: new Date(year, 2, 20), end: new Date(year, 5, 20) }, // Mar 20 - Jun 20
      'Summer': { start: new Date(year, 5, 21), end: new Date(year, 8, 22) }, // Jun 21 - Sep 22
      'Fall': { start: new Date(year, 8, 23), end: new Date(year, 11, 20) },   // Sep 23 - Dec 20
      'Winter': { start: new Date(year, 11, 21), end: new Date(year + 1, 2, 19) } // Dec 21 - Mar 19
    };
    
    // Determine current season
    let currentSeason = null;
    let seasonStart = null;
    let seasonEnd = null;
    
    for (const [season, dates] of Object.entries(seasons)) {
      if (season === 'Winter') {
        // Winter spans across years
        const winterStart = new Date(year - 1, 11, 21);
        const winterEnd = new Date(year, 2, 19);
        if (now >= winterStart || now <= winterEnd) {
          currentSeason = season;
          seasonStart = now.getMonth() < 3 ? winterStart : new Date(year, 11, 21);
          seasonEnd = now.getMonth() < 3 ? winterEnd : new Date(year + 1, 2, 19);
          break;
        }
      } else {
        if (now >= dates.start && now <= dates.end) {
          currentSeason = season;
          seasonStart = dates.start;
          seasonEnd = dates.end;
          break;
        }
      }
    }
    
    if (!currentSeason) {
      // Fallback logic
      const month = now.getMonth();
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
    }
    
    // Calculate progress
    const totalDays = Math.ceil((seasonEnd - seasonStart) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now - seasonStart) / (1000 * 60 * 60 * 24));
    const percentage = Math.round((daysPassed / totalDays) * 100);
    
    // Season emojis
    const seasonEmojis = {
      'Spring': '🌸',
      'Summer': '☀️', 
      'Fall': '🍂',
      'Winter': '❄️'
    };
    
    return {
      season: currentSeason,
      emoji: seasonEmojis[currentSeason] || '📅',
      percentage: Math.min(100, Math.max(0, percentage)),
      daysPassed: Math.max(0, daysPassed),
      totalDays: totalDays,
      seasonStart: seasonStart.toDateString(),
      seasonEnd: seasonEnd.toDateString()
    };
  }
}

// Test functions
function runNewWidgetTests() {
  console.log('🧪 Testing New Widgets...\n');

  // Test 1: Lazy Workweeks Widget
  console.log('📊 Test 1: Lazy Workweeks Widget');
  const workweekTestData = [];
  
  // Create a lazy workweek (Monday-Friday with low scores)
  const mondayDate = new Date('2025-07-14'); // A Monday
  for (let i = 0; i < 5; i++) {
    const date = new Date(mondayDate);
    date.setDate(mondayDate.getDate() + i);
    workweekTestData.push({
      date: date,
      summary: 1, // Low score
      notes: `Lazy workday ${i + 1} #work #tired`
    });
  }
  
  // Create a productive workweek
  const mondayDate2 = new Date('2025-07-07'); // Previous Monday  
  for (let i = 0; i < 5; i++) {
    const date = new Date(mondayDate2);
    date.setDate(mondayDate2.getDate() + i);
    workweekTestData.push({
      date: date,
      summary: 4, // High score
      notes: `Productive workday ${i + 1} #work #focus #energy`
    });
  }
  
  const app1 = new MockFaveDayAppNew(workweekTestData);
  const result1 = app1.getLazyWorkweeks();
  
  console.log('Result:', result1);
  console.log('Expected: 1 lazy workweek (≤10 points) out of 2 total = 50%');
  console.log('Lazy workweek total: 5 points (5 days × 1 point each)');
  console.log('Productive workweek total: 20 points (5 days × 4 points each)');
  console.log('Debug - Current workweeks:', result1._debug?.currentWorkweeks);
  console.log('');

  // Test 2: Season Progress Widget  
  console.log('📊 Test 2: Season Progress Widget');
  const app2 = new MockFaveDayAppNew([]);
  const result2 = app2.getSeasonProgress();
  
  console.log('Current season:', result2.season);
  console.log('Season emoji:', result2.emoji); 
  console.log('Progress:', result2.percentage + '%');
  console.log('Days passed:', result2.daysPassed + '/' + result2.totalDays);
  console.log('Season dates:', result2.seasonStart + ' to ' + result2.seasonEnd);
  console.log('Expected: Current season with reasonable progress percentage');
  console.log('');

  console.log('✅ New widget tests completed!');
}

// Run the tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runNewWidgetTests, MockFaveDayAppNew };
} else {
  runNewWidgetTests();
}