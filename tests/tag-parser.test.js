const TagParser = require('../app/lib/faveday/tag-parser');

describe('Tag Parser Tests', () => {
  const parser = new TagParser();

  describe('Basic Tag Extraction', () => {
    it('should extract hashtag topics from text', () => {
      const text = 'Today I worked on #coding and #webdev projects';
      const tags = parser.extractTags(text);
      
      assert.strictEqual(tags.length, 2);
      assert.strictEqual(tags[0].full, '#coding');
      assert.strictEqual(tags[0].marker, '#');
      assert.strictEqual(tags[0].word, 'coding');
      assert.strictEqual(tags[1].full, '#webdev');
      assert.strictEqual(tags[1].marker, '#');
      assert.strictEqual(tags[1].word, 'webdev');
    });

    it('should extract person tags from text', () => {
      const text = 'Had lunch with @john and @marySue today';
      const tags = parser.extractTags(text);
      
      assert.strictEqual(tags.length, 2);
      assert.strictEqual(tags[0].full, '@john');
      assert.strictEqual(tags[0].marker, '@');
      assert.strictEqual(tags[0].word, 'john');
      assert.strictEqual(tags[1].full, '@marySue');
      assert.strictEqual(tags[1].marker, '@');
      assert.strictEqual(tags[1].word, 'marySue');
    });

    it('should handle mixed tags in text', () => {
      const text = 'Working on #project with @alice on #javascript';
      const tags = parser.extractTags(text);
      
      assert.strictEqual(tags.length, 3);
      assert.strictEqual(tags[0].full, '#project');
      assert.strictEqual(tags[1].full, '@alice');
      assert.strictEqual(tags[2].full, '#javascript');
    });

    it('should handle unicode characters in tags', () => {
      const text = 'Meeting about #café and @naïve planning';
      const tags = parser.extractTags(text);
      
      assert.strictEqual(tags.length, 2);
      assert.strictEqual(tags[0].word, 'café');
      assert.strictEqual(tags[1].word, 'naïve');
    });

    it('should track tag positions correctly', () => {
      const text = 'Start #tag1 middle @person end';
      const tags = parser.extractTags(text);
      
      assert.strictEqual(tags[0].start, 6);
      assert.strictEqual(tags[0].end, 11);
      assert.strictEqual(tags[1].start, 19);
      assert.strictEqual(tags[1].end, 26);
    });
  });

  describe('Tag Classification', () => {
    it('should identify person tags correctly', () => {
      const personTag = { marker: '@', word: 'john' };
      const topicTag = { marker: '#', word: 'coding' };
      
      assert.strictEqual(parser.isPersonTag(personTag), true);
      assert.strictEqual(parser.isPersonTag(topicTag), false);
    });
  });

  describe('CamelCase Conversion', () => {
    it('should convert simple camelCase to spaces', () => {
      assert.strictEqual(parser.camelCaseToSpace('callOfDuty'), 'call Of Duty');
      assert.strictEqual(parser.camelCaseToSpace('javaScript'), 'java Script');
    });

    it('should handle sequences of capitals', () => {
      assert.strictEqual(parser.camelCaseToSpace('XMLHttpRequest'), 'XML Http Request');
      assert.strictEqual(parser.camelCaseToSpace('HTMLParser'), 'HTML Parser');
    });

    it('should handle mixed case sequences', () => {
      assert.strictEqual(parser.camelCaseToSpace('CallOfTheCovenant'), 'Call Of The Covenant');
    });

    it('should handle single words without change', () => {
      assert.strictEqual(parser.camelCaseToSpace('coding'), 'coding');
      assert.strictEqual(parser.camelCaseToSpace('CODING'), 'CODING');
    });

    it('should preserve common tech terms and brand names', () => {
      // Single letter prefixes that are common in tech
      assert.strictEqual(parser.camelCaseToSpace('iPhone'), 'iPhone');
      assert.strictEqual(parser.camelCaseToSpace('iPad'), 'iPad');
      assert.strictEqual(parser.camelCaseToSpace('iOS'), 'iOS');
      assert.strictEqual(parser.camelCaseToSpace('macOS'), 'macOS');
      
      // Software and app names
      assert.strictEqual(parser.camelCaseToSpace('jMemorize'), 'jMemorize');
      assert.strictEqual(parser.camelCaseToSpace('eBay'), 'eBay');
      assert.strictEqual(parser.camelCaseToSpace('eCommerce'), 'eCommerce');
      
      // But still split longer sequences
      assert.strictEqual(parser.camelCaseToSpace('myPhoneApp'), 'my Phone App');
      assert.strictEqual(parser.camelCaseToSpace('theIphoneStory'), 'the Iphone Story');
    });

    it('should handle edge cases with single letter prefixes', () => {
      // Single letter at start should usually be preserved
      assert.strictEqual(parser.camelCaseToSpace('iCal'), 'iCal');
      assert.strictEqual(parser.camelCaseToSpace('eMail'), 'eMail');
      
      // But not when it's clearly a word boundary
      assert.strictEqual(parser.camelCaseToSpace('myApp'), 'my App');
      assert.strictEqual(parser.camelCaseToSpace('anIphone'), 'an Iphone');
    });
  });

  describe('First Name Extraction', () => {
    it('should extract first name from camelCase names', () => {
      assert.strictEqual(parser.getFirstName('johnSmith'), 'john');
      assert.strictEqual(parser.getFirstName('marySue'), 'mary');
      assert.strictEqual(parser.getFirstName('bobJohnson'), 'bob');
    });

    it('should handle single names', () => {
      assert.strictEqual(parser.getFirstName('alice'), 'alice');
      assert.strictEqual(parser.getFirstName('Bob'), 'Bob');
    });
  });

  describe('Overlap Detection', () => {
    it('should detect overlap with existing tags', () => {
      const existingTags = [
        { start: 10, end: 17 }, // positions 10-16
        { start: 25, end: 30 }  // positions 25-29
      ];
      
      // Test various overlap scenarios
      assert.strictEqual(parser.checkOverlap(5, 8, existingTags), false);   // Before first tag
      assert.strictEqual(parser.checkOverlap(8, 12, existingTags), true);   // Overlaps start of first tag
      assert.strictEqual(parser.checkOverlap(12, 16, existingTags), true);  // Inside first tag
      assert.strictEqual(parser.checkOverlap(15, 20, existingTags), true);  // Overlaps end of first tag
      assert.strictEqual(parser.checkOverlap(18, 24, existingTags), false); // Between tags
      assert.strictEqual(parser.checkOverlap(27, 32, existingTags), true);  // Overlaps second tag
      assert.strictEqual(parser.checkOverlap(32, 35, existingTags), false); // After last tag
    });
  });

  describe('Word Regex Creation', () => {
    it('should create word boundary regex', () => {
      const regex = parser.createWordRegex('test');
      
      assert.strictEqual(regex.test('test word'), true);
      assert.strictEqual(regex.test('word test'), true);
      assert.strictEqual(regex.test('testing'), false);
      assert.strictEqual(regex.test('contest'), false);
      // The regex uses negative lookahead to avoid matching when followed by word chars or # @
      assert.strictEqual(regex.test('test#'), false);  
      assert.strictEqual(regex.test('test@'), false);
    });

    it('should be case insensitive', () => {
      const regex = parser.createWordRegex('Test');
      
      assert.strictEqual(regex.test('test word'), true);
      assert.strictEqual(regex.test('TEST word'), true);
      assert.strictEqual(regex.test('Test word'), true);
    });
  });

  describe('Person Suggestions', () => {
    const mockTagCache = {
      'johnsmith': {
        isPerson: true,
        totalUses: 5,
        originalName: 'johnSmith'
      },
      'alice': {
        isPerson: true,
        totalUses: 3,
        originalName: 'alice'
      },
      'bob': {
        isPerson: true,
        totalUses: 1, // Below threshold
        originalName: 'bob'
      },
      'coding': {
        isPerson: false,
        totalUses: 10,
        originalName: 'coding'
      }
    };

    it('should find person suggestions based on first names', () => {
      const text = 'Had coffee with John and Alice today';
      const existingTags = [];
      
      const suggestions = parser.findPersonSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      assert.strictEqual(suggestions.length, 2);
      
      const johnSuggestion = suggestions.find(s => s.firstName === 'john');
      assert.strictEqual(johnSuggestion.text, 'John');
      assert.strictEqual(johnSuggestion.suggestedTag, '@johnSmith');
      assert.strictEqual(johnSuggestion.type, 'person');
      
      const aliceSuggestion = suggestions.find(s => s.firstName === 'alice');
      assert.strictEqual(aliceSuggestion.text, 'Alice');
      assert.strictEqual(aliceSuggestion.suggestedTag, '@alice');
    });

    it('should respect minimum usage threshold', () => {
      const text = 'Saw Bob yesterday';
      const existingTags = [];
      
      const suggestions = parser.findPersonSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Bob should not be suggested (only 1 use, below threshold of 3)
      assert.strictEqual(suggestions.length, 0);
    });

    it('should not suggest overlapping with existing tags', () => {
      const text = 'Meeting with John about project';
      const existingTags = [{ start: 13, end: 17 }]; // "John" is already tagged
      
      const suggestions = parser.findPersonSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      assert.strictEqual(suggestions.length, 0);
    });

    it('should not suggest duplicate words', () => {
      const text = 'John called John about John';
      const existingTags = [];
      
      const suggestions = parser.findPersonSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Should only suggest once even though "John" appears multiple times
      assert.strictEqual(suggestions.length, 1);
    });

    it('should only suggest the first occurrence of a word', () => {
      const text = 'Alice helped alice with more alice work';
      const existingTags = [];
      
      const suggestions = parser.findPersonSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Should only suggest the first occurrence
      assert.strictEqual(suggestions.length, 1);
      assert.strictEqual(suggestions[0].text, 'Alice');
      assert.strictEqual(suggestions[0].start, 0);
      assert.strictEqual(suggestions[0].end, 5);
    });

    it('should share suggested words set between person and topic suggestions', () => {
      const mockCacheWithSharedWords = {
        'michael': {
          isPerson: true,
          totalUses: 5,
          originalName: 'Michael'
        },
        'programming': {
          isPerson: false,
          totalUses: 8,
          originalName: 'programming'
        }
      };
      
      const text = 'Michael enjoys programming and Michael coding';
      const existingTags = [];
      const sharedSuggestedWords = new Set();
      
      // Test person suggestions first
      const personSuggestions = parser.findPersonSuggestions(text, existingTags, mockCacheWithSharedWords, 3, 2, sharedSuggestedWords);
      
      // Should suggest only the first occurrence of "Michael"
      assert.strictEqual(personSuggestions.length, 1);
      assert.strictEqual(personSuggestions[0].text, 'Michael');
      assert.strictEqual(personSuggestions[0].start, 0);
      
      // Then test topic suggestions with the same shared set
      const topicSuggestions = parser.findTopicSuggestions(text, existingTags, mockCacheWithSharedWords, 3, 2, sharedSuggestedWords);
      
      // Should suggest programming once, and "Michael" should be blocked for topic suggestions
      assert.strictEqual(topicSuggestions.length, 1);
      assert.strictEqual(topicSuggestions[0].text, 'programming');
      
      // Verify "Michael" is in the shared set and blocked for future suggestions
      assert.strictEqual(sharedSuggestedWords.has('michael'), true);
    });

    it('should handle the Michael Jackson scenario without duplicates', () => {
      const mockCacheWithMichaelJackson = {
        'michael': {
          isPerson: true,
          totalUses: 5,
          originalName: 'Michael'
        },
        'jackson': {
          isPerson: false,
          totalUses: 4,
          originalName: 'Jackson'
        }
      };
      
      const text = 'Michael Jackson was a great performer';
      const existingTags = [];
      const sharedSuggestedWords = new Set();
      
      // Test person suggestions first
      const personSuggestions = parser.findPersonSuggestions(text, existingTags, mockCacheWithMichaelJackson, 3, 2, sharedSuggestedWords);
      
      // Should suggest "Michael" -> @Michael
      assert.strictEqual(personSuggestions.length, 1);
      assert.strictEqual(personSuggestions[0].text, 'Michael');
      assert.strictEqual(personSuggestions[0].suggestedTag, '@Michael');
      
      // Then test topic suggestions with the same shared set
      const topicSuggestions = parser.findTopicSuggestions(text, existingTags, mockCacheWithMichaelJackson, 3, 2, sharedSuggestedWords);
      
      // Should suggest "Jackson" -> #Jackson since it's not blocked
      assert.strictEqual(topicSuggestions.length, 1);
      assert.strictEqual(topicSuggestions[0].text, 'Jackson');
      assert.strictEqual(topicSuggestions[0].suggestedTag, '#Jackson');
      
      // This is the expected behavior - both can be suggested since they're different words
      // The key is that the same word (like "Michael") won't be suggested twice
    });
  });

  describe('Topic Suggestions', () => {
    const mockTagCache = {
      'javascript': {
        isPerson: false,
        totalUses: 15,
        originalName: 'javaScript'
      },
      'webdevelopment': {
        isPerson: false,
        totalUses: 8,
        originalName: 'webDevelopment'
      },
      'coding': {
        isPerson: false,
        totalUses: 2, // Below threshold
        originalName: 'coding'
      },
      'alice': {
        isPerson: true,
        totalUses: 10,
        originalName: 'alice'
      }
    };

    it('should find topic suggestions based on full names', () => {
      const text = 'Learning javascript and web development today';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Should find javascript and web (from webDevelopment)
      assert.strictEqual(suggestions.length, 2);
      
      const jsSuggestion = suggestions.find(s => s.text === 'javascript');
      assert.strictEqual(jsSuggestion.suggestedTag, '#javaScript');
      assert.strictEqual(jsSuggestion.type, 'topic');
      
      const webSuggestion = suggestions.find(s => s.text === 'web');
      assert.strictEqual(webSuggestion.suggestedTag, '#webDevelopment');
    });

    it('should find suggestions based on camelCase parts', () => {
      const text = 'Working on web stuff and development tasks';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Should find "web" first (since it matches first and only suggests once per tag)
      const webSuggestion = suggestions.find(s => s.text === 'web');
      
      assert(webSuggestion);
      assert.strictEqual(webSuggestion.suggestedTag, '#webDevelopment');
      
      // Only one suggestion per tag, so development won't be suggested separately
      const devSuggestion = suggestions.find(s => s.text === 'development');
      assert.strictEqual(devSuggestion, undefined);
    });

    it('should respect minimum usage threshold', () => {
      const text = 'Did some coding today';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Coding should not be suggested (only 2 uses, below threshold of 3)
      assert.strictEqual(suggestions.length, 0);
    });

    it('should not suggest person tags', () => {
      const text = 'Alice helped with the project';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Alice should not be suggested as a topic (it's a person tag)
      assert.strictEqual(suggestions.length, 0);
    });

    it('should only suggest once per tag', () => {
      const text = 'javascript and script and java development';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Should only suggest javascript once, even though multiple parts match
      const jsSuggestions = suggestions.filter(s => s.suggestedTag === '#javaScript');
      assert.strictEqual(jsSuggestions.length, 1);
    });

    it('should only suggest the first occurrence of a word', () => {
      const text = 'javascript code and more javascript work with javascript libraries';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockTagCache, 3, 2);
      
      // Should only suggest the first occurrence
      assert.strictEqual(suggestions.length, 1);
      assert.strictEqual(suggestions[0].text, 'javascript');
      assert.strictEqual(suggestions[0].start, 0);
      assert.strictEqual(suggestions[0].end, 10);
    });

    it('should not suggest insignificant camelCase parts', () => {
      const mockCacheWithLongTags = {
        'godofwar': {
          isPerson: false,
          totalUses: 10,
          originalName: 'GodOfWar'
        },
        'callofduty': {
          isPerson: false,
          totalUses: 8,
          originalName: 'CallOfDuty'
        }
      };
      
      const text = 'Playing war games and duty calls today';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockCacheWithLongTags, 3, 2);
      
      // Should not suggest "war" -> #GodOfWar or "duty" -> #CallOfDuty
      // because these are insignificant parts (< 50% of full tag length)
      assert.strictEqual(suggestions.length, 0);
    });

    it('should suggest significant camelCase parts', () => {
      const mockCacheWithSignificantParts = {
        'javascript': {
          isPerson: false,
          totalUses: 10,
          originalName: 'javaScript'
        },
        'webdev': {
          isPerson: false,
          totalUses: 8,
          originalName: 'webDev'
        }
      };
      
      const text = 'Learning java and web programming today';
      const existingTags = [];
      
      const suggestions = parser.findTopicSuggestions(text, existingTags, mockCacheWithSignificantParts, 3, 2);
      
      // Should suggest "java" -> #javaScript (first part) and "web" -> #webDev (50%+ of length)
      assert.strictEqual(suggestions.length, 2);
      
      const javaSuggestion = suggestions.find(s => s.text === 'java');
      assert.strictEqual(javaSuggestion.suggestedTag, '#javaScript');
      
      const webSuggestion = suggestions.find(s => s.text === 'web');
      assert.strictEqual(webSuggestion.suggestedTag, '#webDev');
    });
  });

  describe('First Occurrence Behavior', () => {
    it('should handle regex replacement for first occurrence only', () => {
      // Test the regex pattern used in convertToTag
      const text = 'Alice helped alice with more alice work';
      const originalText = 'alice';
      const newTag = '@alice';
      
      // This mimics the logic in convertToTag - without 'g' flag
      const result = text.replace(new RegExp(`\\b${originalText}\\b`), newTag);
      
      // Should only replace the first occurrence
      assert.strictEqual(result, 'Alice helped @alice with more alice work');
    });

    it('should handle case-insensitive replacement correctly', () => {
      // Test with different cases
      const text = 'JavaScript and javascript and more JavaScript';
      const originalText = 'javascript';
      const newTag = '#javascript';
      
      // Case-insensitive replacement of first occurrence
      const result = text.replace(new RegExp(`\\b${originalText}\\b`, 'i'), newTag);
      
      // Should replace the first match (case-insensitive)
      assert.strictEqual(result, '#javascript and javascript and more JavaScript');
    });
  });
});