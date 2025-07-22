/**
 * FaveDay Test Runner
 * Unified test runner for all widget and functionality tests
 */

const path = require('path');
const { TestFramework } = require('./test-framework');

// Import all test suites
const { runCoreWidgetTests } = require('./widgets/core-widgets.test');
const { runNewWidgetTests } = require('./widgets/new-widgets.test');

class FaveDayTestRunner {
  constructor() {
    this.testSuites = new Map();
    this.globalResults = { passed: 0, failed: 0, total: 0, suites: [] };
    
    // Register test suites
    this.registerTestSuite('Core Widgets', runCoreWidgetTests);
    this.registerTestSuite('New Widgets', runNewWidgetTests);
  }

  registerTestSuite(name, testFunction) {
    this.testSuites.set(name, testFunction);
  }

  async runAllTests() {
    console.log('🚀 FaveDay Test Suite Runner');
    console.log('═'.repeat(40));
    console.log(`Found ${this.testSuites.size} test suites`);
    console.log(`Started at: ${new Date().toLocaleTimeString()}\n`);

    const startTime = Date.now();
    let allPassed = true;

    // Run each test suite
    for (const [suiteName, testFunction] of this.testSuites) {
      console.log(`\n🧪 Running ${suiteName} Test Suite`);
      console.log('─'.repeat(suiteName.length + 20));
      
      try {
        const suiteStartTime = Date.now();
        const suitePassed = testFunction();
        const suiteEndTime = Date.now();
        
        this.globalResults.suites.push({
          name: suiteName,
          passed: suitePassed,
          duration: suiteEndTime - suiteStartTime
        });
        
        if (!suitePassed) {
          allPassed = false;
        }
        
        console.log(`⏱️  Suite completed in ${suiteEndTime - suiteStartTime}ms`);
        
      } catch (error) {
        console.error(`💥 Test suite "${suiteName}" crashed:`);
        console.error(`   ${error.message}`);
        allPassed = false;
        
        this.globalResults.suites.push({
          name: suiteName,
          passed: false,
          error: error.message,
          duration: 0
        });
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Print final summary
    this.printFinalSummary(totalDuration, allPassed);
    
    return allPassed;
  }

  printFinalSummary(duration, allPassed) {
    console.log('\n' + '═'.repeat(60));
    console.log('🏁 FINAL TEST RESULTS');
    console.log('═'.repeat(60));
    
    // Suite-by-suite results
    this.globalResults.suites.forEach(suite => {
      const status = suite.passed ? '✅ PASS' : '❌ FAIL';
      const duration = suite.duration > 0 ? `${suite.duration}ms` : 'crashed';
      console.log(`${status} ${suite.name.padEnd(20)} (${duration})`);
      if (suite.error) {
        console.log(`     Error: ${suite.error}`);
      }
    });
    
    // Overall summary
    console.log('\n📊 Overall Results:');
    const passedSuites = this.globalResults.suites.filter(s => s.passed).length;
    const totalSuites = this.globalResults.suites.length;
    
    console.log(`   Test Suites: ${passedSuites}/${totalSuites} passed`);
    console.log(`   Total Duration: ${duration}ms`);
    console.log(`   Status: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
    console.log(`   Completed at: ${new Date().toLocaleTimeString()}`);
    
    if (!allPassed) {
      console.log('\n💡 Tip: Run individual test suites for detailed failure analysis');
      console.log('   Example: node tests/widgets/core-widgets.test.js');
    }
  }

  // Run specific test suite by name
  async runTestSuite(suiteName) {
    if (!this.testSuites.has(suiteName)) {
      console.error(`❌ Test suite "${suiteName}" not found`);
      console.log('Available test suites:');
      this.testSuites.forEach((_, name) => console.log(`  - ${name}`));
      return false;
    }

    console.log(`🧪 Running ${suiteName} Test Suite`);
    const testFunction = this.testSuites.get(suiteName);
    return testFunction();
  }

  // List available test suites
  listTestSuites() {
    console.log('📋 Available Test Suites:');
    this.testSuites.forEach((_, name) => {
      console.log(`  - ${name}`);
    });
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const runner = new FaveDayTestRunner();
  
  if (args.length === 0) {
    // Run all tests
    runner.runAllTests().then(success => {
      process.exit(success ? 0 : 1);
    });
  } else if (args[0] === '--list') {
    // List available test suites
    runner.listTestSuites();
  } else if (args[0] === '--suite') {
    // Run specific test suite
    const suiteName = args[1];
    if (!suiteName) {
      console.error('❌ Please specify a test suite name');
      console.log('Usage: node run-all-tests.js --suite "Core Widgets"');
      runner.listTestSuites();
      process.exit(1);
    }
    
    runner.runTestSuite(suiteName).then(success => {
      process.exit(success ? 0 : 1);
    });
  } else {
    console.log('FaveDay Test Runner Usage:');
    console.log('  node run-all-tests.js           # Run all tests');
    console.log('  node run-all-tests.js --list    # List available test suites');
    console.log('  node run-all-tests.js --suite "Suite Name"  # Run specific suite');
  }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FaveDayTestRunner };
  
  // Run CLI if called directly
  if (require.main === module) {
    main();
  }
}