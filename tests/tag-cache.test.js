const TagCacheBuilder = require('../app/lib/faveday/tag-cache');

describe('Tag Cache Tests', () => {
  const cacheBuilder = new TagCacheBuilder();

  // Sample test data
  const createMockScores = () => [
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
    },
    {
      date: new Date('2024-02-14'),
      summary: 2,
      notes: 'Struggled with #react today. @bob suggested taking a break.'
    }
  ];

  describe('Tag Cache Calculation', () => {
    it('should calculate basic tag statistics', () => {
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);

      // Check that basic tags are present
      assert(cache.coding);
      assert(cache.alice);
      assert(cache.javascript);
      assert(cache.bob);

      // Check usage counts
      assert.strictEqual(cache.coding.totalUses, 4);
      assert.strictEqual(cache.alice.totalUses, 3);
      assert.strictEqual(cache.javascript.totalUses, 2);
      assert.strictEqual(cache.bob.totalUses, 2);
    });

    it('should calculate average scores correctly', () => {
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);

      // alice appears in scores: 4, 5, 4 -> average = 4.33
      assert.strictEqual(Math.round(cache.alice.avgScore * 100) / 100, 4.33);
      
      // coding appears in scores: 4, 5, 3, 4 -> average = 4.0
      assert.strictEqual(cache.coding.avgScore, 4.0);
      
      // bob appears in scores: 3, 2 -> average = 2.5
      assert.strictEqual(cache.bob.avgScore, 2.5);
    });

    it('should preserve original tag casing', () => {
      const scores = [
        {
          date: new Date('2023-01-01'),
          summary: 4,
          notes: 'Working on #javaScript with @johnSmith'
        }
      ];
      
      const cache = cacheBuilder.calculateTagCache(scores);
      
      assert.strictEqual(cache.javascript.originalName, 'javaScript');
      assert.strictEqual(cache.johnsmith.originalName, 'johnSmith');
    });

    it('should identify person vs topic tags correctly', () => {
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);

      assert.strictEqual(cache.alice.isPerson, true);
      assert.strictEqual(cache.bob.isPerson, true);
      assert.strictEqual(cache.coding.isPerson, false);
      assert.strictEqual(cache.javascript.isPerson, false);
    });

    it('should calculate year statistics', () => {
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);

      // alice: 2 uses in 2023, 1 use in 2024
      assert.strictEqual(cache.alice.yearStats['2023'], 2);
      assert.strictEqual(cache.alice.yearStats['2024'], 1);
      
      // coding: 3 uses in 2023, 1 use in 2024
      assert.strictEqual(cache.coding.yearStats['2023'], 3);
      assert.strictEqual(cache.coding.yearStats['2024'], 1);
    });

    it('should calculate peak year correctly', () => {
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);

      // alice: peak in 2023 with 2 uses
      assert.strictEqual(cache.alice.peakYear, '2023');
      assert.strictEqual(cache.alice.peakYearCount, 2);
      
      // coding: peak in 2023 with 3 uses
      assert.strictEqual(cache.coding.peakYear, '2023');
      assert.strictEqual(cache.coding.peakYearCount, 3);
    });

    it('should track first and last usage dates', () => {
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);

      // alice: first use Jan 15, 2023, last use Jan 5, 2024
      assert.strictEqual(cache.alice.firstUsage.toISOString().split('T')[0], '2023-01-15');
      assert.strictEqual(cache.alice.lastUsage.toISOString().split('T')[0], '2024-01-05');
      
      // react: first and last use in 2024
      assert.strictEqual(cache.react.firstUsage.toISOString().split('T')[0], '2024-01-05');
      assert.strictEqual(cache.react.lastUsage.toISOString().split('T')[0], '2024-02-14');
    });

    it('should mark recent activity correctly', () => {
      const scores = createMockScores();
      const cache = cacheBuilder.calculateTagCache(scores);
      
      // All tags should have recent activity since they were used in 2024 or 2023
      // (within current year - 1)
      assert.strictEqual(cache.alice.recentActivity, true);
      assert.strictEqual(cache.coding.recentActivity, true);
      assert.strictEqual(cache.react.recentActivity, true);
    });
  });

  describe('Tag Cache Queries', () => {
    let cache;
    
    beforeEach(() => {
      const scores = createMockScores();
      cache = cacheBuilder.calculateTagCache(scores);
    });

    it('should get tag statistics by name', () => {
      const aliceStats = cacheBuilder.getTagStats(cache, 'alice');
      assert(aliceStats);
      assert.strictEqual(aliceStats.totalUses, 3);
      assert.strictEqual(aliceStats.isPerson, true);
      
      const nonExistent = cacheBuilder.getTagStats(cache, 'nonexistent');
      assert.strictEqual(nonExistent, null);
    });

    it('should filter person tags', () => {
      const personTags = cacheBuilder.getPersonTags(cache, 1);
      
      assert.strictEqual(personTags.length, 2);
      assert(personTags.includes('alice'));
      assert(personTags.includes('bob'));
    });

    it('should filter topic tags', () => {
      const topicTags = cacheBuilder.getTopicTags(cache, 1);
      
      assert.strictEqual(topicTags.length, 4); // coding, javascript, webdev, react
      assert(topicTags.includes('coding'));
      assert(topicTags.includes('javascript'));
      assert(topicTags.includes('webdev'));
      assert(topicTags.includes('react'));
    });

    it('should filter by minimum usage count', () => {
      const frequentPersons = cacheBuilder.getPersonTags(cache, 3);
      const frequentTopics = cacheBuilder.getTopicTags(cache, 3);
      
      assert.strictEqual(frequentPersons.length, 1); // Only alice (3 uses)
      assert(frequentPersons.includes('alice'));
      
      assert.strictEqual(frequentTopics.length, 1); // Only coding (4 uses)
      assert(frequentTopics.includes('coding'));
    });

    it('should get recent tags', () => {
      const recentTags = cacheBuilder.getRecentTags(cache);
      
      // All tags should be recent in our test data
      assert(recentTags.length > 0);
      assert(recentTags.includes('alice'));
      assert(recentTags.includes('coding'));
    });
  });

  describe('Tag Sorting', () => {
    let cache;
    
    beforeEach(() => {
      const scores = createMockScores();
      cache = cacheBuilder.calculateTagCache(scores);
    });

    it('should sort by usage count (default)', () => {
      const sorted = cacheBuilder.sortTags(cache, 'count');
      
      // coding (4), alice (3), then others (2 each), then webdev (1)
      assert.strictEqual(sorted[0].name, 'coding');
      assert.strictEqual(sorted[0].totalUses, 4);
      assert.strictEqual(sorted[1].name, 'alice');
      assert.strictEqual(sorted[1].totalUses, 3);
    });

    it('should sort by average score', () => {
      const sorted = cacheBuilder.sortTags(cache, 'avgScore');
      
      // Should be sorted by avgScore descending
      for (let i = 0; i < sorted.length - 1; i++) {
        assert(sorted[i].avgScore >= sorted[i + 1].avgScore);
      }
    });

    it('should sort by first usage date', () => {
      const sorted = cacheBuilder.sortTags(cache, 'firstUsage');
      
      // Should be sorted by firstUsage ascending (oldest first)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].firstUsage && sorted[i + 1].firstUsage) {
          assert(sorted[i].firstUsage <= sorted[i + 1].firstUsage);
        }
      }
    });

    it('should sort by last usage date', () => {
      const sorted = cacheBuilder.sortTags(cache, 'lastUsage');
      
      // Should be sorted by lastUsage descending (newest first)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].lastUsage && sorted[i + 1].lastUsage) {
          assert(sorted[i].lastUsage >= sorted[i + 1].lastUsage);
        }
      }
    });

    it('should handle null dates in sorting', () => {
      // Create cache with some missing dates
      const incompleteCache = {
        tag1: { totalUses: 5, firstUsage: new Date('2023-01-01'), lastUsage: new Date('2023-12-01') },
        tag2: { totalUses: 3, firstUsage: null, lastUsage: null },
        tag3: { totalUses: 7, firstUsage: new Date('2023-06-01'), lastUsage: new Date('2023-11-01') }
      };
      
      const sortedByFirst = cacheBuilder.sortTags(incompleteCache, 'firstUsage');
      const sortedByLast = cacheBuilder.sortTags(incompleteCache, 'lastUsage');
      
      // Should not throw errors and should handle nulls gracefully
      assert.strictEqual(sortedByFirst.length, 3);
      assert.strictEqual(sortedByLast.length, 3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scores array', () => {
      const cache = cacheBuilder.calculateTagCache([]);
      assert.strictEqual(Object.keys(cache).length, 0);
    });

    it('should handle scores with no tags', () => {
      const scores = [
        {
          date: new Date('2023-01-01'),
          summary: 3,
          notes: 'Just a normal day with no tags at all'
        }
      ];
      
      const cache = cacheBuilder.calculateTagCache(scores);
      assert.strictEqual(Object.keys(cache).length, 0);
    });

    it('should handle malformed tags gracefully', () => {
      const scores = [
        {
          date: new Date('2023-01-01'),
          summary: 3,
          notes: 'Some # broken @tags and also #validTag here'
        }
      ];
      
      const cache = cacheBuilder.calculateTagCache(scores);
      
      // Should capture validTag and tags (@ followed by letters)
      assert.strictEqual(Object.keys(cache).length, 2);
      assert(cache.validtag);
      assert(cache.tags);
    });

    it('should handle case-insensitive tag deduplication', () => {
      const scores = [
        {
          date: new Date('2023-01-01'),
          summary: 3,
          notes: 'Working on #JavaScript today'
        },
        {
          date: new Date('2023-01-02'),
          summary: 4,
          notes: 'More #javascript development'
        },
        {
          date: new Date('2023-01-03'),
          summary: 5,
          notes: 'Finished the #JAVASCRIPT project'
        }
      ];
      
      const cache = cacheBuilder.calculateTagCache(scores);
      
      // Should be consolidated into one tag
      assert.strictEqual(Object.keys(cache).length, 1);
      assert(cache.javascript);
      assert.strictEqual(cache.javascript.totalUses, 3);
      
      // Should preserve first encountered casing
      assert.strictEqual(cache.javascript.originalName, 'JavaScript');
    });
  });
});