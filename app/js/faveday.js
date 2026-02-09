

  // Global score calculator instance
  const scoreCalculator = new ScoreCalculator();

  Score = class Score {
    constructor(date, summary, notes) {
      this.date = date;
      this.summary = summary;
      this.notes = notes;
    }

    dateId() {
      return this.date.format("{yyyy}-{MM}-{dd}");
    }
    
    dateStr() {
      return this.date.format("{d} {Mon} {yyyy}");
    }

    monthId() {
      return this.date.format("{yyyy}-{MM}");
    }
  
    weekday() {
      return this.date.format("{Weekday}");
    }
    
    empty() {
      return this.summary == null ? 'empty' : '';
    }
  
    text() {
      // replace search tags
      let re = /([#@])\p{L}[\p{L}\d]*/gui; // p{L} is a unicode letter, \d is a digit
      let text = this.notes.replace(re, str => {
        let marker = str[0];
        let word = str.slice(1);

        if (marker === '#') {
          // For hashtags, use camelCaseToSpace
          return `<a class="tag" onclick="onShowSearch('${word}')">${this.camelCaseToSpace(word)}</a>`;
          
        } else if (marker === '@') {
          // For mentions, only keep the first word
          let firstWord = word.split(/(?=[A-Z])/)[0]; // Splits at uppercase letter boundaries
          return `<a class="person" onclick="onShowSearch('${word}')">${firstWord}</a>`;
        }
      });
      
      // replace new-lines
      return text.replace(/\n/g, "<br>");
    }

    enhancedText(tagCache) {
      // Clean approach: analyze raw text, then render everything in one pass
      const rawText = this.notes;
      
      // Constants
      const MIN_TAG_USES = 3;
      const MIN_WORD_LENGTH = 2;
      
      // STEP 1: Find all existing tags in raw text
      const existingTags = [];
      const tagRegex = /([#@])\p{L}[\p{L}\d]*/gui;
      let match;
      while ((match = tagRegex.exec(rawText)) !== null) {
        existingTags.push({
          full: match[0],
          marker: match[1], 
          word: match[0].slice(1),
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      // STEP 2: Find potential suggestions using helper methods
      let suggestions = [];
      if (tagCache) {
        const suggestedWords = new Set(); // Shared between both methods to prevent conflicts
        const personSuggestions = this.findPersonSuggestions(rawText, existingTags, tagCache, MIN_TAG_USES, MIN_WORD_LENGTH, suggestedWords);
        const topicSuggestions = this.findTopicSuggestions(rawText, existingTags, tagCache, MIN_TAG_USES, MIN_WORD_LENGTH, suggestedWords);
        suggestions = [...personSuggestions, ...topicSuggestions];
      }
      
      // STEP 3: Render everything in order of position
      const allElements = [
        ...existingTags.map(tag => ({...tag, type: 'existing'})),
        ...suggestions // Keep original type ('person', etc.)
      ].sort((a, b) => a.start - b.start);
      
      // Build final HTML
      let result = '';
      let lastPos = 0;
      
      allElements.forEach(element => {
        // Add text before this element
        result += rawText.slice(lastPos, element.start);
        
        if (element.type === 'existing') {
          // Render existing tag with metadata
          const tagKey = element.word.toLowerCase();
          const tagStats = tagCache?.[tagKey];
          const isRecent = tagStats?.recentActivity || false;
          const isPerson = tagStats?.isPerson || element.marker === '@';
          
          let classes = isPerson ? 'person' : 'tag';
          if (isRecent) classes += ' recent';
          
          let dataAttrs = '';
          if (tagStats) {
            const yearStats = tagStats.yearStats || {};
            const originalName = tagStats.originalName || tagKey;
            dataAttrs = `data-tag="${tagKey}" data-original-name="${originalName}" data-uses="${tagStats.totalUses}" data-avg="${tagStats.avgScore.toFixed(1)}" data-peak="${tagStats.peakYear}" data-peak-count="${tagStats.peakYearCount}" data-is-person="${isPerson}" data-year-stats='${JSON.stringify(yearStats)}'`;
          }

          if (element.marker === '#') {
            result += `<a class="${classes}" ${dataAttrs} onclick="onShowSearch('${element.word}')">${this.camelCaseToSpace(element.word)}</a>`;
          } else {
            const firstWord = element.word.split(/(?=[A-Z])/)[0];
            result += `<a class="${classes}" ${dataAttrs} onclick="onShowSearch('${element.word}')">${firstWord}</a>`;
          }
        } else {
          // Render suggestion
          const firstNameAttr = element.firstName ? ` data-first-name="${element.firstName}"` : '';
          result += `<span class="tag-suggestion ${element.type}" data-original-text="${element.text}" data-suggested-tag="${element.suggestedTag}"${firstNameAttr} onclick="onShowTagSuggestion(this)">${element.text}</span>`;
        }
        
        lastPos = element.end;
      });
      
      // Add remaining text
      result += rawText.slice(lastPos);
      
      return result.replace(/\n/g, "<br>");
    }

    // Initialize shared tag parser
    getTagParser() {
      if (!this._tagParser) {
        this._tagParser = new TagParser();
      }
      return this._tagParser;
    }

    camelCaseToSpace(str) {
      return this.getTagParser().camelCaseToSpace(str);
    }

    checkOverlap(suggestionStart, suggestionEnd, existingTags) {
      return this.getTagParser().checkOverlap(suggestionStart, suggestionEnd, existingTags);
    }

    createWordRegex(word) {
      return this.getTagParser().createWordRegex(word);
    }

    // Extract person suggestions from raw text
    findPersonSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords = new Set()) {
      return this.getTagParser().findPersonSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords);
    }

    // Extract topic suggestions from raw text  
    findTopicSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords = new Set()) {
      return this.getTagParser().findTopicSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords);
    }

  
    styleClass() {
      return this.summary == null ? 'val0' : 'val' + this.summary;
    }
    
    summaryText() {
      return this.summary || "?"
    }
}

  FaveDayApp = class FaveDayApp {  
    constructor() {
      Sugar.extend();
      
      // Initialize centralized modules
      this.scoreCalculator = new ScoreCalculator();
      this.dataManager = new DataManager();
      this.router = new Router();
      this.settingsManager = new SettingsManager(this.scoreCalculator, this.router, this.dataManager);
      this.widgetManager = new WidgetManager(this.dataManager, this.scoreCalculator, this.router);
      
      this.showSearch = this.showSearch.bind(this);
      this.tmplScores = Hogan.compile($('#tmpl-scores').html());
      
      // Initialize command palette
      this.initializeCommandPalette();
      
      // Old search form handling removed - now using command palette

      this.showEmpty = false;
      this.tagsOnly = false;
      this.tagCache = {};
      this.years = []; // Initialize as empty array to prevent map errors

      // loadScores will be called after initialization in onAppStart
    }

    /**
     * Initialize configuration store
     * Call this after the app is created
     */
    async initializeConfig() {
      const config = await window.api.getConfig();
      window.configStore.load(config);
    }

    /**
     * Initialize app with provided scores data
     * Used when user selects a new data folder
     */
    async init(scores) {
      // Initialize dataManager with the provided scores
      this.dataManager.setScores(scores || []);
      
      // Update properties from dataManager
      this.tagCache = this.dataManager.getTagCache();
      this.years = this.dataManager.getYears();
      
      // Load tag cache and future entries
      this.tagCache = await window.api.getTagCache();
      this.dataManager.setFutureEntries(await window.api.loadFutureEntries());
        
      // Rebuild command palette search index with new data
      if (this.buildSearchIndex) {
        this.buildSearchIndex();
      }
      
      // Trigger UI update
      this.onScoreAdded();
    }
    
    fmtDiff(val, currentVal) {
      if (val === 0) return '';
      
      // Calculate percentage change
      const percentageChange = currentVal > 0 ? Math.round((val / currentVal) * 100) : 0;
      const sign = val > 0 ? '+' : '';
      const arrow = val > 0 ? '▲' : '▼';
      const absPercentage = Math.abs(percentageChange);
      
      return `${arrow} ${sign}${absPercentage}%`;
    }



    getScoreTypeInfo() {
      return this.widgetManager.getScoreTypeInfo();
    }

    // ==================== COMMAND PALETTE ====================

    initializeCommandPalette() {
      this.commandPaletteVisible = false;
      this.commandSearchIndex = [];
      this.selectedResultIndex = -1;
      
      // Build search index
      this.buildSearchIndex();
      
      // Set up keyboard shortcuts
      document.addEventListener('keydown', (event) => {
        // Ctrl+K or Cmd+K to toggle command palette
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault();
          if (this.commandPaletteVisible) {
            this.hideCommandPalette();
          } else {
            this.showCommandPalette();
          }
          return;
        }
        
        // ESC on settings page goes back to dashboard
        if (event.key === 'Escape' && !this.commandPaletteVisible) {
          const route = this.router.getCurrentRoute();
          if (route && route.url === '/settings') {
            event.preventDefault();
            this.showDashboard();
          }
          return;
        }

        // Handle navigation when palette is open
        if (this.commandPaletteVisible) {
          switch (event.key) {
            case 'Escape':
              event.preventDefault();
              this.hideCommandPalette();
              break;
            case 'ArrowDown':
              event.preventDefault();
              this.moveSelection(1);
              break;
            case 'ArrowUp':
              event.preventDefault();
              this.moveSelection(-1);
              break;
            case 'Enter':
              event.preventDefault();
              this.executeSelectedResult();
              break;
          }
        }
      });
      
      // Set up search input
      const searchInput = document.getElementById('command-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (event) => {
          this.handleSearchInput(event.target.value);
        });
      }
      
      // Close on overlay click
      const overlay = document.getElementById('command-palette-overlay');
      if (overlay) {
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) {
            this.hideCommandPalette();
          }
        });
      }
    }

    buildSearchIndex() {
      this.commandSearchIndex = [];
      
      // Add static navigation items
      this.commandSearchIndex.push({
        id: 'dashboard',
        title: 'Dashboard',
        subtitle: 'Main overview page',
        icon: '📊',
        type: 'page',
        action: () => this.showDashboard()
      });
      
      this.commandSearchIndex.push({
        id: 'new-entry',
        title: 'New Entry',
        subtitle: 'Create a new diary entry',
        icon: '✏️',
        type: 'action',
        searchTerms: ['new', 'entry', 'create', 'add', 'write'],
        action: () => {
          const today = new Date().format("{yyyy}-{MM}-{dd}");
          this.showEditScore(today);
        }
      });
      
      this.commandSearchIndex.push({
        id: 'analytics', 
        title: 'Analytics',
        subtitle: 'Data analysis and insights',
        icon: '📈',
        type: 'page',
        action: () => this.showJourneyAnalytics()
      });
      
      this.commandSearchIndex.push({
        id: 'tags',
        title: 'Tags',
        subtitle: 'All tags and topics',
        icon: '🏷️',
        type: 'page',
        action: () => this.showTags()
      });
      
      this.commandSearchIndex.push({
        id: 'years',
        title: 'Years',
        subtitle: 'Year overview',
        icon: '📅',
        type: 'page',
        action: () => this.showYears()
      });
      
      this.commandSearchIndex.push({
        id: 'settings',
        title: 'Settings',
        subtitle: 'App configuration and preferences',
        icon: '⚙️',
        type: 'page',
        action: () => this.showSettings()
      });
      
      // Add years dynamically
      if (this.years && this.years.length > 0) {
        this.years.forEach(year => {
          this.commandSearchIndex.push({
            id: `year-${year}`,
            title: year.toString(),
            subtitle: `Year ${year}`,
            icon: '📆',
            type: 'year',
            searchTerms: [year.toString()],
            action: () => this.showYear(year)
          });
        });
      }
      
      // Add months for available years
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const monthAbbreviations = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
      ];
      
      if (this.dataManager.getAllScores() && this.dataManager.getAllScores().length > 0) {
        const availableMonths = new Set();
        this.dataManager.getAllScores().forEach(entry => {
          const date = new Date(entry.date);
          const year = date.getFullYear();
          const month = date.getMonth();
          const key = `${year}-${month}`;
          if (!availableMonths.has(key)) {
            availableMonths.add(key);
            this.commandSearchIndex.push({
              id: `month-${year}-${month + 1}`,
              title: `${monthNames[month]} ${year}`,
              subtitle: `Month view`,
              icon: '📅',
              type: 'month',
              searchTerms: [
                monthNames[month].toLowerCase(),
                monthAbbreviations[month],
                `${monthNames[month]} ${year}`,
                `${monthAbbreviations[month]} ${year}`,
                year.toString()
              ],
              action: () => this.showMonth(year, month + 1)
            });
          }
        });
      }
      
      // Add tags dynamically from tag cache (comprehensive list)
      if (this.tagCache) {
        Object.entries(this.tagCache).forEach(([tagName, tagData]) => {
          // Skip if not enough usage to be relevant
          if ((tagData.totalUses || 0) < 2) return;
          
          const displayName = tagData.isPerson 
            ? this.formatPersonName(tagData.originalCasing || tagName)
            : tagName;
            
          this.commandSearchIndex.push({
            id: `tag-${tagName}`,
            title: displayName,
            subtitle: `${tagData.totalUses || 0} uses • Avg score ${(tagData.avgScore || 0).toFixed(1)}`,
            icon: tagData.isPerson ? '👤' : '#',
            type: 'tag',
            searchTerms: [tagName, displayName.toLowerCase()],
            action: () => this.showSearch(tagName)
          });
        });
      }
    }

    formatPersonName(tagName) {
      return tagName
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase: abc -> a bc
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // PascalCase: ABc -> A Bc
        .replace(/^([a-z])/, (match, p1) => p1.toUpperCase()); // Capitalize first letter
    }

    getDefaultResults() {
      // Return only main navigation pages for the default view
      const defaultIds = ['dashboard', 'new-entry', 'analytics', 'tags', 'years', 'settings'];
      return this.commandSearchIndex.filter(item => 
        defaultIds.includes(item.id)
      ).sort((a, b) => {
        // Maintain specific order with new-entry second, settings at the end
        const order = defaultIds.indexOf(a.id) - defaultIds.indexOf(b.id);
        return order;
      });
    }

    showCommandPalette() {
      this.commandPaletteVisible = true;
      this.selectedResultIndex = -1;
      
      // Rebuild index to get latest data
      this.buildSearchIndex();
      
      const overlay = document.getElementById('command-palette-overlay');
      const searchInput = document.getElementById('command-search-input');
      
      if (overlay && searchInput) {
        overlay.classList.remove('hidden');
        searchInput.value = '';
        searchInput.focus();
        
        // Show only main navigation pages as default results
        const defaultResults = this.getDefaultResults();
        this.renderSearchResults(defaultResults);
      }
    }

    hideCommandPalette() {
      this.commandPaletteVisible = false;
      this.selectedResultIndex = -1;
      
      const overlay = document.getElementById('command-palette-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }

    handleSearchInput(query) {
      if (!query.trim()) {
        // Show only main navigation pages when empty
        this.renderSearchResults(this.getDefaultResults());
        return;
      }
      
      const results = this.searchItems(query);
      
      // If no results found, offer direct search action with result count preview
      if (results.length === 0) {
        // Get result count by doing a quick search
        const resultCount = this.getSearchResultCount(query);
        
        const searchAction = {
          id: `search-${query}`,
          title: `Search for "${query}"`,
          subtitle: resultCount > 0 ? `${resultCount} diary entries found` : 'Search diary entries',
          icon: '🔍',
          type: 'search-action',
          action: () => {
            this.hideCommandPalette();
            this.showSearch(query);
          }
        };
        this.renderSearchResults([searchAction]);
        return;
      }
      
      this.renderSearchResults(results.slice(0, 10));
    }

    searchItems(query) {
      let lowerQuery = query.toLowerCase();
      let filterType = null; // 'person', 'topic', or null for all
      
      // Handle # and @ prefixes
      if (query.startsWith('#')) {
        lowerQuery = query.slice(1).toLowerCase();
        filterType = 'topic';
      } else if (query.startsWith('@')) {
        lowerQuery = query.slice(1).toLowerCase();
        filterType = 'person';
      }
      
      const results = [];
      
      // Filter items based on type if prefix was used
      const filteredIndex = this.commandSearchIndex.filter(item => {
        if (filterType === 'person') {
          return item.type === 'tag' && item.icon === '👤';
        } else if (filterType === 'topic') {
          return item.type === 'tag' && item.icon === '#';
        }
        return true; // No filter, include all items
      });
      
      // Exact matches first
      for (const item of filteredIndex) {
        if (item.title.toLowerCase() === lowerQuery) {
          results.push({ item, score: 100 });
          continue;
        }
        
        // Check search terms
        if (item.searchTerms) {
          for (const term of item.searchTerms) {
            if (term === lowerQuery) {
              results.push({ item, score: 90 });
              break;
            }
          }
          if (results[results.length - 1]?.item === item) continue;
        }
      }
      
      // Starts with matches
      for (const item of filteredIndex) {
        if (results.some(r => r.item.id === item.id)) continue;
        
        if (item.title.toLowerCase().startsWith(lowerQuery)) {
          results.push({ item, score: 80 });
          continue;
        }
        
        if (item.searchTerms) {
          for (const term of item.searchTerms) {
            if (term.startsWith(lowerQuery)) {
              results.push({ item, score: 70 });
              break;
            }
          }
          if (results[results.length - 1]?.item === item) continue;
        }
      }
      
      // Contains matches
      for (const item of filteredIndex) {
        if (results.some(r => r.item.id === item.id)) continue;
        
        if (item.title.toLowerCase().includes(lowerQuery)) {
          results.push({ item, score: 60 });
          continue;
        }
        
        if (item.subtitle.toLowerCase().includes(lowerQuery)) {
          results.push({ item, score: 50 });
          continue;
        }
        
        if (item.searchTerms) {
          for (const term of item.searchTerms) {
            if (term.includes(lowerQuery)) {
              results.push({ item, score: 40 });
              break;
            }
          }
        }
      }
      
      // Sort by score descending
      results.sort((a, b) => b.score - a.score);
      
      return results.map(r => r.item);
    }

    getSearchResultCount(query) {
      if (!query || !this.dataManager.getAllScores()) return 0;
      
      let foundScores = this.dataManager.getAllScores();
      let keywords = query.split(' ');
      
      for (let needle of keywords) {
        if (needle.length < 1) continue;
        
        needle = needle.toLowerCase();
        
        if (needle[0] === '=') {
          let score = parseInt(needle[1], 10);
          foundScores = foundScores.filter(s => s.summary === score);
        } else if (needle[0] === '>') {
          let score = parseInt(needle[1], 10);
          foundScores = foundScores.filter(s => s.summary >= score);
        } else if (needle[0] === '<') {
          let score = parseInt(needle[1], 10);
          foundScores = foundScores.filter(s => s.summary <= score);
        } else {
          let date = Date.create(needle);
          if (date.isValid()) {
            foundScores = foundScores.filter(s => s.date.is(needle));
          } else if (needle.length > 0) {
            const needleLower = needle.toLowerCase();
            const regex = new RegExp(`\\b${needleLower}`, 'i');
            foundScores = foundScores.filter(s => regex.test(s.notes));
          }
        }
      }
      
      return foundScores.length;
    }

    renderSearchResults(results) {
      const resultsContainer = document.getElementById('command-results');
      if (!resultsContainer) return;
      
      if (results.length === 0) {
        this.selectedResultIndex = -1;
        resultsContainer.innerHTML = `
          <div class="command-result-item">
            <div class="result-icon">🔍</div>
            <div class="result-content">
              <div class="result-title">No results found</div>
              <div class="result-subtitle">Try a different search term</div>
            </div>
          </div>
        `;
        return;
      }
      
      // Auto-select first result
      this.selectedResultIndex = 0;
      
      resultsContainer.innerHTML = results.map((item, index) => `
        <div class="command-result-item ${index === 0 ? 'selected' : ''}" data-index="${index}">
          <div class="result-icon">${item.icon}</div>
          <div class="result-content">
            <div class="result-title">${item.title}</div>
            <div class="result-subtitle">${item.subtitle}</div>
          </div>
        </div>
      `).join('');
      
      // Add click handlers
      resultsContainer.querySelectorAll('.command-result-item').forEach((element, index) => {
        element.addEventListener('click', () => {
          this.selectedResultIndex = index;
          this.executeSelectedResult();
        });
      });
    }

    moveSelection(direction) {
      const resultsContainer = document.getElementById('command-results');
      const items = resultsContainer.querySelectorAll('.command-result-item');
      
      if (items.length === 0) return;
      
      // Remove current selection
      if (this.selectedResultIndex >= 0) {
        items[this.selectedResultIndex].classList.remove('selected');
      }
      
      // Calculate new index
      this.selectedResultIndex += direction;
      
      if (this.selectedResultIndex < 0) {
        this.selectedResultIndex = items.length - 1;
      } else if (this.selectedResultIndex >= items.length) {
        this.selectedResultIndex = 0;
      }
      
      // Add new selection
      items[this.selectedResultIndex].classList.add('selected');
      
      // Scroll into view if needed
      items[this.selectedResultIndex].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }

    executeSelectedResult() {
      const resultsContainer = document.getElementById('command-results');
      const items = resultsContainer.querySelectorAll('.command-result-item');
      
      if (items.length === 0) return;
      
      const searchInput = document.getElementById('command-search-input');
      const query = searchInput ? searchInput.value : '';
      
      // Get the actual rendered results (including dynamic search actions)
      let results;
      if (query.trim()) {
        const searchResults = this.searchItems(query);
        if (searchResults.length === 0) {
          // No command palette results, create search action
          const resultCount = this.getSearchResultCount(query);
          results = [{
            id: `search-${query}`,
            title: `Search for "${query}"`,
            subtitle: resultCount > 0 ? `${resultCount} diary entries found` : 'Search diary entries',
            icon: '🔍',
            type: 'search-action',
            action: () => {
              this.showSearch(query);
            }
          }];
        } else {
          results = searchResults.slice(0, 10);
        }
      } else {
        results = this.getDefaultResults();
      }
      
      // If no result is selected, select the first one
      let indexToExecute = this.selectedResultIndex;
      if (indexToExecute < 0 || indexToExecute >= results.length) {
        indexToExecute = 0;
      }
      
      if (results[indexToExecute]) {
        // Always hide command palette first, then execute action
        this.hideCommandPalette();
        results[indexToExecute].action();
      }
    }
    
    showSummary(scores) {
      const OPENAI_API_KEY = 'XXX';

      const requestData = {
        model: "gpt-3.5-turbo",
        // messages: [
        //   {
        //     role: "system",
        //     content: "You are a digital diary assistant."
        //   },
        //   {
        //     role: "user",
        //     content: "Summarize the highlights from the following diary entries into bullet points in html ul format. Use no more than 5 bulletpoints. Use the same language as in the journal entries:"+ scores.map(s => s.notes).join(' ')
        //   }
        // ]
        
        // messages: [
        //   {
        //     role: "system",
        //     content: "You are a wellbeing mentor modeled to speak and think like Jean-Luc Picard of the TNG Enterprise."
        //   },
        //   {
        //     role: "user",
        //     content: "Provide actionable commentary and draw upon comparisons with historic events and figures - tapping into Picard's deep appreciation of European history. Write from the perspective of being Picard. Keep it short, no more than 3 sentences. You must use the same language as in the journal entries:"+ scores.map(s => s.notes).join(' ')
        //   }
        // ]

        messages: [
          {
            role: "system",
            content: "You are: Jean Luc Picard."
          },
          {
            role: "user",
            content: "You must provide concrete actionable guidance based on the understand of the following journal entries written by your friend. Draw upon historic references based on the life of the figure. Write no more than 3 sentences. You must use the same language as in the journal entries:"+ scores.map(s => s.notes).join(' ')
          }
        ]
      };

      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestData)
      })
        .then(response => response.json())
        .then(data => $('#ai').html(data.choices[0].message.content ))
        .catch(error => console.error('Error:', error));
    }
    
    async loadScores() {
      await this.dataManager.loadScores();
      
      // Update properties from dataManager
      this.tagCache = this.dataManager.getTagCache();
      this.years = this.dataManager.getYears();
        
      // Rebuild command palette search index with new data
      if (this.buildSearchIndex) {
        this.buildSearchIndex();
      }
      
      this.onScoreAdded();
    }

    async saveScores() {
      await this.dataManager.saveScores();
      
      // Update legacy properties for backward compatibility  
      this.tagCache = this.dataManager.getTagCache();
      
      // Rebuild command palette search index with updated data
      if (this.buildSearchIndex) {
        this.buildSearchIndex();
      }
    }

    setupDemoUser() {
      $('#userName').html('Demo User');
      
      const demoScores = this.dataManager.setupDemoUser();
      
      // Update properties from dataManager
      this.years = this.dataManager.getYears();
      
      return this.onScoreAdded();
    }

    onScoreAdded() {
      const allScores = this.dataManager.getAllScores();
      
      // Sort scores in descending order
      allScores.sort((a, b) => b.date - a.date);
      
      if (allScores.length > 0) {
        let minYear = allScores[allScores.length - 1].date.getFullYear();
        let maxYear = allScores[0].date.getFullYear();
        
        this.years = [];
        for (let year = minYear; year <= maxYear; year++) {
          this.years.push(year);
        }
      } else {
        this.years = [];
      }

      $('#topArea').show();
      $('#loading').hide();
      
      handleRoute();
    }

    onScoreAddedAndNavigateBack() {
      // Update the data like onScoreAdded but navigate back instead of handling current route
      this.dataManager.getAllScores().sort((a, b) => b.date - a.date); // sort in descending order
      
      let minYear = this.dataManager.getAllScores().last().date.getFullYear();
      let maxYear = this.dataManager.getAllScores().first().date.getFullYear();
      
      this.years = [];
      for (let year = minYear; year <= maxYear; year++) {
        this.years.push(year);
      }

      $('#topArea').show();
      $('#loading').hide();
      
      // Navigate back to previous page instead of handling current route
      if (window.history.length > 1) {
        history.back();
      } else {
        // Fallback to dashboard if no history
        this.showDashboard();
      }
    }

    getOrdinalSuffix(day) {
      const lastDigit = day % 10;
      const lastTwoDigits = day % 100;
      
      // Handle special cases for 11th, 12th, 13th
      if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return 'th';
      }
      
      // Handle 1st, 2nd, 3rd, and everything else
      switch (lastDigit) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }

    formatDateWithOrdinal(date) {
      const day = date.getDate();
      const month = date.format("{Month}");
      const year = date.format("{yyyy}");
      const ordinalSuffix = this.getOrdinalSuffix(day);
      
      return `${month} ${day}${ordinalSuffix}, ${year}`;
    }

    showToaster(message, type = 'success', duration = 3000) {
      const toaster = document.getElementById('toaster');
      const toasterMessage = document.getElementById('toaster-message');
      
      if (!toaster || !toasterMessage) {
        console.error('Toaster elements not found');
        return;
      }

      // Update message
      toasterMessage.textContent = message;
      
      // Update styling based on type
      if (type === 'success') {
        toaster.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
        toaster.querySelector('.toaster-icon').textContent = '✓';
      } else if (type === 'error') {
        toaster.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        toaster.querySelector('.toaster-icon').textContent = '✗';
      } else if (type === 'info') {
        toaster.style.background = 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)';
        toaster.querySelector('.toaster-icon').textContent = 'ℹ';
      }
      
      // Show toaster
      toaster.classList.add('show');
      
      // Hide after duration
      setTimeout(() => {
        toaster.classList.remove('show');
      }, duration);
    }

    showError() {
      return this.render('#tmpl-landing', '#content', {
        error: 'Could not connect :-('
      }, {});
    }

    render(templateId, viewId, atts, partials) {
      var view;
      view = Hogan.compile($(templateId).html());
      return $(viewId).html(view.render(atts, partials));
    }

    enhanceScoresForDisplay(scores) {
      // Add enhanced text with tag cache data to scores
      if (!scores || !Array.isArray(scores)) {
        console.warn('enhanceScoresForDisplay called with non-array:', scores);
        return [];
      }
      
      return scores.map(score => {
        return {
          // Copy all existing properties that the template needs
          date: score.date,
          summary: score.summary,
          notes: score.notes,
          dateStr: score.dateStr(),
          monthId: score.monthId(),
          weekday: score.weekday(),
          styleClass: score.styleClass(),
          summaryText: score.summaryText(),
          dateId: score.dateId(),
          empty: score.empty(),
          // Use enhanced text instead of regular text
          text: score.enhancedText ? score.enhancedText(this.tagCache) : score.text()
        };
      });
    }

    toggleScoreDialogue() {
      if ($('#addScore').is(':visible')) {
        $('#addScore').hide();
        $('#addScoreBtn .btn').removeClass('active');
      } else {
        $('#datePicker').text(Date.create().format("{dd}-{mm}-{yyyy}"));
        $('#addScoreBtn .btn').addClass('active');
        $('#addScore').show();
      }
    }
    
    toggleShowEmpty() {
      this.showEmpty = !this.showEmpty;
      
      if (this.showEmpty)
        $('.empty').show();
      else
        $('.empty').hide();
    }
    
    getOverview(scores) {
      let overview = [0,0,0,0,0]
      
      for (let score of scores)
        overview[score.summary-1] += 1;
      
      return {
        count1: 100*overview[0]/overview.sum(),
        count2: 100*overview[1]/overview.sum(),
        count3: 100*overview[2]/overview.sum(),
        count4: 100*overview[3]/overview.sum(),
        count5: 100*overview[4]/overview.sum(),
      }
    }
    
    getMaxStreak(scores, onlyFirst= false) {
      let maxStreakCount = 0;
      let maxStreakStart = null;
      let maxStreakEnd = null;
      
      let streakCount = 0;
      let streakStart = null;
      let streakEnd = null;
      
      let prevDate = null;
      
      for (let score of scores) {
        const currentDate = new Date(score.date);
        currentDate.setHours(0, 0, 0, 0); // Normalize to start of day

        if (prevDate) {
          // Check if the current date is consecutive
          const timeDiff = currentDate - prevDate;
          const dayDiff = Math.abs(timeDiff / (1000 * 3600 * 24));

          if (dayDiff === 1) {
            streakCount++;
          } else {
            if (onlyFirst && streakCount >= 2) break;
            
            streakCount = 1;
            streakStart = currentDate;
          }
        } else {
          streakCount = 1;
          streakStart = currentDate;
        }

        if (streakCount > maxStreakCount) {
          maxStreakCount = streakCount;
          maxStreakStart = streakStart;
          maxStreakEnd = currentDate;
        }

        prevDate = currentDate;
      }
      
      return {
        count: maxStreakCount, 
        start: maxStreakEnd ? maxStreakEnd.format("{d} {Mon} {yyyy}") : "", 
        end: maxStreakStart ? maxStreakStart.format("{d} {Mon} {yyyy}") : ""
      }
    }
    
    getScores(year, month, date) {
      return this.dataManager.getScores(year, month, date);
    }

    async showDashboard() {
      // Old search input clearing removed - now using command palette
      
      // Safety check for scores
      if (!this.dataManager.getAllScores() || !Array.isArray(this.dataManager.getAllScores())) {
        console.warn('No scores loaded yet');
        return;
      }
      
      let recent = this.dataManager.getAllScores().slice(0, 3);
      
      let filteredBestScores = this.dataManager.getAllScores().filter(function(s) {
        return s.summary === 5;
      });
      let bestScores = filteredBestScores.length > 0 ? filteredBestScores.sample() : [];
      // Ensure bestScores is always an array
      if (!Array.isArray(bestScores)) {
        bestScores = bestScores ? [bestScores] : [];
      }
      
      let today = Date.create();
      let toDay = today.getDay();
      let toWeek = today.getISOWeek();
      
      // Get scores for this exact day of the week and week
      let todayScores = this.dataManager.getAllScores().filter(s =>
        s.date.getDay() === toDay && s.date.getISOWeek() === toWeek
      );
      
      // Get anniversary days (same month and day across all years)
      let anniversaryScores = this.dataManager.getAllScores().filter(s =>
        s.date.getMonth() === today.getMonth() && s.date.getDate() === today.getDate()
      );
      
      let anniversaryStats = null;
      if (anniversaryScores.length > 0) {
        anniversaryStats = {
          count: anniversaryScores.length,
          avgScore: this.scoreCalculator.calculate(anniversaryScores).format(2)
        };
      }
      
      let diff = null;
      let prevMonthScores = this.getScores(today.getFullYear(), today.getMonth()) // month-1
      if (prevMonthScores.length > 0)
      {
        let curMonthScores = this.getScores(today.getFullYear(), today.getMonth()+1) // month
        
        let prevAvg = this.scoreCalculator.calculate(prevMonthScores, new Date(today.getFullYear(), today.getMonth(), 0).getDate())
        let curAvg = this.scoreCalculator.calculate(curMonthScores, new Date(today.getFullYear(), today.getMonth()+1, 0).getDate())
        diff = this.fmtDiff(curAvg - prevAvg, prevAvg)
      }

      // Get config for birthdate
      const config = await window.api.getConfig();
      
      // Calculate progress data
      const calendarProgress = this.widgetManager.getCalendarYearProgress();
      const lifeProgress = config.birthdate ? this.widgetManager.getLifeYearProgress(config.birthdate) : null;
      const coverage = this.widgetManager.getCoverageProgress();
      const thirtyDayStats = await this.widgetManager.getThirtyDayComparisons();
      const scoreTypeInfo = this.widgetManager.getScoreTypeInfo();
      const nextFutureLetter = this.widgetManager.getNextFutureLetter();

      this.pushHistory('/', '');
      
      return this.render('#tmpl-dashboard', '#content', {
        recentScores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(recent)}),
        bestScores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(bestScores)}),
        hasTodayScores: todayScores.length > 0,
        todayScores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(todayScores)}),
        anniversaryStats: anniversaryStats,
        years: this.years.map(y => ({year: y})),
        streak: this.getMaxStreak(this.dataManager.getAllScores(), true),
        diff: diff,
        footer: `Total Scores: ${this.dataManager.getAllScores().length}`,
        calendarProgress: calendarProgress,
        lifeProgress: lifeProgress,
        coverage: coverage,
        thirtyDayStats: thirtyDayStats ? {
          words: {
            current: thirtyDayStats.currentAvgWords,
            previous: thirtyDayStats.previousAvgWords,
            trend: thirtyDayStats.wordsTrend,
            trendDisplay: thirtyDayStats.wordsTrendDisplay
          },
          score: {
            current: thirtyDayStats.currentAvgScore,
            previous: thirtyDayStats.previousAvgScore,
            trend: thirtyDayStats.scoreTrend,
            trendDisplay: thirtyDayStats.scoreTrendDisplay
          }
        } : null,
        scoreTypeIcon: scoreTypeInfo.icon,
        scoreTypeName: scoreTypeInfo.name,
        nextFutureLetter: nextFutureLetter
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    isValidMonth(date, date1, date2) {
      return date.isBetween(date1, date2) ? date.format("{yyyy}-{MM}") : null;
    }

    async showMonth(yearNum, monthNum) {
      this.showEmpty = false;
      
      let monthDate = Date.create(`${yearNum}-${monthNum}`);
      let title = monthDate.format('{Month} {yyyy}');

      let monthScores = this.dataManager.getAllScores().filter(s =>
        s.date.getFullYear() === yearNum &&
        s.date.getMonth() === monthNum-1
      );
      
      let prevYearDate = new Date(monthDate).addYears(-1);
      let prevMonthDate = new Date(monthDate).addMonths(-1);
      let nextMonthDate = new Date(monthDate).addMonths(1);
      let nextYearDate = new Date(monthDate).addYears(1);
      
      this.pushHistory(`/month/${yearNum}/${monthNum}`, title);

      //this.showSummary(monthScores);

      let virtualMonthScores = []
      for (let dateNum=1; dateNum<=31; dateNum++) {
        // Find the last entry for this date (most recent if multiple exist)
        let matches = monthScores.filter(s => 
          s.date.getFullYear() === yearNum &&
          s.date.getMonth() === monthNum-1 &&
          s.date.getDate() === dateNum);
        let score = matches.length > 0 ? matches[matches.length - 1] : null;
        
        if (score == null)
        {
          score = new Score(
            new Date(yearNum, monthNum-1, dateNum),
            null,
            '')
        }
        
        virtualMonthScores.push(score)
      }
      
      let tags = this.getTags(monthScores); 
      let firstDate = this.dataManager.getAllScores()[0].date;
      let lastDate = this.dataManager.getAllScores().last().date;
      let daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const scoreTypeInfo = this.widgetManager.getScoreTypeInfo();
      
      this.render('#tmpl-month', '#content', {
        title: title,
        scores: virtualMonthScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(virtualMonthScores)}),
        years: this.years.map(y => ({year: y})),
        
        hasTags: tags.length > 0,
        tags: tags,
        
        prevYear: this.isValidMonth(prevYearDate, firstDate, lastDate),
        prevMonth: this.isValidMonth(prevMonthDate, firstDate, lastDate),
        nextMonth: this.isValidMonth(nextMonthDate, firstDate, lastDate),
        nextYear: this.isValidMonth(nextYearDate, firstDate, lastDate),
        
        displayScore: this.scoreCalculator.calculate(monthScores, daysInMonth).format(2),
        scoreTypeIcon: scoreTypeInfo.icon,
        overview: this.getOverview(monthScores)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        scoreBar: Hogan.compile($('#tmpl-score-bar').html())
      });

      document.getElementById('showEmptyToggle').addEventListener('change', function() {
        this.toggleShowEmpty();
      }.bind(this));
    }

    async showMonths(monthId) {
      let monthNum = parseInt(monthId)-1;
      let date = new Date(2024, monthNum, 1);

      // all scores of this month
      let monthScores = this.dataManager.getAllScores().filter(s =>
        s.date.getMonth() === monthNum
      );

      // scores of this month by year
      let byYear = monthScores.groupBy(s => s.date.getFullYear());
      let allMonths = [];

      const dayNums = Array.from({ length: 31 }, (_, index) => index + 1); // 1..31

      let year = null;
      for (year in byYear) {
        // we don't just iterate over byYear because we also care about empty month entries
        let oneMonth = byYear[year];
        let monthDate = new Date(year, monthNum, 1);

        allMonths.push({
          date: year,
          monthId:  monthDate.format('{yyyy}-{MM}'),
          totalAvg: this.scoreCalculator.calculate(oneMonth, new Date(year, monthNum + 1, 0).getDate()).format(2),
          totalCount: oneMonth.length,
          totalWords: (oneMonth.map(s => s.notes.split(' ').length).sum() / 1000.0).format(1),
          days: dayNums.map(d => {
            return {
              val: oneMonth.find(s => s.date.getDate() === d)?.summary ?? 0,
              weekday: Date.create(`${year}-${parseInt(monthId) + 1}-${d}`).getDay()
            }
          }), 
        });
      }

      let title = date.format('{Month}');
      this.pushHistory(`/months/${monthId}`, title);

      let randomScores = monthScores.filter(s => s.summary >=3).sample(5);
      let bestScores = monthScores.filter(s => s.summary === 5).sample(1).sortBy(s => s.date, true);

      const displayScore = this.scoreCalculator.calculate(monthScores);
      const scoreTypeInfo = this.widgetManager.getScoreTypeInfo();

      return this.render('#tmpl-months', '#content', {
        title: title,
        displayScore: displayScore.format(2),
        scoreTypeIcon: scoreTypeInfo.icon,
        scoreTypeName: scoreTypeInfo.name,
        months: allMonths.reverse(),
        years: this.years.map(y => ({year: y})),
        scores: randomScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(randomScores)}),
        inspiration: bestScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(bestScores)}),
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
      });
    }

    updateRandomInspiration() {
      let bestScores = this.dataManager.getAllScores().filter(s => s.summary === 5).sample();
      if (!Array.isArray(bestScores)) {
        bestScores = bestScores ? [bestScores] : [];
      }
      return $('#bestScores').html(this.tmplScores.render({ scores: this.enhanceScoresForDisplay(bestScores) }));
    }

    async showYears() {
      // Get configurable life quality weights
      const weights = this.scoreCalculator.getLifeQualityWeights();
      const lerp = (t, a, b, i) =>
        Math.floor(t * parseInt(a[i], 16) + (1 - t) * parseInt(b[i], 16));
      
      const interpCol = function(t, col1, col2) {
        let c1 = [col1.slice(1, 3), col1.slice(3, 5), col1.slice(5, 7)];
        let c2 = [col2.slice(1, 3), col2.slice(3, 5), col2.slice(5, 7)];
        return `rgb(${lerp(t, c1, c2, 0)}, ${lerp(t, c1, c2, 1)}, ${lerp(t, c1, c2, 2)})`;
      };

      const getColorForVal = val => {
        if (val >= 5.00) return '#33AA66';
        if (val >= 4.00) return interpCol(val - 4, '#9AD600', '#33AA66');
        if (val >= 3.00) return interpCol(val - 3, '#FFAD26', '#9AD600');
        if (val >= 2.00) return interpCol(val - 2, '#FFB399', '#FFAD26');
        if (val >= 1.00) return interpCol(val - 1, '#FF794D', '#FFB399');
        return '#444' 
      };

      const getYearMonths = (oneYear, year) => {
        let byMonth = oneYear.groupBy(s => s.date.getMonth());
        const monthNums = Array.from({ length: 12 }, (_, index) => index); // 0..11
        
        const monthData = [];
        for (let m of monthNums) {
          let scores = byMonth[m] ?? [];
          
          // Calculate expected days in this month
          const yearForDateId = oneYear[0]?.date.getFullYear() || parseInt(year);
          const daysInMonth = new Date(yearForDateId, m + 1, 0).getDate();
          
          const monthScore = this.scoreCalculator.calculate(scores, daysInMonth);
          console.log(`Month ${m+1}: scores=${scores.length}, daysInMonth=${daysInMonth}, result=${monthScore}, defaultScore=${this.scoreCalculator.getDefaultEmptyScore()}`);
          
          // Calculate size: minimum 8px, scale with entry count, max 25px
          const entryCount = scores.length;
          const size = entryCount === 0 ? 8 : Math.max(8, Math.min(25, 8 + entryCount * 2));
          
          const monthStr = (m + 1).toString().padStart(2, '0');
          
          monthData.push({
            avg: monthScore,
            dateId: `${yearForDateId}-${monthStr}`,
            sz: size
          });
        }
        return monthData;
      };
      
      const getYearInspiration = (yearScores) => {
        const inspiration = yearScores
          .filter(s => s.summary >= 4)
          .sample(2)
          .sortBy(s => s.date, true);

        return inspiration.isEmpty() ? null : this.tmplScores.render({ scores: this.enhanceScoresForDisplay(inspiration) });
      };

      let byYear = this.dataManager.getAllScores().groupBy(s => s.date.getFullYear());
      let allYears = [];
      
      for (const year in byYear) {
        let oneYear = byYear[year];
        
        // Calculate totalAvg with expected days count
        const yearNum = parseInt(year);
        const daysInYear = ((yearNum % 4 === 0 && yearNum % 100 !== 0) || (yearNum % 400 === 0)) ? 366 : 365;
        const totalAvg = this.scoreCalculator.calculate(oneYear, daysInYear);
        
        // Get months data directly 
        const months = getYearMonths(oneYear, year);

        // Calculate coverage percentage for this year
        const entriesCount = oneYear.length;
        const coveragePercentage = Math.round((entriesCount / daysInYear) * 100);
        
        allYears.push({
          year: year,
          totalCount: `${coveragePercentage}%`,
          words: (oneYear.map(s => s.notes.split(' ').length).sum() / 1000.0).format(1),
          totalAvg: totalAvg,
          months: months,
          inspiration: getYearInspiration(oneYear),
        });
      }
      
      //let maxAvg = allYears.map(s => s.months.max(m => m.avg).first().avg).max().first();
      //let minAvg = allYears.map(s => s.months.min(m => m.avg).first().avg).min().first();
      
      for (const oneYear of allYears) {
        for (const oneMonth of oneYear.months) {
          // removed normalization for now. too complicated
          //const normalizedVal = (oneMonth.avg - minAvg) / (maxAvg - minAvg);
          //oneMonth.col = getColorForVal(1 + 4 * normalizedVal);

          oneMonth.col = getColorForVal(oneMonth.avg);
          oneMonth.avg = oneMonth.avg.toFixed(2);
        }
        
        // Keep the existing rank calculation  
        oneYear.rank = allYears.filter(y => y.totalAvg > oneYear.totalAvg).length + 1;
      }
       
      let inspiration = [];
      for (const year in byYear) {
        let oneYear = byYear[year];
        
        inspiration.push({
          year: year,
          insp: getYearInspiration(oneYear)
        });
      }

      // Calculate best days in parallel
      const bestDaysPromises = Array.from({ length: 7 }, (_, i) => {
        const dayScores = this.dataManager.getAllScores().filter(d => d.date.getDay() === i);
        return this.scoreCalculator.calculate(dayScores);
      });
      const bestDays = await Promise.all(bestDaysPromises);

      // Calculate best months in parallel
      const bestMonthsPromises = Array.from({ length: 12 }, (_, i) => {
        const monthScores = this.dataManager.getAllScores().filter(d => d.date.getMonth() === i);
        return this.scoreCalculator.calculate(monthScores);
      });
      const bestMonths = await Promise.all(bestMonthsPromises);

      // Calculate best seasons in parallel
      const bestSeasonsPromises = Array.from({ length: 4 }, (_, i) => {
        // Season mapping: 0=Winter, 1=Spring, 2=Summer, 3=Autumn
        let seasonMonths;
        switch(i) {
          case 0: seasonMonths = [11, 0, 1]; break; // Winter: Dec, Jan, Feb
          case 1: seasonMonths = [2, 3, 4]; break;  // Spring: Mar, Apr, May
          case 2: seasonMonths = [5, 6, 7]; break;  // Summer: Jun, Jul, Aug
          case 3: seasonMonths = [8, 9, 10]; break; // Autumn: Sep, Oct, Nov
        }
        const seasonScores = this.dataManager.getAllScores().filter(d => seasonMonths.includes(d.date.getMonth()));
        return this.scoreCalculator.calculate(seasonScores);
      });
      const bestSeasons = await Promise.all(bestSeasonsPromises);

      // Find maximum values for highlighting
      const maxDay = Math.max(...bestDays);
      const maxMonth = Math.max(...bestMonths);
      const maxSeason = Math.max(...bestSeasons);

      // Calculate overall statistics across all entries
      const scoreTypeInfo = this.widgetManager.getScoreTypeInfo();
      const overallDisplayScore = this.dataManager.getAllScores().length > 0 ? this.scoreCalculator.calculate(this.dataManager.getAllScores()) : 0;
      
      // Use already calculated totalAvg for medal ranking
      for (let yearData of allYears) {
        yearData.rawDisplayScore = yearData.totalAvg;
      }
      
      // Add medal system for top 3 years based on selected score type
      const sortedByScore = [...allYears].sort((a, b) => b.rawDisplayScore - a.rawDisplayScore);
      
      allYears.forEach(year => {
        const scoreRank = sortedByScore.findIndex(y => y.year === year.year) + 1;
        
        if (scoreRank === 1) {
          year.rankStr = '🥇';
        } else if (scoreRank === 2) {
          year.rankStr = '🥈';
        } else if (scoreRank === 3) {
          year.rankStr = '🥉';
        } else {
          year.rankStr = '';
        }
      });
      
      // Format display scores and clean up temporary data
      for (let yearData of allYears) {
        yearData.displayScore = yearData.totalAvg.format(2);
        delete yearData.rawDisplayScore; // Clean up temporary data
      }

      this.pushHistory('/years', 'Years');
      
      const renderData = {
        scores: [...allYears].reverse(),
        inspiration: inspiration.filter(i => i.insp != null).reverse(),
        years: this.years.map(y => ({year: y})),
        bestDays: bestDays.map((s, i) => ({
          value: s.format(2),
          isMax: s === maxDay
        })),
        bestMonths: bestMonths.map((s, i) => ({
          value: s.format(2),
          isMax: s === maxMonth
        })),
        bestSeasons: bestSeasons.map((s, i) => ({
          value: s.format(2),
          isMax: s === maxSeason
        })),
        streak: this.getMaxStreak(this.dataManager.getAllScores()),
        overview: this.getOverview(this.dataManager.getAllScores()),
        overallDisplayScore: overallDisplayScore.format(1),
        scoreTypeIcon: scoreTypeInfo.icon,
        scoreTypeName: scoreTypeInfo.name
      };
      
      return this.render('#tmpl-years', '#content', renderData, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        scoreBar: Hogan.compile($('#tmpl-score-bar').html())
      });
    }

    pushHistory(url, title) {
      const fullTitle = (title.length > 0) ? `Faveday - ${title}` : 'Faveday';
      // Let the router handle all history management - no duplicate calls
      this.router.pushHistory(url, fullTitle);
    }
    
    getTags(scores, sortBy = 'lastUsage') {
      // Use cached tag statistics instead of recalculating
      const re = /([#@])\p{L}[\p{L}\d]*/gui;
      
      let currentTagCounts = {};
      let personTags = new Set();
      let originalPersonCasing = {}; // Store original casing for person names
      
      // Only count current tags in the scores (for filtering purposes)
      for (let score of scores) {
        let matches = score.notes.match(re);
        if (matches) {
          matches.forEach(match => {
            let marker = match[0];
            let originalName = match.slice(1); // Keep original casing
            let tagName = originalName.toLowerCase();
            currentTagCounts[tagName] = (currentTagCounts[tagName] || 0) + 1;
            
            if (marker === '@') {
              personTags.add(tagName);
              // Store the most recent original casing we've seen
              originalPersonCasing[tagName] = originalName;
            }
          });
        }
      }

      // Build results using cached data
      let results = [];
      for (let tagName of Object.keys(currentTagCounts)) {
        const cachedStats = this.tagCache[tagName];
        const currentCount = currentTagCounts[tagName];
        
        // Determine if it's a person tag (from current usage or cache)
        const isPerson = personTags.has(tagName) || (cachedStats?.isPerson) || false;
        const isRecent = cachedStats?.recentActivity || false;
        
        // Use cached statistics when available, fallback to current data
        const totalUses = cachedStats?.totalUses || currentCount;
        const avgScore = cachedStats?.avgScore || 0;
        const totalScore = cachedStats?.totalScore || 0;
        const hotness = cachedStats?.hotness || 0;
        
        // For date sorting, calculate from current scores if cache doesn't have dates yet
        let firstUsage = null;
        let lastUsage = null;
        
        if (cachedStats?.firstUsage && cachedStats?.lastUsage) {
          firstUsage = new Date(cachedStats.firstUsage);
          lastUsage = new Date(cachedStats.lastUsage);
        } else {
          // Fallback: calculate from current scores if cache missing dates
          for (let score of scores) {
            let matches = score.notes.match(/[#@]\p{L}+/gui) || [];
            for (let match of matches) {
              if (match.slice(1).toLowerCase() === tagName) {
                if (!firstUsage || score.date < firstUsage) firstUsage = score.date;
                if (!lastUsage || score.date > lastUsage) lastUsage = score.date;
              }
            }
          }
        }
        const peakYear = cachedStats?.peakYear || 'unknown';
        const peakYearCount = cachedStats?.peakYearCount || 0;
        
        // Simple CSS classes
        let classes = '';
        if (isPerson) {
          classes += 'person ';
        } else {
          classes += 'tag '; // Topic tags need the 'tag' class for popup detection!
        }
        if (isRecent) classes += 'recent ';
        classes = classes.trim();
        
        // Data attributes for popup
        const yearStats = cachedStats?.yearStats || {};
        const dataAttrs = `data-tag="${tagName}" data-uses="${totalUses}" data-avg="${avgScore.toFixed(1)}" data-peak="${peakYear}" data-peak-count="${peakYearCount}" data-is-person="${isPerson}" data-year-stats='${JSON.stringify(yearStats)}'`;
        
        results.push({
          tag: tagName,
          originalCasing: originalPersonCasing[tagName] || tagName, // Store original casing if available
          count: totalUses,
          avgScore: avgScore,
          totalScore: totalScore,
          hotness: hotness,
          firstUsage: firstUsage,
          lastUsage: lastUsage,
          weight: 1, // No weight-based sizing
          color: '', // No inline color
          classes: classes,
          dataAttrs: dataAttrs
        });
      }

      // Sort based on selected criteria
      switch (sortBy) {
        case 'avgScore':
          return results.sort((a, b) => b.avgScore - a.avgScore);
        case 'totalScore':
          return results.sort((a, b) => b.totalScore - a.totalScore);
        case 'hotness':
          return results.sort((a, b) => b.hotness - a.hotness);
        case 'alphabetical':
          return results.sort((a, b) => a.tag.localeCompare(b.tag));
        case 'firstUsage':
          // "Newest" - sort by first occurrence, newest first (reverse chronological)
          return results.sort((a, b) => {
            if (!a.firstUsage && !b.firstUsage) return 0;
            if (!a.firstUsage) return 1;
            if (!b.firstUsage) return -1;
            return b.firstUsage - a.firstUsage; // Reversed for newest first
          });
        case 'lastUsage':
          // "Recency" - sort by most recent usage first
          return results.sort((a, b) => {
            if (!a.lastUsage && !b.lastUsage) return 0;
            if (!a.lastUsage) return 1;
            if (!b.lastUsage) return -1;
            return b.lastUsage - a.lastUsage;
          });
        case 'count':
        default:
          return results.sort((a, b) => b.count - a.count);
      }
    }
    
    getGroupedTags(scores, sortBy = 'lastUsage') {
      // Get all tags and separate by type
      const allTags = this.getTags(scores, sortBy);
      
      const companions = allTags.filter(tag => tag.classes.includes('person')).slice(0, 8);
      const landmarks = allTags.filter(tag => !tag.classes.includes('person')).slice(0, 12);
      
      return {
        companions: companions,
        landmarks: landmarks,
        hasCompanions: companions.length > 0,
        hasLandmarks: landmarks.length > 0
      };
    }
    
    showTags(sortBy = 'lastUsage', filterBy = 'both') {
      // Store current state
      this.currentTagSort = sortBy;
      this.currentTagFilter = filterBy;
      
      let allTags = this.getTags(this.dataManager.getAllScores(), sortBy).slice(0,250);
      
      // Apply filtering
      let filteredTags = allTags;
      if (filterBy === 'tags') {
        filteredTags = allTags.filter(tag => !tag.classes.includes('person'));
      } else if (filterBy === 'persons') {
        filteredTags = allTags.filter(tag => tag.classes.includes('person'));
      }
      
      // Format person names (convert @MichaelSchwahn to "Michael Schwahn")
      const tagsWithFormattedNames = filteredTags.map(tag => {
        let displayName = tag.tag;
        if (tag.classes.includes('person')) {
          // Use original casing if available, then format it properly
          const nameToFormat = tag.originalCasing || tag.tag;
          displayName = nameToFormat
            .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase: abc -> a bc
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // PascalCase: ABc -> A Bc
            .replace(/^([a-z])/, (match, p1) => p1.toUpperCase()); // Capitalize first letter
        }
        return {
          ...tag,
          displayName: displayName
        };
      });
      
      this.pushHistory(`/tags`, 'Tags');

      return this.render('#tmpl-tags', '#content', {
        years: this.years.map(y => ({year: y})),
        tags: tagsWithFormattedNames,
        sortBy: sortBy,
        filterBy: filterBy,
        sortOptions: {
          count: sortBy === 'count',
          avgScore: sortBy === 'avgScore',
          totalScore: sortBy === 'totalScore',
          hotness: sortBy === 'hotness',
          alphabetical: sortBy === 'alphabetical',
          firstUsage: sortBy === 'firstUsage',
          lastUsage: sortBy === 'lastUsage'
        },
        filterOptions: {
          both: filterBy === 'both',
          tags: filterBy === 'tags', 
          persons: filterBy === 'persons'
        }
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    async showYear(yearNum) {
      let year = parseInt(yearNum);
      let oneYear = this.getScores(year)
      let byMonth = oneYear.groupBy(s => s.date.getMonth());
      
      const monthNums = Array.from({ length: 12 }, (_, index) => index); // 0..11
      const dayNums = Array.from({ length: 31 }, (_, index) => index + 1); // 1..31
      
      let months = [];
      for (let month of monthNums) {
        let scores = byMonth[month] ?? [];
        let date = Date.create(`${year}-${parseInt(month) + 1}`);

        let days = dayNums.map(dayNum => {
          let date = Date.create(`${year}-${parseInt(month) + 1}-${dayNum}`);
          
          return {
            val: isNaN(date) ? "X" : scores.find(s => s.date.getDate() === dayNum)?.summary ?? 0,
            weekday: date.getDay()
          }
        });
        
        let offset = days[0].weekday // 0 is sunday
        for (let i=0; i<offset; i++)
          days.splice(i, 0, {val:"X", weekday:i});
        
        const daysInThisMonth = new Date(year, month + 1, 0).getDate();
        const monthDisplayScore = this.scoreCalculator.calculate(scores, daysInThisMonth);
        
        months.push({
          date: date.format('{Mon} {yyyy}'),
          avg: monthDisplayScore.format(2),
          link: `/month/${yearNum}/${parseInt(month) + 1}`,
          monthId: date.format('{yyyy}-{MM}'),
          monthsId: date.format('{MM}'),
          days: days
        });
      }
      
      months.reverse();
      let randomScores = oneYear.filter(s => s.summary >=3).sample(5);
      let bestScores = oneYear.filter(s => s.summary === 5).sample(1).sortBy(s => s.date, true);

      this.pushHistory(`/year/${year}`, year);
      
      const displayScore = this.scoreCalculator.calculate(oneYear);
      const scoreTypeInfo = this.widgetManager.getScoreTypeInfo();

      return this.render('#tmpl-year', '#content', {
        year: year,
        displayScore: displayScore.format(2),
        scoreTypeIcon: scoreTypeInfo.icon,
        scoreTypeName: scoreTypeInfo.name,
        scores: randomScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(randomScores)}),
        inspiration: bestScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(bestScores)}),
        months: months,
        years: this.years.map(y => ({year: y})),
        streak: this.getMaxStreak(oneYear),
        overview: this.getOverview(oneYear)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        scoreBar: Hogan.compile($('#tmpl-score-bar').html())
      });
    }

    async showSearch(id) {
      // Use passed parameter or return to dashboard if not provided
      if (!id) {
        return this.showDashboard();
      }
      
      if (id.length < 1) {
        return this.showDashboard();
      }
      
      // Store current search term for toggle functionality
      this.currentSearchTerm = id;
      
      let foundScores = this.dataManager.getAllScores();
      let keywords = [];
      let ref = id.split(' ');
      
      for (let j = 0, len = ref.length; j < len; j++) {
        let needle = ref[j];
        
        if (needle.length < 1) {
          continue;
        }
        
        needle = needle.toLowerCase();
        
        if (needle[0] === '=') {
          let score = parseInt(needle[1], 10)
          foundScores = foundScores.filter(s => s.summary === score);
          
        } else if (needle[0] === '>') {
          let score = parseInt(needle[1], 10)
          foundScores = foundScores.filter(s => s.summary >= score);
          
        } else if (needle[0] === '<') {
          let score = parseInt(needle[1], 10)
          foundScores = foundScores.filter(s => s.summary <= score);
          
        } else {
          // arbitrary date criteria
          let date = Date.create(needle);
          if (date.isValid()) {
            foundScores = foundScores.filter(s => s.date.is(needle));
            
          // text criteria
          } else if (needle.length > 0) {
            if (this.tagsOnly) {
              // Tag-only search: look for exact #needle or @needle with word boundaries
              const tagRegex = new RegExp(`[#@]${needle.toLowerCase()}\\b`, 'i');
              foundScores = foundScores.filter(s => tagRegex.test(s.notes.toLowerCase()));
            } else {
              // Regular text search - strict word boundaries
              const needleLower = needle.toLowerCase();
              const regex = new RegExp(`\\b${needleLower}\\b`, 'i'); // Word boundaries on both ends
              foundScores = foundScores.filter(s => regex.test(s.notes));
            }
            
            keywords.push(needle);
          }
        }
      }
      
      let hits = this.years.map(y => ({
        year: y,
        count: foundScores.filter(s => s.date.getFullYear() === y).length
      }));
      
      // Create chart data for all years (including empty ones)
      const maxHits = Math.max(...hits.map(h => h.count), 1);
      const yearChart = this.years.map(year => {
        const yearScores = foundScores.filter(s => s.date.getFullYear() === year);
        const count = yearScores.length;
        const avgScore = count > 0 ? this.scoreCalculator.calculate(yearScores) : 0;
        const percentage = foundScores.length > 0 ? Math.round((count / foundScores.length) * 100) : 0;
        
        return {
          year: year,
          count: count,
          avgScore: avgScore,
          percentage: percentage,
          hasResults: count > 0,
          height: count > 0 ? Math.max(3, Math.round((count / maxHits) * 40)) : 0
        };
      });
      
      // Group scores by year for better organization
      const scoresByYear = foundScores.length > 0 ? foundScores.groupBy(s => s.date.getFullYear()) : {};
      const yearGroups = [];
      
      // Create year groups in reverse chronological order (newest first)
      for (let year of this.years.slice().reverse()) {
        const yearScores = scoresByYear[year] || [];
        if (yearScores.length > 0) {
          yearGroups.push({
            year: year,
            count: yearScores.length,
            scores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(yearScores)})
          });
        }
      }
      
      // Calculate life quality for search results using configurable weights
      const displayScore = foundScores.length > 0 ? this.scoreCalculator.calculate(foundScores) : 0;
      const scoreTypeInfo = this.widgetManager.getScoreTypeInfo();

      this.render('#tmpl-search', '#content', {
        count: foundScores.length,
        hasResults: foundScores.length > 0,
        displayScore: displayScore.format(2),
        scoreTypeIcon: scoreTypeInfo.icon,
        scores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(foundScores)}),
        yearGroups: yearGroups,
        years: this.years.map(y => ({year: y})),
        hits: hits.filter(hit => hit.count > 0),
        yearChart: yearChart,
        firstYear: this.years[0],
        lastYear: this.years[this.years.length - 1],
        streak: foundScores.length > 0 ? this.getMaxStreak(foundScores) : {count: 0, start: "", end: ""},
        tags: foundScores.length > 0 ? this.getTags(foundScores) : [],
        tagGroups: foundScores.length > 0 ? this.getGroupedTags(foundScores) : null,
        tagsOnly: this.tagsOnly
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
      
      // Apply search highlighting while preserving tag suggestions
      let notesElem = $('.notes');
      for (let k = 0; k < notesElem.length; k++) {
        let elem = notesElem[k];

        for (let n = 0; n < keywords.length; n++) {
          let keyword = keywords[n];
          
          // Create a more sophisticated regex that avoids matching inside tag suggestions
          // We need to avoid matching content inside elements with class "tag-suggestion"
          const textNodes = this.getTextNodesWithoutTagSuggestions(elem);
          
          textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const regex = new RegExp(`(${keyword})`, 'ig');
            
            if (regex.test(text)) {
              // Create a temporary container to hold the highlighted content
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = text.replace(regex, "<em>$1</em>");
              
              // Replace the text node with the highlighted content
              const fragment = document.createDocumentFragment();
              while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
              }
              textNode.parentNode.replaceChild(fragment, textNode);
            }
          });
        }
      }

      this.pushHistory(`/search/${id}`, id);
    }
    
    showEditScore(dateId) {
      if (dateId == null)
      {
        let now = new Date();
        if (now.getHours() < 18)
          now.addDays(-1);

        dateId = now.format("{yyyy}-{MM}-{dd}");
      }
        
      // if ($('#editScore').is(':visible')) {
      //   this.hideEditScore();
      //   return;
      // }
      
      $('#editScore').show();
      $('#content').hide();
      
      // Determine if this is a future entry based on date
      let date = new Date(dateId);
      let today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time for date comparison
      date.setHours(0, 0, 0, 0);
      
      this.isFutureEntry = date > today;
      
      // Find the last entry for this date (most recent if multiple exist)
      let matches = this.dataManager.getAllScores().filter(s => s.dateId() === dateId)
      let score = matches.length > 0 ? matches[matches.length - 1] : null
      
      if (score == null) {
        score = new Score(new Date(), 3, '')
      }

      this.updateScoreProgress(score.notes)
      this.selectScoreVal(score.summary);
      
      let dateLabel = Sugar.Date.format(date, '{d} {Month} {yyyy} ({Weekday})')
      $('#editScore .date .thisDay').text(dateLabel);
      
      let nextDay = date.addDays(1)
      let prevDay = date.addDays(-1)
      
      let textarea = $('#editScore textarea')
      textarea.val(score.notes);
      
      // Update UI based on entry type
      this.updateEntryModeUI();
      
      textarea.focus(); // Focus on the textarea
      textarea.get(0).setSelectionRange(score.notes.length, score.notes.length);
    }
    
    hideEditScore() {
      $('#editScore').hide();
      $('#content').show();
    }

    switchToFutureEntry() {
      if (this.isFutureEntry) {
        // Toggle back to diary mode
        let dateId = this.previousDiaryDateId || null;
        this.previousDiaryDateId = null;
        this.showEditScore(dateId);
      } else {
        // Save current diary date, switch to future
        let currentDateLabel = $('#editScore .date .thisDay').text();
        this.previousDiaryDateId = new Date(currentDateLabel).format("{yyyy}-{MM}-{dd}");
        let futureDate = new Date();
        futureDate.addYears(1);
        this.showEditScore(futureDate.format("{yyyy}-{MM}-{dd}"));
      }
    }

    updateEntryModeUI() {
      const editScore = $('#editScore');
      const submitButtonText = $('#submitButtonText');
      const scoreButtons = $('#scoreButtons');
      const futureBtn = $('#futureEntryBtn');

      if (this.isFutureEntry) {
        editScore.addClass('future-entry-mode');
        submitButtonText.text('Save Future Entry');
        scoreButtons.hide();
        futureBtn.text('Write Diary');
      } else {
        editScore.removeClass('future-entry-mode');
        submitButtonText.text('Add Score');
        scoreButtons.show();
        futureBtn.text('Write to Future');
      }
    }
    
    selectScoreVal(val) {
      this.currentVal = val;

      const buttons = document.querySelectorAll('.valButton');
      buttons.forEach(button => {
        button.classList.remove('val1', 'val2', 'val3', 'val4', 'val5');
      });

      const selectedButton = buttons[val - 1];
      selectedButton.classList.add(`val${val}`);
    }
    
    selectDay(dayDiff) {
      let dateLabel = $('#editScore .date .thisDay').text()
      let date = new Date(dateLabel);
      let nextDate = date.addDays(dayDiff) 
      this.showEditScore(nextDate.format("{yyyy}-{MM}-{dd}"));
    }

    async submitScore() {
      let dateLabel = $('#editScore .date .thisDay').text()
      let dateId = new Date(dateLabel).format("{yyyy}-{MM}-{dd}")
      let notes = $('#editScore textarea').val();

      if (this.isFutureEntry) {
        // Handle future entry
        await this.dataManager.loadFutureEntries(); // Ensure we have latest data
        let futureEntries = this.dataManager.getFutureEntries();
        
        // Find existing future entry or create new one
        let existingIndex = futureEntries.findIndex(entry => 
          new Date(entry.date).format("{yyyy}-{MM}-{dd}") === dateId
        );
        
        if (existingIndex >= 0) {
          // Update existing future entry
          futureEntries[existingIndex].notes = notes;
          console.log(`Updated future entry for ${dateId}: ${notes}`);
        } else {
          // Create new future entry
          let futureEntry = {
            date: new Date(dateId),
            notes: notes
          };
          futureEntries.push(futureEntry);
          console.log(`Added future entry for ${dateId}: ${notes}`);
        }
        
        // Save future entries
        await this.dataManager.saveFutureEntries(futureEntries);
        
        this.showToaster(`Future entry saved for ${this.formatDateWithOrdinal(new Date(dateId))}.`);
      } else {
        // Handle regular diary entry
        let score = this.dataManager.getAllScores().find(s => s.dateId() === dateId)
        let isNew = false;
        
        if (score == null)
        {
          score = new Score(new Date(), 3, '')
          this.dataManager.getAllScores().push(score)
          isNew = true;
        }
        
        score.date = new Date(dateId)
        score.summary = this.currentVal
        score.notes = notes
        
        console.log(`${isNew ? 'added' : 'edited'} score (${this.currentVal}): ${notes}`)
        
        // Format date for toaster notification
        const formattedDate = this.formatDateWithOrdinal(score.date);
        const action = isNew ? 'added' : 'updated';
        this.showToaster(`Date ${formattedDate} ${action}.`);
        
        this.saveScores()
      }
      
      this.hideEditScore();
      this.onScoreAddedAndNavigateBack();
    }
    
    updateScoreProgress(text) {
      const maxWords = window.configStore.getWordCountGoal();
      const wordCount = text === '' ? 0 : text.split(/\s+/).length;

      const progressValue = Math.min((wordCount / maxWords) * 100, 100);

      document.getElementById('editScoreProgress').value = progressValue;
    }




    async getThirtyDayComparisons() {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);

      // Current 30 days
      const currentPeriod = this.dataManager.getAllScores().filter(s => s.date >= thirtyDaysAgo && s.date <= now);
      
      // Previous 30 days (31-60 days ago)
      const previousPeriod = this.dataManager.getAllScores().filter(s => s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo);

      // Word count comparison
      const currentWordCount = currentPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
      const previousWordCount = previousPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
      const currentAvgWords = currentPeriod.length > 0 ? Math.round(currentWordCount / 30) : 0;
      const previousAvgWords = previousPeriod.length > 0 ? Math.round(previousWordCount / 30) : 0;
      const wordsDiff = currentAvgWords - previousAvgWords;

      // Entry count comparison
      const currentEntries = currentPeriod.length;
      const previousEntries = previousPeriod.length;
      const entriesDiff = currentEntries - previousEntries;

      // Average score comparison
      const currentAvgScore = currentPeriod.length > 0 ? this.scoreCalculator.calculate(currentPeriod) : 0;
      const previousAvgScore = previousPeriod.length > 0 ? this.scoreCalculator.calculate(previousPeriod) : 0;
      const scoreDiff = currentAvgScore - previousAvgScore;

      // Most used tag in recent 30 days
      const tagCounts = {};
      currentPeriod.forEach(score => {
        const tags = score.notes.match(/[#@]\p{L}+/gui) || [];
        tags.forEach(tag => {
          const cleanTag = tag.slice(1).toLowerCase();
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        });
      });
      
      const topTag = Object.entries(tagCounts).length > 0 
        ? Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0] 
        : null;

      const formatTrend = (diff, trend, currentVal) => {
        if (diff === 0) return '';
        const arrow = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
        const sign = diff > 0 ? '+' : '';
        
        // Calculate percentage change
        const percentageChange = currentVal > 0 ? Math.round((diff / currentVal) * 100) : 0;
        const absPercentage = Math.abs(percentageChange);
        
        return ` ${arrow} ${sign}${absPercentage}%`;
      };

      return {
        words: {
          current: currentAvgWords,
          previous: previousAvgWords,
          diff: wordsDiff,
          trend: wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(wordsDiff, wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same', previousAvgWords)
        },
        entries: {
          current: currentEntries,
          previous: previousEntries,
          diff: entriesDiff,
          trend: entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(entriesDiff, entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same', previousEntries)
        },
        score: {
          current: Math.round(currentAvgScore * 10) / 10,
          previous: Math.round(previousAvgScore * 10) / 10,
          diff: Math.round(scoreDiff * 10) / 10,
          trend: scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(Math.round(scoreDiff * 10) / 10, scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same', Math.round(previousAvgScore * 10) / 10),
          trendEmoji: scoreDiff > 0 ? '📈' : scoreDiff < 0 ? '📉' : '➡️'
        },
        topTag: topTag ? { tag: topTag[0], count: topTag[1] } : null,
        lastHighScore: this.widgetManager.getDaysSinceLastScore(5),
        lastLowScore: this.widgetManager.getDaysSinceLastScore(1)
      };
    }














    async showJourneyAnalytics() {
      // Get config for birthdate
      const config = await window.api.getConfig();
      
      // Calculate all widget data
      const calendarProgress = this.widgetManager.getCalendarYearProgress();
      const lifeProgress = config.birthdate ? this.widgetManager.getLifeYearProgress(config.birthdate) : null;
      const coverage = this.widgetManager.getCoverageProgress();
      const thirtyDayStats = await this.widgetManager.getThirtyDayComparisons();
      
      // New analytics widgets  
      const personMentions = this.widgetManager.getPersonMentionsRatio();
      const activeSundays = this.widgetManager.getActiveSundays();
      const activeSaturdays = this.widgetManager.getActiveSaturdays();
      const totalOverview = this.widgetManager.getTotalOverview();
      const fiveScoreDays = this.widgetManager.getFiveScoreDaysCount();
      const avgDurationHighScores = this.widgetManager.getAverageDurationBetweenHighScores();
      
      // Latest widget additions
      const activeWorkweeks = this.widgetManager.getActiveWorkweeks();
      const trendingTopics = this.widgetManager.getTrendingTopics(); 
      const trendingPeople = this.widgetManager.getTrendingPeople();
      const consistency = this.widgetManager.getScoreConsistency();
      const superTag = this.widgetManager.getSuperTag();
      const seasonProgress = this.widgetManager.getSeasonProgress();
      const scoreTypeInfo = this.widgetManager.getScoreTypeInfo();
      
      this.pushHistory('/analytics', 'Analytics');
      
      return this.render('#tmpl-journey-analytics', '#content', {
        years: this.years.map(y => ({year: y})),
        calendarProgress: calendarProgress,
        lifeProgress: lifeProgress,
        coverage: coverage,
        thirtyDayStats: thirtyDayStats ? {
          words: {
            current: thirtyDayStats.currentAvgWords,
            previous: thirtyDayStats.previousAvgWords,
            trend: thirtyDayStats.wordsTrend,
            trendDisplay: thirtyDayStats.wordsTrendDisplay
          },
          entries: {
            current: thirtyDayStats.currentEntries,
            previous: thirtyDayStats.previousEntries,
            trend: thirtyDayStats.entriesTrend,
            trendDisplay: thirtyDayStats.entriesTrendDisplay
          },
          score: {
            current: thirtyDayStats.currentAvgScore,
            previous: thirtyDayStats.previousAvgScore,
            trend: thirtyDayStats.scoreTrend,
            trendDisplay: thirtyDayStats.scoreTrendDisplay
          }
        } : null,
        personMentions: personMentions,
        activeSundays: activeSundays,
        activeSaturdays: activeSaturdays,
        totalOverview: totalOverview,
        fiveScoreDays: fiveScoreDays ? {
          ...fiveScoreDays,
          count: fiveScoreDays.currentCount
        } : null,
        avgDurationHighScores: avgDurationHighScores ? {
          ...avgDurationHighScores,
          averageDays: avgDurationHighScores.currentAvgDuration
        } : null,
        // New widgets
        activeWorkweeks: activeWorkweeks,
        trendingTopics: trendingTopics,
        trendingPeople: trendingPeople,
        consistency: consistency,
        superTag: superTag,
        seasonProgress: seasonProgress,
        scoreTypeIcon: scoreTypeInfo.icon,
        scoreTypeName: scoreTypeInfo.name
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    async showSettings() {
      return await this.settingsManager.showSettings();
    }

    async saveBirthdate() {
      return await this.settingsManager.saveBirthdate();
    }

    async saveLifeQualityWeights() {
      return await this.settingsManager.saveLifeQualityWeights();
    }

    async resetLifeQualityWeights() {
      return await this.settingsManager.resetLifeQualityWeights();
    }

    async updateLifeQualityPreview(weights) {
      return await this.settingsManager.updateLifeQualityPreview(weights);
    }

    async setScoreType(scoreType) {
      return await this.settingsManager.setScoreType(scoreType);
    }

    async saveDefaultEmptyScore() {
      return await this.settingsManager.saveDefaultEmptyScore();
    }

    async saveWordCountGoal() {
      return await this.settingsManager.saveWordCountGoal();
    }

    runDiagnostics() {
      const results = [];
      const dateMap = new Map();
      
      // Check for duplicate dates
      this.dataManager.getAllScores().forEach(entry => {
        const dateId = entry.dateId();
        if (dateMap.has(dateId)) {
          dateMap.get(dateId).push(entry);
        } else {
          dateMap.set(dateId, [entry]);
        }
      });
      
      // Find duplicates
      const duplicates = [];
      dateMap.forEach((entries, dateId) => {
        if (entries.length > 1) {
          duplicates.push({ dateId, count: entries.length, entries });
        }
      });
      
      // Check for missing scores
      const missingScores = this.dataManager.getAllScores().filter(entry => 
        entry.summary === null || entry.summary === undefined
      );
      
      // Check for invalid dates
      const invalidDates = this.dataManager.getAllScores().filter(entry => {
        const date = entry.date;
        return isNaN(date.getTime()) || 
               date.getFullYear() < 1900 || 
               date.getFullYear() > 2100;
      });
      
      // Check for entries with no notes
      const emptyNotes = this.dataManager.getAllScores().filter(entry => 
        !entry.notes || entry.notes.trim() === ''
      );
      
      // Generate report
      let html = '<div style="font-family: monospace; font-size: 12px; line-height: 1.4;">';
      
      if (duplicates.length > 0) {
        html += '<div style="color: #ff6b6b; margin-bottom: 15px;"><strong>🔴 Duplicate Dates:</strong></div>';
        duplicates.forEach(dup => {
          html += `<div style="margin-left: 20px; margin-bottom: 5px;">`;
          html += `<strong>${dup.dateId}</strong> - ${dup.count} entries<br>`;
          dup.entries.forEach((entry, idx) => {
            html += `<span style="margin-left: 20px;">Entry ${idx + 1}: Score ${entry.summary || 'null'}, Notes: "${entry.notes.substring(0, 50)}..."</span><br>`;
          });
          html += '</div>';
        });
      }
      
      if (missingScores.length > 0) {
        html += '<div style="color: #ffa500; margin-bottom: 15px;"><strong>🟡 Missing Scores:</strong></div>';
        missingScores.forEach(entry => {
          html += `<div style="margin-left: 20px;">${entry.dateId()} - Score: ${entry.summary}</div>`;
        });
      }
      
      if (invalidDates.length > 0) {
        html += '<div style="color: #ff6b6b; margin-bottom: 15px;"><strong>🔴 Invalid Dates:</strong></div>';
        invalidDates.forEach(entry => {
          html += `<div style="margin-left: 20px;">Date: ${entry.date}, Score: ${entry.summary}</div>`;
        });
      }
      
      if (emptyNotes.length > 0) {
        html += '<div style="color: #87ceeb; margin-bottom: 15px;"><strong>🔵 Empty Notes:</strong></div>';
        emptyNotes.forEach(entry => {
          html += `<div style="margin-left: 20px;">${entry.dateId()} - Score: ${entry.summary}</div>`;
        });
      }
      
      if (duplicates.length === 0 && missingScores.length === 0 && invalidDates.length === 0 && emptyNotes.length === 0) {
        html += '<div style="color: #90ee90;"><strong>✅ All Good!</strong><br>No data integrity issues found.</div>';
      }
      
      html += '</div>';
      
      // Show results
      document.getElementById('diagnostics-results').style.display = 'block';
      document.getElementById('diagnostics-content').innerHTML = html;
    }

    getTextNodesWithoutTagSuggestions(element) {
      const textNodes = [];
      
      function collectTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Skip tag suggestion elements to preserve their functionality
          if (node.classList && node.classList.contains('tag-suggestion')) {
            return;
          }
          
          // Recursively collect text nodes from child elements
          for (let child of node.childNodes) {
            collectTextNodes(child);
          }
        }
      }
      
      collectTextNodes(element);
      return textNodes;
    }

    showTagSuggestion(element) {
      const popup = document.getElementById('tag-suggestion-popup');
      const optionsContainer = document.getElementById('suggestion-options');
      
      if (!popup || !optionsContainer) {
        console.error('Missing popup elements:', {popup, optionsContainer});
        return;
      }
      
      const originalText = element.getAttribute('data-original-text');
      const suggestedTag = element.getAttribute('data-suggested-tag');
      const firstName = element.getAttribute('data-first-name');
      const isPersonSuggestion = element.classList.contains('person');
      
      // Clear previous options
      optionsContainer.innerHTML = '';
      
      if (isPersonSuggestion) {
        // For person suggestions, show multiple options for the same first name if available
        if (firstName) {
          const personTags = Object.keys(this.tagCache).filter(tag => 
            this.tagCache[tag].isPerson && 
            (this.tagCache[tag].originalName || tag).toLowerCase().startsWith(firstName.toLowerCase())
          );
          
          personTags.forEach(personTag => {
            const fullName = this.tagCache[personTag].originalName || personTag;
            const button = document.createElement('button');
            button.className = 'suggestion-button person';
            button.innerHTML = `
              <span class="button-icon">👤</span>
              <span class="button-text">Convert to @${fullName}</span>
            `;
            button.onclick = () => {
              this.convertToTag(originalText, `@${fullName}`, element);
              this.hideTagSuggestion();
            };
            optionsContainer.appendChild(button);
          });
        } else {
          // Just show the single suggested person tag
          const button = document.createElement('button');
          button.className = 'suggestion-button person';
          button.innerHTML = `
            <span class="button-icon">👤</span>
            <span class="button-text">Convert to ${suggestedTag}</span>
          `;
          button.onclick = () => {
            this.convertToTag(originalText, suggestedTag, element);
            this.hideTagSuggestion();
          };
          optionsContainer.appendChild(button);
        }
      } else {
        // For topic suggestions, show single option
        const button = document.createElement('button');
        button.className = 'suggestion-button topic';
        button.innerHTML = `
          <span class="button-icon">🏷️</span>
          <span class="button-text">Convert to ${suggestedTag}</span>
        `;
        button.onclick = () => {
          this.convertToTag(originalText, suggestedTag, element);
          this.hideTagSuggestion();
        };
        optionsContainer.appendChild(button);
      }
      
      // Position popup near the element
      const rect = element.getBoundingClientRect();
      popup.style.position = 'fixed';
      popup.style.left = rect.left + 'px';
      popup.style.top = (rect.bottom + 5) + 'px';
      popup.classList.add('visible');
      
      // Hide popup when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.hideTagSuggestionOnClickOutside.bind(this));
      }, 100);
    }

    hideTagSuggestion() {
      const popup = document.getElementById('tag-suggestion-popup');
      popup.classList.remove('visible');
      document.removeEventListener('click', this.hideTagSuggestionOnClickOutside.bind(this));
    }

    hideTagSuggestionOnClickOutside(event) {
      const popup = document.getElementById('tag-suggestion-popup');
      if (!popup.contains(event.target) && !event.target.classList.contains('tag-suggestion')) {
        this.hideTagSuggestion();
      }
    }

    async convertToTag(originalText, newTag, element) {
      const parentRow = element.closest('tr');
      const notesCell = parentRow?.querySelector('.notes');
      
      if (!notesCell) {
        console.error('No notes cell found for tag conversion');
        return;
      }
      
      // Find the score entry that contains this element
      const dateElement = parentRow.querySelector('.date a');
      let targetScore = null;
      
      if (dateElement) {
        const dateId = dateElement.getAttribute('data-date-id');
        
        if (dateId) {
          targetScore = this.dataManager.getAllScores().find(score => score.dateId() === dateId);
        } else {
          // Fallback to text matching for older entries
          const dateText = dateElement.textContent.replace(/\s+/g, ' ').trim();
          targetScore = this.dataManager.getAllScores().find(score => score.dateStr() === dateText);
        }
      }
      
      if (!targetScore) {
        console.error('No target score found for tag conversion');
        return;
      }
      
      // Update the score data - only replace first occurrence
      // Use the full suggested tag (e.g., @ChristophPlewe) instead of just the original text
      targetScore.notes = targetScore.notes.replace(
        new RegExp(`\\b${originalText}\\b`), 
        newTag
      );
      
      // Immediately update the visual display
      notesCell.innerHTML = targetScore.enhancedText(this.tagCache);
      
      // Save in background and refresh tag cache
      try {
        await this.saveScores();
        this.tagCache = await window.api.getTagCache();
        // Final update with fresh cache data
        notesCell.innerHTML = targetScore.enhancedText(this.tagCache);
        
        // Show toaster notification
        const formattedDate = this.formatDateWithOrdinal(targetScore.date);
        this.showToaster(`"${originalText}" converted to ${newTag} on ${formattedDate}.`);
      } catch (error) {
        console.error('Error saving converted tag:', error);
        this.showToaster(`Error converting tag: ${error.message}`, 'error');
      }
    }

    refreshCurrentView() {
      // Refresh the current view based on the current route
      const currentPath = window.location.pathname;
      if (currentPath.includes('month')) {
        const monthId = currentPath.split('/').pop();
        this.showMonth(monthId);
      } else if (currentPath.includes('year')) {
        const yearId = currentPath.split('/').pop();
        this.showYear(yearId);
      } else if (currentPath.includes('search')) {
        const searchTerm = currentPath.split('/').pop();
        this.showSearch(searchTerm);
      } else {
        this.showDashboard();
      }
    }

  }

  //@showPlot()

  // showPlot: () ->
  //   <% data_vals = plot_data_months @avg_months %>

  //   var plotData = [{
  //     data:[<%= data_vals.join(',') %>],
  //     <%= plot_style data_vals %>
  //   }];

  //   var plotOptions = {
  //     grid: {
  //       borderWidth: 0,
  //       markings: [<%= plot_markings_months @months %>]
  //     },
  //     xaxis: {ticks: [<%= plotXAxisMonths @months %>]},
  //     yaxis: {minTickSize: 0.5, tickDecimals: 1}
  //   };

  //   $.plot($("#plot"), plotData, plotOptions);
  

  window.onConnect = function() {
    return window.app.setupDropbox();
  };

  window.onShowMonth = async function(monthId) {
    let [year, month] = monthId.split('-');
    return await window.app.showMonth(parseInt(year), parseInt(month));
  };

  window.onShowMonths = async function(id) {
    return await window.app.showMonths(id);
  };

  window.onShowYear = async function(id) {
    return await window.app.showYear(id);
  };
  
  window.onShowYears = async function() {
    return await window.app.showYears();
  };

  window.onShowTags = function() {
    return window.app.showTags();
  };

  window.onShowTagsWithSort = function(sortBy) {
    const currentFilter = window.app.currentTagFilter || 'both';
    return window.app.showTags(sortBy, currentFilter);
  };

  window.onShowTagsWithFilter = function(filterBy) {
    const currentSort = window.app.currentTagSort || 'lastUsage';
    window.app.currentTagFilter = filterBy;
    return window.app.showTags(currentSort, filterBy);
  };

  window.onShowJourneyAnalytics = async function() {
    return await window.app.showJourneyAnalytics();
  };

  window.onShowDashboard = async function() {
    return await window.app.showDashboard();
  };

  window.onUpdateRandomInspiration = function() {
    return app.updateRandomInspiration();
  };

  window.onToggleScoreDialogue = function() {
    return window.app.toggleScoreDialogue();
  };

  window.onCancelScoreDialogue = function() {
    return window.app.cancelScoreDialogue();
  };
  
  window.onShowEditScore = function(dateId) {
    return window.app.showEditScore(dateId);
  }
  
  window.onSubmitScore = function() {
    return window.app.submitScore();
  }
  
  window.onSelectFolder = async function () {
    const result = await window.api.selectFolder();
    if (result && result.success) {
      // Hide welcome screen and initialize app with new data
      document.getElementById('welcome-screen').style.display = 'none';
      await window.app.init(result.scores);
      window.app.showDashboard();
    }
  }

  window.onSelectScoreVal = function (val) {
    return window.app.selectScoreVal(val)
  }

  window.onSelectDay = function (val) {
    return window.app.selectDay(val)
  }

  window.onSwitchToFutureEntry = function() {
    return window.app.switchToFutureEntry();
  }

  window.onShowSearch = async function(id) {
    // Old search input value setting removed - now using command palette
    return await window.app.showSearch(id);
  };

  window.onShowCommandPalette = function() {
    return window.app.showCommandPalette();
  };

  window.onToggleSearchType = function(checked) {
    window.app.tagsOnly = checked;
    // Re-run the current search with the new toggle state
    if (window.app.currentSearchTerm) {
      window.app.showSearch(window.app.currentSearchTerm);
    }
    return;
  };

  window.onShowSettings = async function() {
    return await window.app.showSettings();
  };

  window.onSaveBirthdate = async function() {
    return await window.app.saveBirthdate();
  };

  window.onSaveLifeQualityWeights = async function() {
    return await window.app.saveLifeQualityWeights();
  };

  window.onResetLifeQualityWeights = async function() {
    return await window.app.resetLifeQualityWeights();
  };

  window.onSetScoreType = async function(scoreType) {
    return await window.app.setScoreType(scoreType);
  };

  window.onSaveDefaultEmptyScore = async function() {
    return await window.app.saveDefaultEmptyScore();
  };

  window.onSaveWordCountGoal = async function() {
    return await window.app.saveWordCountGoal();
  };

  window.onRunDiagnostics = function() {
    window.app.runDiagnostics();
  };

  window.onShowTagSuggestion = function(element) {
    if (window.app && window.app.showTagSuggestion) {
      window.app.showTagSuggestion(element);
    } else {
      console.error('window.app or showTagSuggestion method not found!', {app: window.app});
    }
  };

  window.onConvertToTag = function(originalText, newTag, element) {
    window.app.convertToTag(originalText, newTag, element);
  };

  window.onJumpToScoreDate = function(dateId) {
    // Parse the dateId (format: "YYYY-MM-DD") to get year and month
    const dateParts = dateId.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    
    // Navigate to the month view for that date
    window.app.showMonth(year, month);
  };

  window.addEventListener("popstate", (event) => {
    window.poppingState = true;
    handleRoute();
    window.poppingState = false;
  });

  // Show welcome screen when no data folder is configured
  function showWelcomeScreen() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'block';
  }

  // Call onAppStart when the window loads
  async function onAppStart() {
    try {
      window.app = new FaveDayApp();
      await window.app.initializeConfig();
      await window.app.loadScores();

      // If we get here, data was loaded successfully - hide loading and show app
      document.getElementById('loading').style.display = 'none';

      document.getElementById('minimize-btn').addEventListener('click', () => {
        window.api.minimize();
      });

      document.getElementById('maximize-btn').addEventListener('click', () => {
        window.api.maximize();
      });

      document.getElementById('close-btn').addEventListener('click', () => {
        window.api.close();
      });

      document.getElementById('editScoreText').addEventListener('input', function() {
        window.app.updateScoreProgress(this.value.trim())
      });

      document.getElementById('editScoreText').addEventListener('keydown', function() {
        if (event.ctrlKey && event.key === 'Enter') {
          event.preventDefault(); // Prevents default behavior (optional, depending on your needs)

          // Call your submit function or trigger a form submission here
          window.app.submitScore();
        }

        if (event.key === 'Escape') {
          window.app.hideEditScore();
        }
      });

      // Handle initial route on app startup
      handleRoute();
      
      // Initialize tag hover popups
      initializeTagPopups();
    } catch (error) {
      console.error('Error loading app data:', error);
      // Show welcome screen if data loading fails (no folder configured)
      showWelcomeScreen();
    }
  }

  // Tag hover popup functionality
  function initializeTagPopups() {
    let popup = null;
    let hideTimeout = null;
    
    // Create popup element
    function createPopup() {
      if (popup && document.body.contains(popup)) return popup;
      
      popup = document.createElement('div');
      popup.className = 'tag-popup';
      document.body.appendChild(popup);
      return popup;
    }
    
    // Show popup for tag
    function showTagPopup(element, event) {
      // Only show popup if element has tag data
      if (!element.dataset || !element.dataset.tag || !element.dataset.uses) {
        return;
      }
      
      const tagData = {
        name: element.dataset.originalName || element.dataset.tag,
        uses: element.dataset.uses,
        avg: element.dataset.avg,
        peak: element.dataset.peak,
        peakCount: element.dataset.peakCount,
        isPerson: element.dataset.isPerson === 'true'
      };
      
      // Format name properly for person tags  
      const formatName = (name, isPerson) => {
        if (!isPerson) return name;
        
        // For person tags, use camelCase splitting on the original casing
        return name.replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
      };
      
      const popupEl = createPopup();
      const icon = tagData.isPerson ? '👤' : '🏷️';
      
      // Generate sparkline from year stats
      let sparklineHtml = '';
      try {
        const yearStatsData = element.dataset.yearStats || '{}';
        const yearStats = JSON.parse(yearStatsData);
        // Get full year range from app instance (available as window.app)
        const allYears = window.app && window.app.years ? window.app.years : [];
        
        
        if (allYears.length > 0) {
          const yearValues = Object.values(yearStats);
          const maxUses = yearValues.length > 0 ? Math.max(...yearValues) : 1;
          
          sparklineHtml = `
            <div class="sparkline-container">
              <span class="sparkline-label">Years:</span>
              <div class="sparkline">
                ${allYears.map(year => {
                  const uses = yearStats[year] || 0;
                  if (uses === 0) {
                    // Empty year - show as small dot
                    return `<div class="sparkline-dot" title="${year}: 0 uses"></div>`;
                  } else {
                    // Has usage - show as bar
                    const height = Math.max(3, Math.round((uses / maxUses) * 12));
                    return `<div class="sparkline-bar" style="height: ${height}px" title="${year}: ${uses} uses"></div>`;
                  }
                }).join('')}
              </div>
            </div>`;
        }
      } catch (e) {
        console.error('Sparkline error:', e);
        // Show debug info in sparkline
        sparklineHtml = `<div class="sparkline-container"><span style="color: #f00; font-size: 9px;">Debug: ${e.message}</span></div>`;
      }

      popupEl.innerHTML = `
        <div class="popup-header">
          <span class="tag-icon">${icon}</span>
          <span>${formatName(tagData.name, tagData.isPerson)}</span>
        </div>
        <div class="popup-stats">
          <div class="stat-item">
            <span class="stat-label">Uses:</span>
            <span class="stat-value">${tagData.uses}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Score:</span>
            <span class="stat-value">${tagData.avg}</span>
          </div>
        </div>
        ${sparklineHtml}
        <div class="peak-year ${tagData.isPerson ? 'person' : ''}">
          Peak: ${tagData.peak} (${tagData.peakCount} uses)
        </div>
      `;
      
      // Position popup
      const rect = element.getBoundingClientRect();
      popupEl.style.left = `${rect.left + window.scrollX}px`;
      popupEl.style.top = `${rect.bottom + window.scrollY + 5}px`;
      
      // Clear hide timeout and show popup
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      popupEl.classList.add('visible');
    }
    
    // Show chart popup for year bars/dots
    function showChartPopup(element, event) {
      const year = element.dataset.year;
      const count = parseInt(element.dataset.count);
      const avgScore = parseFloat(element.dataset.avgScore);
      const percentage = parseInt(element.dataset.percentage);
      
      const popupEl = createPopup();
      const icon = count > 0 ? '📊' : '📍';
      
      let statsContent = '';
      if (count > 0) {
        statsContent = `
          <div class="stat-item">
            <span class="stat-label">Results:</span>
            <span class="stat-value">${count} (${percentage}%)</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Score:</span>
            <span class="stat-value">${avgScore.toFixed(1)}</span>
          </div>
          <div class="chart-click-hint">Click to jump to ${year}</div>
        `;
      } else {
        statsContent = '<div class="chart-empty-note">No matches found this year</div>';
      }
      
      popupEl.innerHTML = `
        <div class="popup-header">
          <span class="tag-icon">${icon}</span>
          <span>${year}</span>
        </div>
        <div class="popup-stats">
          ${statsContent}
        </div>
      `;
      
      // Position popup below the chart element and near mouse
      const rect = element.getBoundingClientRect();
      
      // Get the chart container to position below the entire chart
      const chartContainer = element.closest('.years-chart-container');
      const containerRect = chartContainer ? chartContainer.getBoundingClientRect() : rect;
      
      // Position below the chart container, centered on the clicked element
      popupEl.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 70}px`;
      popupEl.style.top = `${containerRect.bottom + window.scrollY + 10}px`;
      
      // Clear hide timeout and show popup
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      popupEl.classList.add('visible');
    }
    
    // Hide popup
    function hideTagPopup() {
      if (popup && popup.classList) {
        popup.classList.remove('visible');
      }
    }
    
    // Event delegation for dynamic content
    document.addEventListener('mouseenter', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && 
            (element.classList.contains('tag') || element.classList.contains('person')) && 
            element.dataset && element.dataset.tag) {
          showTagPopup(element, event);
        } else if (element && element.dataset && element.dataset.chartPopup) {
          showChartPopup(element, event);
        }
      } catch (e) {
        console.error('Popup mouseenter error:', e);
      }
    }, true);
    
    document.addEventListener('mouseleave', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && 
            (element.classList.contains('tag') || element.classList.contains('person')) && 
            element.dataset && element.dataset.tag) {
          hideTimeout = setTimeout(hideTagPopup, 300);
        } else if (element && element.dataset && element.dataset.chartPopup) {
          hideTimeout = setTimeout(hideTagPopup, 300);
        }
      } catch (e) {
        console.error('Popup mouseleave error:', e);
      }
    }, true);
    
    // Keep popup visible when hovering over it
    document.addEventListener('mouseenter', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && element.classList.contains('tag-popup')) {
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
          }
        }
      } catch (e) {
        console.error('Popup hover error:', e);
      }
    }, true);
    
    document.addEventListener('mouseleave', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && element.classList.contains('tag-popup')) {
          hideTimeout = setTimeout(hideTagPopup, 100);
        }
      } catch (e) {
        console.error('Popup leave error:', e);
      }
    }, true);
    
    // Handle clicks on chart elements
    document.addEventListener('click', (event) => {
      try {
        const element = event.target;
        
        // Check if clicking on a chart element
        if (element && element.dataset && element.dataset.chartPopup) {
          const year = element.dataset.year;
          const yearSection = document.getElementById(`year-${year}`);
          
          if (yearSection) {
            // Smooth scroll to the year section
            yearSection.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
            
            // Brief highlight animation
            yearSection.style.transition = 'background-color 0.3s ease';
            yearSection.style.backgroundColor = 'rgba(66, 153, 225, 0.1)';
            setTimeout(() => {
              yearSection.style.backgroundColor = '';
            }, 800);
          }
          return;
        }
        
        // Hide popup when clicking elsewhere
        if (popup && popup.contains && event.target && !popup.contains(event.target)) {
          hideTagPopup();
        }
      } catch (e) {
        console.error('Chart click error:', e);
      }
    });
  }
  
  function handleRoute() {
    try {
      // Ensure app is loaded before routing
      if (!window.app) {
        return;
      }
      
      // Handle Electron file:// URLs which include drive letters
      let pathname = document.location.pathname;
      // Remove the drive letter part if present (e.g., "C:/year/2014" -> "/year/2014")
      if (pathname.match(/^\/[A-Z]:\//)) {
        pathname = pathname.substring(3); // Remove "/C:" part
      }
      let path = pathname.slice(1).split('/');

      switch (path[0]) {
        case 'year':
          window.app.showYear(Number(path[1]));
          break;
        case 'years':
          window.app.showYears();
          break;
        case 'search':
          // Use wrapper function to maintain search input synchronization
          window.onShowSearch(path[1]);
          break;
        case 'month':
          window.app.showMonth(path[1], path[2]);
          break;
        case 'months':
          window.app.showMonths(path[1]);
          break;
        case 'tags':
          window.app.showTags();
          break;
        case 'analytics':
          window.onShowJourneyAnalytics();
          break;
        case 'settings':
          // Use wrapper function to handle async properly
          window.onShowSettings();
          break;
        default:
          window.app.showDashboard();
      }
    } catch (error) {
      console.error('Route handling error:', error);
      // Fallback to dashboard if routing fails
      if (window.app) {
        window.app.showDashboard();
      }
    }
  }

  // Start the app when the page loads
  window.addEventListener('DOMContentLoaded', onAppStart);

