/**
 * Comprehensive FaveDay Test Runner
 * Unified test execution for all app functionality
 */

const path = require('path');

// Import all test suites
const { runAnalyticsWidgetsTests } = require('./analytics-widgets.test');
const { runTagSystemTests } = require('./tag-system.test');

class ComprehensiveTestRunner {
  constructor() {
    this.testSuites = new Map();
    this.globalResults = {
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      startTime: null,
      endTime: null,
      suiteResults: []
    };
    
    this.registerAllTestSuites();
  }

  registerAllTestSuites() {
    // Register all available test suites
    this.testSuites.set('Analytics Widgets', {
      description: 'Dashboard and analytics widget calculations',
      testFunction: runAnalyticsWidgetsTests,
      category: 'Core Features'
    });
    
    this.testSuites.set('Tag System', {
      description: 'Tag parsing, caching, and analysis engine',
      testFunction: runTagSystemTests,
      category: 'Core Features'
    });
  }

  async runAllTests() {
    console.log('🚀 FaveDay Comprehensive Test Suite');
    console.log('═'.repeat(50));
    console.log(`Testing ${this.testSuites.size} major functional areas`);
    console.log(`Started: ${new Date().toLocaleString()}`);
    console.log('');

    this.globalResults.startTime = Date.now();
    let allTestsPassed = true;

    // Group tests by category for better organization
    const categories = this.groupSuitesByCategory();
    
    for (const [category, suites] of categories) {
      console.log(`\n🔧 ${category} Tests`);
      console.log('─'.repeat(category.length + 7));
      
      for (const [suiteName, suiteInfo] of suites) {
        console.log(`\n📋 Running ${suiteName}:`);
        console.log(`   ${suiteInfo.description}`);
        console.log('');
        
        const suiteStartTime = Date.now();
        
        try {
          const suitePassed = await suiteInfo.testFunction();
          const suiteEndTime = Date.now();
          const suiteDuration = suiteEndTime - suiteStartTime;
          
          const suiteResult = {
            name: suiteName,
            category: category,
            description: suiteInfo.description,
            passed: suitePassed,
            duration: suiteDuration,
            error: null
          };
          
          this.globalResults.suiteResults.push(suiteResult);
          this.globalResults.totalSuites++;
          
          if (suitePassed) {
            this.globalResults.passedSuites++;
            console.log(`✅ ${suiteName} completed successfully (${suiteDuration}ms)\n`);
          } else {
            this.globalResults.failedSuites++;
            allTestsPassed = false;
            console.log(`❌ ${suiteName} had test failures (${suiteDuration}ms)\n`);
          }
          
        } catch (error) {
          const suiteEndTime = Date.now();
          const suiteDuration = suiteEndTime - suiteStartTime;
          
          console.error(`💥 ${suiteName} crashed: ${error.message}`);
          console.error(`   Duration: ${suiteDuration}ms\n`);
          
          this.globalResults.suiteResults.push({
            name: suiteName,
            category: category,
            description: suiteInfo.description,
            passed: false,
            duration: suiteDuration,
            error: error.message
          });
          
          this.globalResults.totalSuites++;
          this.globalResults.failedSuites++;
          allTestsPassed = false;
        }
      }
    }

    this.globalResults.endTime = Date.now();
    this.printComprehensiveResults(allTestsPassed);
    
    return allTestsPassed;
  }

  groupSuitesByCategory() {
    const categories = new Map();
    
    for (const [suiteName, suiteInfo] of this.testSuites) {
      const category = suiteInfo.category || 'Other';
      
      if (!categories.has(category)) {
        categories.set(category, new Map());
      }
      
      categories.get(category).set(suiteName, suiteInfo);
    }
    
    return categories;
  }

  printComprehensiveResults(allPassed) {
    const totalDuration = this.globalResults.endTime - this.globalResults.startTime;
    
    console.log('\n' + '═'.repeat(80));
    console.log('🏁 COMPREHENSIVE TEST RESULTS SUMMARY');
    console.log('═'.repeat(80));

    // Results by category
    const categories = this.groupSuitesByCategory();
    for (const [category, suites] of categories) {
      console.log(`\n📂 ${category}:`);
      
      for (const [suiteName, suiteInfo] of suites) {
        const result = this.globalResults.suiteResults.find(r => r.name === suiteName);
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        const duration = `${result.duration}ms`;
        
        console.log(`   ${status} ${suiteName.padEnd(20)} (${duration})`);
        
        if (result.error) {
          console.log(`      💥 Error: ${result.error}`);
        }
        
        if (!result.passed && !result.error) {
          console.log(`      ⚠️  Contains failing individual tests - see detailed output above`);
        }
      }
    }

    // Overall statistics
    console.log('\n📊 Final Statistics:');
    console.log(`   Test Suites: ${this.globalResults.passedSuites}/${this.globalResults.totalSuites} passed`);
    console.log(`   Success Rate: ${Math.round((this.globalResults.passedSuites / this.globalResults.totalSuites) * 100)}%`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Completed: ${new Date().toLocaleString()}`);

    // Final status
    console.log('\n🎯 Overall Result:');
    if (allPassed) {
      console.log('   🎉 ALL TEST SUITES PASSED!');
      console.log('   ✨ FaveDay is functioning correctly across all tested areas');
    } else {
      console.log('   ⚠️  SOME TEST SUITES FAILED');
      console.log('   🔍 Review detailed output above for specific failures');
      console.log('   💡 Failed tests may indicate bugs or areas needing attention');
    }

    // Performance insights
    const avgDuration = totalDuration / this.globalResults.totalSuites;
    console.log(`\n⚡ Performance: Average ${Math.round(avgDuration)}ms per test suite`);
    
    if (totalDuration > 1000) {
      console.log('   💡 Consider optimizing slower test suites for faster development cycles');
    } else {
      console.log('   ✅ Excellent test performance - under 1 second total execution');
    }

    return allPassed;
  }

  async runSpecificSuite(suiteName) {
    if (!this.testSuites.has(suiteName)) {
      console.error(`❌ Test suite "${suiteName}" not found`);
      this.listAvailableSuites();
      return false;
    }

    console.log(`🧪 Running ${suiteName} Test Suite`);
    console.log('─'.repeat(suiteName.length + 15));
    
    const suiteInfo = this.testSuites.get(suiteName);
    console.log(`Description: ${suiteInfo.description}`);
    console.log('');
    
    const startTime = Date.now();
    const result = await suiteInfo.testFunction();
    const duration = Date.now() - startTime;
    
    console.log(`\n⏱️  Suite completed in ${duration}ms`);
    return result;
  }

  listAvailableSuites() {
    console.log('📋 Available Test Suites:\n');
    
    const categories = this.groupSuitesByCategory();
    for (const [category, suites] of categories) {
      console.log(`📂 ${category}:`);
      
      for (const [suiteName, suiteInfo] of suites) {
        console.log(`   • ${suiteName}`);
        console.log(`     ${suiteInfo.description}`);
      }
      console.log('');
    }
  }

  printUsage() {
    console.log('FaveDay Test Runner\n');
    console.log('Usage:');
    console.log('  node test.js                    # Run all tests');
    console.log('  node test.js --list             # List available test suites');
    console.log('  node test.js --suite "NAME"     # Run specific suite');
    console.log('  node test.js --help             # Show this help');
    console.log('\nAvailable Test Suites:');
    
    for (const [suiteName, suiteInfo] of this.testSuites) {
      console.log(`  • ${suiteName}: ${suiteInfo.description}`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new ComprehensiveTestRunner();
  
  if (args.length === 0) {
    // Run all tests
    const success = await runner.runAllTests();
    process.exit(success ? 0 : 1);
    
  } else if (args[0] === '--list') {
    // List available test suites
    runner.listAvailableSuites();
    
  } else if (args[0] === '--suite') {
    // Run specific test suite
    const suiteName = args[1];
    if (!suiteName) {
      console.error('❌ Please specify a test suite name');
      runner.printUsage();
      process.exit(1);
    }
    
    const success = await runner.runSpecificSuite(suiteName);
    process.exit(success ? 0 : 1);
    
  } else if (args[0] === '--help' || args[0] === '-h') {
    // Show help
    runner.printUsage();
    
  } else {
    console.error('❌ Invalid arguments');
    runner.printUsage();
    process.exit(1);
  }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ComprehensiveTestRunner };
  
  // Run CLI if called directly
  if (require.main === module) {
    main().catch(error => {
      console.error('💥 Test runner crashed:', error.message);
      process.exit(1);
    });
  }
}