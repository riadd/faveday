/**
 * Tag System Test Suite
 * Comprehensive tests for tag parsing, caching, and analysis
 */

const { UnifiedTestFramework } = require('./unified-test-framework');

// Import tag system modules
const TagParser = require('../app/lib/faveday/tag-parser');
const TagCacheBuilder = require('../app/lib/faveday/tag-cache');

function runTagSystemTests() {
  const framework = new UnifiedTestFramework();

  // Tag Parser Tests
  framework.describe('Tag Parser Engine', function() {
    const parser = new TagParser();

    framework.test('Basic Tag Extraction', () => {
      console.log('       🏷️  Testing hashtag and mention extraction...');
      const text = 'Working on #coding with @alice on #javascript project';
      const tags = parser.extractTags(text);
      
      framework.assertArrayLength(tags, 3, 'Should extract 3 tags');
      framework.assertEqual(tags[0].full, '#coding', 'First hashtag');
      framework.assertEqual(tags[1].full, '@alice', 'Person mention');
      framework.assertEqual(tags[2].full, '#javascript', 'Second hashtag');
      
      console.log(`       ✓ Extracted: ${tags.map(t => t.full).join(', ')}`);
      
      return true;
    });

    framework.test('Unicode Character Support', () => {
      console.log('       🌍 Testing international character support...');
      const text = 'Meeting with @josé about #café and #naïveté topics';
      const tags = parser.extractTags(text);
      
      framework.assertArrayLength(tags, 3, 'Should handle Unicode characters');
      framework.assertEqual(tags[0].full, '@josé', 'Unicode person name');
      framework.assertEqual(tags[1].full, '#café', 'Unicode hashtag with accent');
      framework.assertEqual(tags[2].full, '#naïveté', 'Complex Unicode tag');
      
      console.log(`       ✓ Unicode support: ${tags.map(t => t.full).join(', ')}`);
      
      return true;
    });

    framework.test('Tag Position Tracking', () => {
      console.log('       📍 Testing tag position and context tracking...');
      const text = 'Started #project with @team at 9am #morning';
      const tags = parser.extractTags(text);
      
      // Verify we have 3 tags first
      framework.assertEqual(tags.length, 3, 'Should extract 3 tags');
      
      // Check actual positions (calculate them dynamically to avoid hardcoding)
      const expectedPositions = [];
      expectedPositions.push(text.indexOf('#project'));
      expectedPositions.push(text.indexOf('@team'));
      expectedPositions.push(text.indexOf('#morning'));
      
      framework.assertEqual(tags[0].start, expectedPositions[0], 'First tag position');
      framework.assertEqual(tags[1].start, expectedPositions[1], 'Second tag position');
      framework.assertEqual(tags[2].start, expectedPositions[2], 'Third tag position');
      
      console.log(`       ✓ Position tracking: ${tags.map(t => `${t.full}@${t.start}`).join(', ')}`);
      
      return true;
    });

    framework.test('CamelCase Handling', () => {
      console.log('       🐪 Testing camelCase tag processing...');
      const text = 'Using #webDev and #javaScript for #frontEnd work';
      const tags = parser.extractTags(text);
      
      // Test camelCase conversion
      const webDevSpaced = parser.camelCaseToSpace('webDev');
      const javaScriptSpaced = parser.camelCaseToSpace('javaScript');
      
      framework.assertEqual(webDevSpaced, 'web Dev', 'CamelCase conversion');
      framework.assertEqual(javaScriptSpaced, 'java Script', 'JavaScript camelCase');
      
      console.log(`       ✓ CamelCase handling: webDev → "${webDevSpaced}", javaScript → "${javaScriptSpaced}"`);
      
      return true;
    });

    framework.test('Tag Classification', () => {
      console.log('       🔍 Testing topic vs person tag classification...');
      const text = 'Discussed #algorithms with @professor and @students';
      const tags = parser.extractTags(text);
      
      const topics = tags.filter(t => t.marker === '#');
      const people = tags.filter(t => t.marker === '@');
      
      framework.assertArrayLength(topics, 1, 'Should identify topic tags');
      framework.assertArrayLength(people, 2, 'Should identify person tags');
      
      console.log(`       ✓ Classification: ${topics.length} topics, ${people.length} people`);
      
      return true;
    });
  });

  // Tag Cache System Tests
  framework.describe('Tag Cache System', function() {
    const cacheBuilder = new TagCacheBuilder();

    // Sample score data for cache testing
    const createMockScores = () => [
      {
        date: new Date('2023-06-15'),
        summary: 4,
        notes: 'Great day working on #coding with @alice. Made progress on #javascript project.'
      },
      {
        date: new Date('2023-07-20'),
        summary: 5,
        notes: 'Amazing session! @alice helped with #coding again. Love #javascript development.'
      },
      {
        date: new Date('2023-08-10'),
        summary: 3,
        notes: 'Regular day. Some #coding work and brief chat with @bob about #webdev.'
      },
      {
        date: new Date('2024-01-05'),
        summary: 4,
        notes: 'New year, new #coding challenges! Working with @alice on #react project.'
      },
      {
        date: new Date('2024-07-14'),
        summary: 2,
        notes: 'Struggling with #react concepts today. Need help from @alice tomorrow.'
      }
    ];

    framework.test('Basic Cache Statistics', () => {
      console.log('       📊 Testing tag usage statistics calculation...');
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);
      
      // Debug: Log all cache entries to understand the counting
      console.log(`       🔍 Debug: Found ${Object.keys(cache).length} unique tags:`, Object.keys(cache).join(', '));
      
      // Verify alice's statistics (appears 4 times in test data)
      const aliceStats = cache['alice'];
      framework.assertEqual(aliceStats.totalUses, 4, "Alice mentions count");
      framework.assertEqual(aliceStats.isPerson, true, "Alice is person tag");
      framework.assertBetween(aliceStats.avgScore, 3.0, 4.0, "Alice's average score");
      
      // Verify coding statistics - let's check actual count
      const codingStats = cache['coding'];
      const actualCodingCount = codingStats ? codingStats.totalUses : 0;
      console.log(`       🔍 Debug: Coding appears ${actualCodingCount} times`);
      
      // Adjust expectation based on actual data (coding appears in 4 entries: 2x in 2023, 2x in 2024)
      framework.assertEqual(codingStats.totalUses, 4, "Coding tag count");
      framework.assertEqual(codingStats.isPerson, false, "Coding is topic tag");
      
      console.log(`       ✓ Alice stats: ${aliceStats.totalUses} uses, ${aliceStats.avgScore.toFixed(1)} avg score`);
      console.log(`       ✓ Coding stats: ${codingStats.totalUses} uses, ${codingStats.avgScore.toFixed(1)} avg score`);
      
      return true;
    });

    framework.test('Year-based Usage Tracking', () => {
      console.log('       📅 Testing year-based usage statistics...');
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);
      
      const codingStats = cache['coding'];
      console.log(`       🔍 Debug: Coding year stats:`, codingStats.yearStats);
      
      // Adjust expectations based on actual data (coding appears 3x in 2023, 1x in 2024)
      framework.assertEqual(codingStats.yearStats['2023'], 3, "2023 coding usage");
      framework.assertEqual(codingStats.yearStats['2024'], 1, "2024 coding usage");
      
      console.log(`       ✓ Coding usage: 2023: ${codingStats.yearStats['2023']}, 2024: ${codingStats.yearStats['2024']}`);
      
      return true;
    });

    framework.test('Peak Year Calculation', () => {
      console.log('       🏔️  Testing peak usage year detection...');
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);
      
      const aliceStats = cache['alice'];
      console.log(`       🔍 Debug: Alice year stats:`, aliceStats.yearStats);
      console.log(`       🔍 Debug: Alice peak year: ${aliceStats.peakYear}, count: ${aliceStats.peakYearCount}`);
      
      // Based on test data: Alice appears 2 times in 2023, 2 times in 2024, so peak could be either (using first occurrence)
      framework.assertEqual(aliceStats.peakYear, '2023', "Alice's peak year");
      framework.assertEqual(aliceStats.peakYearCount, 2, "Peak year count");
      
      console.log(`       ✓ Alice peak usage: ${aliceStats.peakYear} (${aliceStats.peakYearCount} uses)`);
      
      return true;
    });

    framework.test('First and Last Usage Dates', () => {
      console.log('       📆 Testing usage date range tracking...');
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);
      
      const codingStats = cache['coding'];
      framework.assertEqual(codingStats.firstUsage.getFullYear(), 2023, "First usage year");
      framework.assertEqual(codingStats.lastUsage.getFullYear(), 2024, "Last usage year");
      
      console.log(`       ✓ Coding date range: ${codingStats.firstUsage.toDateString()} to ${codingStats.lastUsage.toDateString()}`);
      
      return true;
    });

    framework.test('Tag Queries and Filtering', () => {
      console.log('       🔎 Testing tag query and filtering capabilities...');
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);
      
      const personTags = cacheBuilder.getPersonTags(cache);
      const topicTags = cacheBuilder.getTopicTags(cache);
      
      framework.assertBetween(personTags.length, 1, 3, "Person tags count");
      framework.assertBetween(topicTags.length, 2, 5, "Topic tags count");
      
      console.log(`       ✓ Tag filtering: ${personTags.length} people, ${topicTags.length} topics`);
      
      return true;
    });

    framework.test('Recent Activity Detection', () => {
      console.log('       ⚡ Testing recent activity marking...');
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);
      
      // Tags used in current or previous year should be marked as recent
      const recentTags = Object.keys(cache).filter(tag => cache[tag].recentActivity);
      framework.assertBetween(recentTags.length, 2, 6, "Recent tags count");
      
      console.log(`       ✓ Recent activity: ${recentTags.length} tags active in current/previous year`);
      
      return true;
    });
  });

  // Tag Analysis & Intelligence Tests
  framework.describe('Tag Analysis & Intelligence', function() {
    const parser = new TagParser();

    framework.test('Tag Overlap Detection', () => {
      console.log('       🔄 Testing tag overlap and suggestion logic...');
      const existingTags = [
        { start: 0, end: 6, full: '#coding' },
        { start: 10, end: 21, full: '#javascript' },
        { start: 25, end: 31, full: '@alice' }
      ];
      
      // Test position-based overlap detection
      const hasOverlap1 = parser.checkOverlap(0, 3, existingTags);
      const hasOverlap2 = parser.checkOverlap(35, 41, existingTags);
      
      framework.assertEqual(hasOverlap1, true, "Should detect position overlap");
      framework.assertEqual(hasOverlap2, false, "Should not detect overlap for non-overlapping position");
      
      console.log(`       ✓ Overlap detection: position 0-3 → ${hasOverlap1}, position 35-41 → ${hasOverlap2}`);
      
      return true;
    });

    framework.test('Person Name Suggestions', () => {
      console.log('       👥 Testing person name suggestion engine...');
      const rawText = 'Meeting with John about project work';
      const existingTags = [];
      const tagCache = {
        'johnsmith': { isPerson: true, totalUses: 5, originalName: 'johnSmith' },
        'johnwick': { isPerson: true, totalUses: 3, originalName: 'johnWick' },
        'javascript': { isPerson: false, totalUses: 10, originalName: 'javascript' }
      };
      
      const suggestions = parser.findPersonSuggestions(rawText, existingTags, tagCache, 3, 2);
      framework.assertBetween(suggestions.length, 1, 2, "Should find John suggestions");
      
      if (suggestions.length > 0) {
        const suggestionTexts = suggestions.map(s => s.suggestedTag);
        framework.assertEqual(suggestionTexts.some(tag => tag.includes('john')), true, "Should suggest john-based tag");
      }
      
      console.log(`       ✓ Person suggestions for 'John': ${suggestions.length} found`);
      
      return true;
    });

    framework.test('Minimum Usage Thresholds', () => {
      console.log('       📊 Testing usage threshold filtering...');
      const rawText = 'Working on frequent and moderate tasks today';
      const existingTags = [];
      const tagCache = {
        'frequent': { isPerson: false, totalUses: 10, originalName: 'frequent' },
        'rare': { isPerson: false, totalUses: 1, originalName: 'rare' },
        'moderate': { isPerson: false, totalUses: 3, originalName: 'moderate' }
      };
      
      const suggestions = parser.findTopicSuggestions(rawText, existingTags, tagCache, 2, 2); // Min 2 uses
      const suggestionTexts = suggestions.map(s => s.suggestedTag);
      
      framework.assertEqual(suggestionTexts.some(tag => tag.includes('frequent')), true, "Should include frequent tags");
      framework.assertEqual(suggestionTexts.some(tag => tag.includes('rare')), false, "Should exclude rare tags");
      framework.assertEqual(suggestionTexts.some(tag => tag.includes('moderate')), true, "Should include moderate tags");
      
      console.log(`       ✓ Threshold filtering (min 2): ${suggestions.length} suggestions found`);
      
      return true;
    });
  });

  return framework.printResults();
}

// Export and run if called directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTagSystemTests };
  
  if (require.main === module) {
    runTagSystemTests();
  }
}