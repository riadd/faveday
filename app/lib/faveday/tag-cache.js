/**
 * Tag cache utilities shared between app and tests
 * Extracted from main.js for reusability
 */

class TagCacheBuilder {
  constructor() {
    this.tagRegex = /[#@]\p{L}+/gui;
  }

  /**
   * Calculate tag cache from scores data
   * @param {Array} scores - Array of score objects with date, summary, notes
   * @returns {Object} Tag cache object
   */
  calculateTagCache(scores) {
    const tagStats = {};
    const currentYear = new Date().getFullYear();
    
    // Extract and analyze all tags
    for (const score of scores) {
      const tags = score.notes.match(this.tagRegex) || [];
      const year = score.date.getFullYear();
      
      for (const rawTag of tags) {
        const isPersonTag = rawTag.startsWith('@');
        const tagName = rawTag.slice(1).toLowerCase();
        const originalName = rawTag.slice(1); // Preserve original casing
        
        if (!tagStats[tagName]) {
          tagStats[tagName] = {
            name: tagName,
            originalName: originalName,
            totalUses: 0,
            scores: [],
            yearStats: {},
            hasPersonUsage: false,
            recentActivity: false,
            firstUsage: null,
            lastUsage: null
          };
        }
        
        const tag = tagStats[tagName];
        tag.totalUses++;
        tag.scores.push(score.summary);
        tag.hasPersonUsage = tag.hasPersonUsage || isPersonTag;
        tag.recentActivity = tag.recentActivity || (year >= currentYear - 1);
        
        // Track first and last usage dates
        const scoreDate = score.date;
        if (!tag.firstUsage || scoreDate < tag.firstUsage) {
          tag.firstUsage = scoreDate;
        }
        if (!tag.lastUsage || scoreDate > tag.lastUsage) {
          tag.lastUsage = scoreDate;
        }
        
        // Track usage by year
        if (!tag.yearStats[year]) {
          tag.yearStats[year] = 0;
        }
        tag.yearStats[year]++;
      }
    }
    
    // Calculate derived statistics
    for (const tag of Object.values(tagStats)) {
      tag.totalScore = tag.scores.length > 0 ? tag.scores.reduce((a, b) => a + b, 0) : 0;
      tag.avgScore = tag.scores.length > 0 ? tag.totalScore / tag.scores.length : 0;
      
      // Find peak year
      let maxYear = null;
      let maxCount = 0;
      for (const [year, count] of Object.entries(tag.yearStats)) {
        if (count > maxCount) {
          maxCount = count;
          maxYear = year;
        }
      }
      tag.peakYear = maxYear;
      tag.peakYearCount = maxCount;
      
      // Determine if it's likely a person tag
      tag.isPerson = tag.hasPersonUsage;
      
      // Clean up scores array to save space
      delete tag.scores;
    }
    
    return tagStats;
  }

  /**
   * Get tag statistics for a specific tag
   * @param {Object} tagCache - Full tag cache
   * @param {string} tagName - Tag name to lookup
   * @returns {Object|null} Tag statistics or null if not found
   */
  getTagStats(tagCache, tagName) {
    return tagCache[tagName.toLowerCase()] || null;
  }

  /**
   * Get all person tags from cache
   * @param {Object} tagCache - Full tag cache
   * @param {number} minUses - Minimum usage count
   * @returns {Array} Array of person tag names
   */
  getPersonTags(tagCache, minUses = 1) {
    return Object.keys(tagCache).filter(tag => 
      tagCache[tag].isPerson && tagCache[tag].totalUses >= minUses
    );
  }

  /**
   * Get all topic tags from cache
   * @param {Object} tagCache - Full tag cache
   * @param {number} minUses - Minimum usage count
   * @returns {Array} Array of topic tag names
   */
  getTopicTags(tagCache, minUses = 1) {
    return Object.keys(tagCache).filter(tag => 
      !tagCache[tag].isPerson && tagCache[tag].totalUses >= minUses
    );
  }

  /**
   * Get tags with recent activity
   * @param {Object} tagCache - Full tag cache
   * @returns {Array} Array of recently active tag names
   */
  getRecentTags(tagCache) {
    return Object.keys(tagCache).filter(tag => tagCache[tag].recentActivity);
  }

  /**
   * Sort tags by criteria
   * @param {Object} tagCache - Full tag cache
   * @param {string} sortBy - Sort criteria: 'count', 'avgScore', 'firstUsage', 'lastUsage'
   * @returns {Array} Sorted array of tag objects
   */
  sortTags(tagCache, sortBy = 'count') {
    const tags = Object.keys(tagCache).map(tagName => ({
      name: tagName,
      ...tagCache[tagName]
    }));

    switch (sortBy) {
      case 'avgScore':
        return tags.sort((a, b) => b.avgScore - a.avgScore);
      case 'firstUsage':
        return tags.sort((a, b) => {
          if (!a.firstUsage && !b.firstUsage) return 0;
          if (!a.firstUsage) return 1;
          if (!b.firstUsage) return -1;
          return a.firstUsage - b.firstUsage;
        });
      case 'lastUsage':
        return tags.sort((a, b) => {
          if (!a.lastUsage && !b.lastUsage) return 0;
          if (!a.lastUsage) return 1;
          if (!b.lastUsage) return -1;
          return b.lastUsage - a.lastUsage;
        });
      case 'count':
      default:
        return tags.sort((a, b) => b.totalUses - a.totalUses);
    }
  }
}

// Export for both Node.js (tests) and browser (app)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagCacheBuilder;
} else {
  window.TagCacheBuilder = TagCacheBuilder;
}