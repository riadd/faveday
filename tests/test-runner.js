#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.failures = [];
    this.passes = 0;
    this.beforeEachCallbacks = [];
  }

  describe(description, callback) {
    console.log(`\n📋 ${description}`);
    const oldBeforeEach = this.beforeEachCallbacks.slice();
    callback();
    this.beforeEachCallbacks = oldBeforeEach;
  }

  it(testName, testFunction) {
    this.tests.push({ 
      name: testName, 
      fn: testFunction,
      beforeEach: this.beforeEachCallbacks.slice()
    });
  }

  beforeEach(callback) {
    this.beforeEachCallbacks.push(callback);
  }

  async run() {
    console.log('🚀 Running FaveDay Tag Tests\n');
    
    for (const test of this.tests) {
      try {
        // Run beforeEach callbacks
        for (const beforeEachFn of test.beforeEach) {
          await beforeEachFn();
        }
        
        await test.fn();
        console.log(`  ✅ ${test.name}`);
        this.passes++;
      } catch (error) {
        console.log(`  ❌ ${test.name}`);
        console.log(`     Error: ${error.message}`);
        this.failures.push({ name: test.name, error });
      }
    }

    this.printSummary();
    process.exit(this.failures.length > 0 ? 1 : 0);
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${this.passes} passed, ${this.failures.length} failed`);
    
    if (this.failures.length > 0) {
      console.log('\n❌ Failures:');
      this.failures.forEach(failure => {
        console.log(`  - ${failure.name}: ${failure.error.message}`);
      });
    } else {
      console.log('\n🎉 All tests passed!');
    }
  }
}

// Global test runner instance
const runner = new TestRunner();
global.describe = runner.describe.bind(runner);
global.it = runner.it.bind(runner);
global.beforeEach = runner.beforeEach.bind(runner);
global.assert = assert;

// Load all test files
async function loadTests() {
  const testFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.test.js'))
    .map(file => path.join(__dirname, file));

  for (const testFile of testFiles) {
    console.log(`Loading ${path.basename(testFile)}...`);
    require(testFile);
  }
}

// Run tests
(async () => {
  try {
    await loadTests();
    await runner.run();
  } catch (error) {
    console.error('Test runner failed:', error);
    process.exit(1);
  }
})();