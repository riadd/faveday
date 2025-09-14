/**
 * DataManager - Centralized Data Access and Management
 * 
 * Handles all data persistence operations, score loading/saving,
 * and core data transformations for the FaveDay app.
 */
class DataManager {
  constructor() {
    this.scores = [];
    this.futureEntries = [];
    this.tagCache = null;
    this.years = [];
  }

  /**
   * Load scores from storage via IPC
   * @returns {Promise<Array>} Array of score objects
   */
  async loadScores() {
    try {
      const rawScores = await window.api.loadScores();
      
      // Convert to Score objects and sort by date
      this.scores = rawScores.map(s => new Score(new Date(s.date), s.summary, s.notes))
                            .sort((a, b) => a.date - b.date);
      
      // Extract years for navigation
      this.years = [...new Set(this.scores.map(s => s.date.getFullYear()))].sort();
      
      // Load tag cache and future entries
      this.tagCache = await window.api.getTagCache();
      this.futureEntries = await window.api.loadFutureEntries();
      
      return this.scores;
    } catch (error) {
      console.error('Failed to load scores:', error);
      throw error;
    }
  }

  /**
   * Save scores to storage via IPC
   * @param {Array} scores - Array of score objects to save
   */
  async saveScores(scores = null) {
    try {
      const scoresToSave = scores || this.scores;
      await window.api.saveScores(scoresToSave);
      
      // Update local state if we saved the current scores
      if (!scores) {
        // Reload tag cache after saving
        this.tagCache = await window.api.getTagCache();
      }
    } catch (error) {
      console.error('Failed to save scores:', error);
      throw error;
    }
  }

  /**
   * Get filtered scores by date criteria
   * @param {number} year - Year to filter by (optional)
   * @param {number} month - Month to filter by (1-12, optional)  
   * @param {number} date - Date to filter by (optional)
   * @returns {Array} Filtered scores
   */
  getScores(year = null, month = null, date = null) {
    let filtered = this.scores;
    
    if (year !== null) {
      filtered = filtered.filter(s => s.date.getFullYear() === year);
    }
    
    if (month !== null) {
      // Convert 1-12 to 0-11 for JavaScript Date
      const jsMonth = month - 1;
      filtered = filtered.filter(s => s.date.getMonth() === jsMonth);
    }
    
    if (date !== null) {
      filtered = filtered.filter(s => s.date.getDate() === date);
    }
    
    return filtered;
  }

  /**
   * Add display metadata to scores for UI rendering
   * @param {Array} scores - Raw score objects
   * @returns {Array} Enhanced scores with display properties
   */
  enhanceScoresForDisplay(scores) {
    return scores.map(score => ({
      ...score,
      dateId: score.dateId(),
      dateStr: score.dateStr(),
      monthId: score.monthId(),
      weekday: score.weekday(),
      empty: score.empty(),
      styleClass: score.styleClass(),
      summaryText: score.summaryText(),
      text: score.enhancedText(this.tagCache)
    }));
  }

  /**
   * Create demo data for testing
   * @returns {Array} Demo score objects
   */
  setupDemoUser() {
    const demoScores = [];
    const today = new Date();
    
    // Create 30 days of demo data
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      // Random score between 1-5
      const summary = Math.floor(Math.random() * 5) + 1;
      
      // Sample notes with tags
      const sampleNotes = [
        'Great day with #work and @john',
        'Relaxing #weekend with #reading',
        'Productive #coding session',
        'Nice walk in the #park with @sarah',
        'Challenging #meeting but good results',
        'Fun #dinner with @mike and #friends',
        'Quiet day with #meditation and #reflection'
      ];
      
      const notes = sampleNotes[Math.floor(Math.random() * sampleNotes.length)];
      
      demoScores.push(new Score(date, summary, notes));
    }
    
    this.scores = demoScores;
    this.years = [...new Set(demoScores.map(s => s.date.getFullYear()))].sort();
    
    return demoScores;
  }

  /**
   * Get current scores array
   * @returns {Array} Current scores
   */
  getAllScores() {
    return this.scores;
  }

  /**
   * Get available years
   * @returns {Array} Sorted array of years
   */
  getYears() {
    return this.years;
  }

  /**
   * Get tag cache
   * @returns {Object} Tag cache data
   */
  getTagCache() {
    return this.tagCache;
  }

  /**
   * Load future entries from storage via IPC
   * @returns {Promise<Array>} Array of future entry objects
   */
  async loadFutureEntries() {
    try {
      this.futureEntries = await window.api.loadFutureEntries();
      return this.futureEntries;
    } catch (error) {
      console.error('Failed to load future entries:', error);
      throw error;
    }
  }

  /**
   * Save future entries to storage via IPC
   * @param {Array} entries - Array of future entry objects to save
   */
  async saveFutureEntries(entries = null) {
    try {
      const entriesToSave = entries || this.futureEntries;
      await window.api.saveFutureEntries(entriesToSave);
      
      // Update local state if we saved the current entries
      if (!entries) {
        this.futureEntries = entriesToSave;
      }
    } catch (error) {
      console.error('Failed to save future entries:', error);
      throw error;
    }
  }

  /**
   * Get all future entries
   * @returns {Array} Array of future entry objects
   */
  getFutureEntries() {
    return this.futureEntries;
  }

  /**
   * Update local scores array and refresh derived data
   * @param {Array} newScores - New scores array
   */
  updateScores(newScores) {
    this.scores = newScores.sort((a, b) => a.date - b.date);
    this.years = [...new Set(this.scores.map(s => s.date.getFullYear()))].sort();
  }

  /**
   * Add a single score to the collection
   * @param {Score} score - Score object to add
   */
  addScore(score) {
    this.scores.push(score);
    this.updateScores(this.scores);
  }

  /**
   * Update an existing score by date
   * @param {string} dateId - Date ID in YYYY-MM-DD format
   * @param {number} summary - New summary score
   * @param {string} notes - New notes text
   */
  updateScore(dateId, summary, notes) {
    const existingIndex = this.scores.findIndex(s => s.dateId() === dateId);
    
    if (existingIndex >= 0) {
      // Update existing score
      this.scores[existingIndex].summary = summary;
      this.scores[existingIndex].notes = notes;
    } else {
      // Create new score
      const [year, month, day] = dateId.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      this.scores.push(new Score(date, summary, notes));
      this.updateScores(this.scores);
    }
  }

  /**
   * Set scores from raw data (used when loading new folder data)
   * @param {Array} rawScores - Raw score objects
   */
  setScores(rawScores) {
    this.scores = rawScores.map(s => new Score(new Date(s.date), s.summary, s.notes))
                           .sort((a, b) => a.date - b.date);
    this.years = [...new Set(this.scores.map(s => s.date.getFullYear()))].sort();
  }

  /**
   * Set future entries
   * @param {Array} entries - Future entry objects
   */
  setFutureEntries(entries) {
    this.futureEntries = entries;
  }

  /**
   * Get statistics about the current dataset
   * @returns {Object} Dataset statistics
   */
  getDatasetStats() {
    return {
      totalEntries: this.scores.length,
      years: this.years,
      dateRange: this.scores.length > 0 ? {
        start: this.scores[0].date,
        end: this.scores[this.scores.length - 1].date
      } : null,
      averageScore: this.scores.length > 0 
        ? this.scores.reduce((sum, s) => sum + s.summary, 0) / this.scores.length 
        : 0
    };
  }
}

// Export for Node.js (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataManager;
}