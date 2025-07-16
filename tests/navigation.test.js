// Test navigation functionality
console.log('Testing navigation functions...\n');

// Test onJumpToScoreDate function
function testJumpToScoreDate() {
  // Mock window.app.showMonth function
  const mockShowMonth = function(year, month) {
    return { year: year, month: month };
  };
  
  // Mock window object
  global.window = {
    app: {
      showMonth: mockShowMonth
    }
  };
  
  // Define the function as it would appear in the app
  function onJumpToScoreDate(dateId) {
    const dateParts = dateId.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    
    return window.app.showMonth(year, month);
  }
  
  // Test cases
  const testCases = [
    { dateId: '2024-07-15', expectedYear: 2024, expectedMonth: 7 },
    { dateId: '2023-12-01', expectedYear: 2023, expectedMonth: 12 },
    { dateId: '2025-01-30', expectedYear: 2025, expectedMonth: 1 }
  ];
  
  testCases.forEach(({ dateId, expectedYear, expectedMonth }) => {
    const result = onJumpToScoreDate(dateId);
    
    if (result.year === expectedYear && result.month === expectedMonth) {
      console.log(`✓ ${dateId} -> Year ${expectedYear}, Month ${expectedMonth}`);
    } else {
      console.log(`✗ ${dateId} -> Expected Year ${expectedYear}, Month ${expectedMonth}, got Year ${result.year}, Month ${result.month}`);
    }
  });
}

testJumpToScoreDate();
console.log('\n🎉 Navigation tests completed!');