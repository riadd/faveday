/**
 * Debug script for Total Entries widget issue
 * This will help diagnose why the widget might show "down" when you expect "up"
 */

// Mock the exact calculation logic
function debugThirtyDayEntries(testData) {
  console.log('🔍 Debugging Total Entries Widget Calculation...\n');
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);

  console.log('Date boundaries:');
  console.log('  Now:', now.toDateString());
  console.log('  30 days ago:', thirtyDaysAgo.toDateString());
  console.log('  60 days ago:', sixtyDaysAgo.toDateString());
  console.log('');

  // Current 30 days
  const currentPeriod = testData.filter(s => s.date >= thirtyDaysAgo && s.date <= now);
  console.log(`📅 Current period (${thirtyDaysAgo.toDateString()} to ${now.toDateString()}):`);
  console.log(`  Found ${currentPeriod.length} entries`);
  currentPeriod.forEach(entry => {
    console.log(`    ${entry.date.toDateString()}: Score ${entry.summary} - "${entry.notes.substring(0, 30)}..."`);
  });
  console.log('');
  
  // Previous 30 days (31-60 days ago)
  const previousPeriod = testData.filter(s => s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo);
  console.log(`📅 Previous period (${sixtyDaysAgo.toDateString()} to ${thirtyDaysAgo.toDateString()}):`);
  console.log(`  Found ${previousPeriod.length} entries`);
  previousPeriod.forEach(entry => {
    console.log(`    ${entry.date.toDateString()}: Score ${entry.summary} - "${entry.notes.substring(0, 30)}..."`);
  });
  console.log('');

  // Show entries that might be just outside the boundaries
  const justOutsideCurrent = testData.filter(s => s.date < thirtyDaysAgo && s.date >= new Date(thirtyDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000));
  console.log('📅 Just outside current period (last 7 days before 30-day boundary):');
  console.log(`  Found ${justOutsideCurrent.length} entries`);
  justOutsideCurrent.forEach(entry => {
    console.log(`    ${entry.date.toDateString()}: Score ${entry.summary} - "${entry.notes.substring(0, 30)}..."`);
  });
  console.log('');

  // Entry count comparison
  const currentEntries = currentPeriod.length;
  const previousEntries = previousPeriod.length;
  const entriesDiff = currentEntries - previousEntries;

  console.log('📊 Results:');
  console.log(`  Current entries: ${currentEntries}`);
  console.log(`  Previous entries: ${previousEntries}`);
  console.log(`  Difference: ${entriesDiff}`);
  console.log(`  Trend: ${entriesDiff > 0 ? 'UP ↗' : entriesDiff < 0 ? 'DOWN ↘' : 'SAME →'}`);
  
  // Calculate percentage change
  const percentageChange = previousEntries > 0 ? Math.round((entriesDiff / previousEntries) * 100) : 0;
  console.log(`  Percentage change: ${percentageChange > 0 ? '+' : ''}${percentageChange}%`);
  
  return {
    currentEntries,
    previousEntries,
    entriesDiff,
    trend: entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same',
    percentageChange
  };
}

// Test with a realistic scenario where you might have been more active recently
console.log('🧪 Test Case: Recent Activity Surge (should show UP)');
const testData = [];

// Generate previous period data (31-60 days ago) - moderate activity
for (let i = 35; i <= 55; i += 5) {
  testData.push({
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    summary: 3,
    notes: `Entry from ${i} days ago #work #project`
  });
}

// Generate current period data (last 30 days) - high activity
for (let i = 2; i <= 28; i += 3) {
  testData.push({
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    summary: 4,
    notes: `Recent entry from ${i} days ago #productivity #life #work`
  });
}

debugThirtyDayEntries(testData);

console.log('\n🧪 Test Case: Recent Decline (should show DOWN)');
const testDataDecline = [];

// Generate previous period data (31-60 days ago) - high activity
for (let i = 32; i <= 58; i += 2) {
  testDataDecline.push({
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    summary: 4,
    notes: `Very active period ${i} days ago #work #project #life`
  });
}

// Generate current period data (last 30 days) - low activity  
for (let i = 5; i <= 25; i += 10) {
  testDataDecline.push({
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    summary: 3,
    notes: `Less active recently ${i} days ago #tired`
  });
}

debugThirtyDayEntries(testDataDecline);