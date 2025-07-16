/**
 * Tag parsing utilities shared between app and tests
 * Extracted from faveday.js for reusability
 */

class TagParser {
  constructor() {
    // Tag detection regex from faveday.js:31
    this.tagRegex = /([#@])\p{L}[\p{L}\d]*/gui;
  }

  /**
   * Extract all tags from text
   * @param {string} text - Text to parse for tags
   * @returns {Array} Array of tag objects with marker, word, position info
   */
  extractTags(text) {
    const tags = [];
    const regex = new RegExp(this.tagRegex);
    let match;

    while ((match = regex.exec(text)) !== null) {
      tags.push({
        full: match[0],           // Full tag like "#coding" or "@john"
        marker: match[1],         // "#" or "@"
        word: match[0].slice(1),  // Tag without marker
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return tags;
  }

  /**
   * Determine if a tag is a person tag
   * @param {Object} tag - Tag object with marker property
   * @returns {boolean}
   */
  isPersonTag(tag) {
    return tag.marker === '@';
  }

  /**
   * Convert camelCase to spaced text with smart handling of common tech terms
   * @param {string} str - CamelCase string
   * @returns {string} Spaced string
   */
  camelCaseToSpace(str) {
    // Handle common tech terms and brand names that should stay intact
    const techTerms = [
      'iPhone', 'iPad', 'iOS', 'macOS', 'watchOS', 'tvOS',
      'jMemorize', 'eBay', 'eCommerce', 'eMail', 'iCal', 'iCloud',
      'JavaScript', 'TypeScript', 'GitHub', 'GitLab'
    ];
    
    // Check if the entire string is a known tech term
    if (techTerms.includes(str)) {
      return str;
    }
    
    // Apply spacing rules but preserve single letter prefixes when they're likely tech terms
    let result = str;
    
    // First, handle the common pattern of single letter + Capital word at start
    // Only split if it's clearly not a tech term pattern
    result = result.replace(/^([a-z])([A-Z][a-z]+)/g, (match, prefix, suffix) => {
      // Common tech prefixes that should be preserved
      const techPrefixes = ['i', 'e', 'j', 'm', 'u', 'n', 'v', 'x'];
      
      // If it's a tech prefix OR the whole word is short, preserve it
      if (techPrefixes.includes(prefix) || match.length <= 6) {
        return match; // Keep as is
      }
      
      // Otherwise, split it
      return `${prefix} ${suffix}`;
    });
    
    // Handle sequences of capitals followed by lowercase (XMLHttpRequest -> XML Http Request)
    result = result.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    
    // Handle lowercase followed by uppercase, but not at word boundaries we've preserved
    result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    return result;
  }

  /**
   * Get first name from person tag
   * @param {string} word - Full name from tag
   * @returns {string} First name only
   */
  getFirstName(word) {
    return word.split(/(?=[A-Z])/)[0];
  }

  /**
   * Check if suggestion overlaps with existing tags
   * @param {number} suggestionStart - Start position of suggestion
   * @param {number} suggestionEnd - End position of suggestion  
   * @param {Array} existingTags - Array of existing tag objects
   * @returns {boolean}
   */
  checkOverlap(suggestionStart, suggestionEnd, existingTags) {
    return existingTags.some(tag => 
      (suggestionStart >= tag.start && suggestionStart < tag.end) ||
      (suggestionEnd > tag.start && suggestionEnd <= tag.end)
    );
  }

  /**
   * Create word matching regex for suggestions
   * @param {string} word - Word to match
   * @returns {RegExp}
   */
  createWordRegex(word) {
    return new RegExp(`\\b(${word})\\b(?![\\w@#])`, 'i');
  }

  /**
   * Find person suggestions in text based on cache
   * @param {string} rawText - Text to analyze
   * @param {Array} existingTags - Existing tags in text
   * @param {Object} tagCache - Tag cache with person tags
   * @param {number} minUses - Minimum uses for suggestion
   * @param {number} minWordLength - Minimum word length
   * @returns {Array} Array of suggestion objects
   */
  findPersonSuggestions(rawText, existingTags, tagCache, minUses = 3, minWordLength = 2, suggestedWords = new Set()) {
    const suggestions = [];
    
    const personTags = Object.keys(tagCache).filter(tag => 
      tagCache[tag].isPerson && tagCache[tag].totalUses >= minUses
    );
    
    personTags.forEach(tagKey => {
      const tagData = tagCache[tagKey];
      const fullName = tagData.originalName || tagKey;
      const firstName = fullName.split(/(?=[A-Z])/)[0];
      
      if (firstName.length > minWordLength && !suggestedWords.has(firstName.toLowerCase())) {
        const nameMatch = this.createWordRegex(firstName).exec(rawText);
        
        if (nameMatch && !this.checkOverlap(nameMatch.index, nameMatch.index + nameMatch[0].length, existingTags)) {
          suggestions.push({
            text: nameMatch[0],
            start: nameMatch.index,
            end: nameMatch.index + nameMatch[0].length,
            suggestedTag: `@${fullName}`,
            firstName: firstName,
            type: 'person'
          });
          // Add both the firstName and the actual matched text to prevent overlaps
          suggestedWords.add(firstName.toLowerCase());
          suggestedWords.add(nameMatch[0].toLowerCase());
        }
      }
    });
    
    return suggestions;
  }

  /**
   * Find topic suggestions in text based on cache
   * @param {string} rawText - Text to analyze
   * @param {Array} existingTags - Existing tags in text
   * @param {Object} tagCache - Tag cache with topic tags
   * @param {number} minUses - Minimum uses for suggestion
   * @param {number} minWordLength - Minimum word length
   * @returns {Array} Array of suggestion objects
   */
  findTopicSuggestions(rawText, existingTags, tagCache, minUses = 3, minWordLength = 2, suggestedWords = new Set()) {
    const suggestions = [];
    
    const topicTags = Object.keys(tagCache).filter(tag => 
      !tagCache[tag].isPerson && tagCache[tag].totalUses >= minUses
    );
    
    topicTags.forEach(tagKey => {
      const tagData = tagCache[tagKey];
      const fullName = tagData.originalName || tagKey;
      const searchWords = [];
      
      // Add the full tag name (lowercase)
      searchWords.push(fullName.toLowerCase());
      
      // Add camelCase parts if applicable, but only significant ones
      if (/[A-Z]/.test(fullName)) {
        const parts = fullName.split(/(?=[A-Z])/).filter(part => part.length > minWordLength);
        
        // Only suggest camelCase parts that are significant relative to the full tag
        const significantParts = parts.filter(part => {
          // Keep first part (main concept) or parts that are at least 50% of total length
          const isFirstPart = parts.indexOf(part) === 0;
          const isSignificantLength = part.length >= fullName.length * 0.5;
          return isFirstPart || isSignificantLength;
        });
        
        searchWords.push(...significantParts.map(part => part.toLowerCase()));
      }
      
      // Try to match each search word
      for (const searchWord of searchWords) {
        if (searchWord.length > minWordLength && !suggestedWords.has(searchWord)) {
          const wordMatch = this.createWordRegex(searchWord).exec(rawText);
          
          if (wordMatch && !this.checkOverlap(wordMatch.index, wordMatch.index + wordMatch[0].length, existingTags)) {
            suggestions.push({
              text: wordMatch[0],
              start: wordMatch.index,
              end: wordMatch.index + wordMatch[0].length,
              suggestedTag: `#${fullName}`,
              type: 'topic'
            });
            suggestedWords.add(searchWord);
            break; // Only suggest once per tag
          }
        }
      }
    });
    
    return suggestions;
  }
}

// Export for both Node.js (tests) and browser (app)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagParser;
} else {
  window.TagParser = TagParser;
}