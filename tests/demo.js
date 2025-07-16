#!/usr/bin/env node

/**
 * Demo script showing how to use the extracted tag handling modules
 */

const TagParser = require('../app/lib/faveday/tag-parser');
const TagCacheBuilder = require('../app/lib/faveday/tag-cache');

console.log('🏷️  FaveDay Tag System Demo\n');

// Sample data
const sampleScores = [
  {
    date: new Date('2023-01-15'),
    summary: 4,
    notes: 'Great day working on #coding with @alice. Made progress on #javascript project.'
  },
  {
    date: new Date('2023-02-20'),
    summary: 5,
    notes: 'Amazing session! @alice helped with #coding again. Love #javascript development.'
  },
  {
    date: new Date('2023-03-10'),
    summary: 3,
    notes: 'Regular day. Some #coding work and brief chat with @bob about #webdev.'
  },
  {
    date: new Date('2024-01-05'),
    summary: 4,
    notes: 'New year, new #coding challenges! Working with @alice on #react project.'
  }
];

// Initialize components
const parser = new TagParser();
const cacheBuilder = new TagCacheBuilder();

console.log('1️⃣  Tag Parsing Examples:');
console.log('========================');

const testText = 'Working on #javascript with @johnSmith today. Also learning #webDev!';
console.log(`Text: "${testText}"`);

const tags = parser.extractTags(testText);
console.log('\nExtracted tags:');
tags.forEach(tag => {
  console.log(`  ${tag.full} (${tag.marker === '@' ? 'person' : 'topic'}) at position ${tag.start}-${tag.end}`);
});

console.log('\n2️⃣  Tag Cache Building:');
console.log('=======================');

const cache = cacheBuilder.calculateTagCache(sampleScores);
console.log(`Built cache with ${Object.keys(cache).length} unique tags\n`);

// Show cache stats for each tag
Object.keys(cache).forEach(tagName => {
  const tag = cache[tagName];
  console.log(`${tag.isPerson ? '👤' : '🏷️'} ${tag.originalName}:`);
  console.log(`   Uses: ${tag.totalUses}, Avg Score: ${tag.avgScore.toFixed(1)}`);
  console.log(`   Peak: ${tag.peakYear} (${tag.peakYearCount} uses)`);
  console.log(`   Years: ${Object.keys(tag.yearStats).join(', ')}`);
  console.log('');
});

console.log('3️⃣  Tag Sorting Examples:');
console.log('=========================');

const sortedByCount = cacheBuilder.sortTags(cache, 'count').slice(0, 3);
console.log('Top 3 by usage count:');
sortedByCount.forEach((tag, i) => {
  console.log(`  ${i + 1}. ${tag.originalName} (${tag.totalUses} uses)`);
});

const sortedByScore = cacheBuilder.sortTags(cache, 'avgScore').slice(0, 3);
console.log('\nTop 3 by average score:');
sortedByScore.forEach((tag, i) => {
  console.log(`  ${i + 1}. ${tag.originalName} (${tag.avgScore.toFixed(1)} avg)`);
});

console.log('\n4️⃣  Suggestion Engine Example:');
console.log('==============================');

const suggestionText = 'Had coffee with Alice and worked on some javascript';
console.log(`Text: "${suggestionText}"`);

const existingTags = parser.extractTags(suggestionText);
console.log(`Existing tags: ${existingTags.map(t => t.full).join(', ') || 'none'}`);

const personSuggestions = parser.findPersonSuggestions(suggestionText, existingTags, cache, 2, 2);
const topicSuggestions = parser.findTopicSuggestions(suggestionText, existingTags, cache, 2, 2);

console.log('\nSuggestions:');
personSuggestions.forEach(s => {
  console.log(`  👤 "${s.text}" → ${s.suggestedTag}`);
});
topicSuggestions.forEach(s => {
  console.log(`  🏷️ "${s.text}" → ${s.suggestedTag}`);
});

console.log('\n✨ Demo complete! Run `node test-runner.js` to see the full test suite.');