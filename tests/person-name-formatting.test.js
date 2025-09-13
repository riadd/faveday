// Unit test for person name formatting
const { TestFramework } = require('./test-framework');

// Test the name formatting logic
function testPersonNameFormatting() {
  const test = new TestFramework();
  
  // Mock person tags that might exist in the database
  // The issue is that tags are stored lowercase in the database
  const testCases = [
    { input: 'michaelschwahn', expected: 'Michaelschwahn' }, // This is what the current logic produces
    { input: 'MichaelSchwahn', expected: 'Michael Schwahn' },
    { input: 'johnDoe', expected: 'John Doe' },
    { input: 'JohnDoe', expected: 'John Doe' },
    { input: 'sarah', expected: 'Sarah' },
    { input: 'Sarah', expected: 'Sarah' }
  ];
  
  // The actual formatting function from the current code
  function formatPersonNameCurrent(tagName) {
    return tagName
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase: abc -> a bc
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // PascalCase: ABc -> A Bc
      .replace(/^([a-z])/, (match, p1) => p1.toUpperCase()); // Capitalize first letter
  }
  
  console.log('=== Current Person Name Formatting Tests ===');
  
  testCases.forEach(({ input, expected }, index) => {
    const result = formatPersonNameCurrent(input);
    const passed = result === expected;
    
    console.log(`Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`);
    console.log(`  Input: "${input}"`);
    console.log(`  Expected (what current code should produce): "${expected}"`);
    console.log(`  Got: "${result}"`);
    console.log('');
    
    try {
      test.assertEqual(result, expected, `Name formatting for "${input}"`);
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  });
  
  return test.results;
}

// Test the improved name formatting with original casing
function testImprovedPersonNameFormatting() {
  const test = new TestFramework();
  
  console.log('=== Improved Person Name Formatting Tests ===');
  
  // Test cases that simulate having original casing data
  const testCases = [
    { 
      input: { tag: 'michaelschwahn', originalCasing: 'MichaelSchwahn' }, 
      expected: 'Michael Schwahn' 
    },
    { 
      input: { tag: 'johndoe', originalCasing: 'JohnDoe' }, 
      expected: 'John Doe' 
    },
    { 
      input: { tag: 'annamariebrown', originalCasing: 'AnnaMarieBrown' }, 
      expected: 'Anna Marie Brown' 
    },
    { 
      input: { tag: 'sarah', originalCasing: 'Sarah' }, 
      expected: 'Sarah' 
    },
    {
      input: { tag: 'tomsmithjr', originalCasing: 'tomSmithJr' },
      expected: 'Tom Smith Jr'
    }
  ];
  
  // The new formatting function with original casing support
  function formatPersonNameImproved(tag) {
    const nameToFormat = tag.originalCasing || tag.tag;
    return nameToFormat
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase: abc -> a bc
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // PascalCase: ABc -> A Bc
      .replace(/^([a-z])/, (match, p1) => p1.toUpperCase()); // Capitalize first letter
  }
  
  testCases.forEach(({ input, expected }, index) => {
    const result = formatPersonNameImproved(input);
    const passed = result === expected;
    
    console.log(`Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`);
    console.log(`  Input tag: "${input.tag}"`);
    console.log(`  Original casing: "${input.originalCasing}"`);
    console.log(`  Expected: "${expected}"`);
    console.log(`  Got: "${result}"`);
    
    if (!passed) {
      console.log(`  ❌ MISMATCH`);
    } else {
      console.log(`  ✅ SUCCESS`);
    }
    console.log('');
    
    try {
      test.assertEqual(result, expected, `Name formatting for "${input.tag}" with casing "${input.originalCasing}"`);
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  });
  
  return test.results;
}

if (require.main === module) {
  const currentResults = testPersonNameFormatting();
  const improvedResults = testImprovedPersonNameFormatting();
  
  console.log('=== Test Summary ===');
  console.log(`Current Logic - Total: ${currentResults.total}, Passed: ${currentResults.passed}, Failed: ${currentResults.failed}`);
  console.log(`Improved Logic - Total: ${improvedResults.total}, Passed: ${improvedResults.passed}, Failed: ${improvedResults.failed}`);
  
  if (improvedResults.failed > 0) {
    console.log('❌ Some improved tests failed');
    process.exit(1);
  } else {
    console.log('✅ Improved formatting logic works correctly!');
  }
}

module.exports = { testPersonNameFormatting, testImprovedPersonNameFormatting };