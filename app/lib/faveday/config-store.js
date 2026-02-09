/**
 * ConfigStore - Single Source of Truth for Application Configuration
 * 
 * Simple synchronous config storage that eliminates the need for async calls
 * and prevents data duplication across modules.
 */
class ConfigStore {
  constructor() {
    // Default configuration
    this.config = {
      scoreType: 'average',
      defaultEmptyScore: null,
      lifeQualityWeights: {
        1: 0.2,  // Disasters have minimal impact
        2: 1.0,  // Routine days are the baseline
        3: 3.0,  // Good days are 3x routine
        4: 8.0,  // Great days are 8x routine  
        5: 25.0  // Unforgettable days are 25x routine
      },
      birthdate: null,
      filesPath: null,
      wordCountGoal: 100
    };
  }

  /**
   * Load configuration from API (called once at app startup)
   * @param {Object} apiConfig - Configuration from window.api.getConfig()
   */
  load(apiConfig) {
    if (apiConfig) {
      this.config = { ...this.config, ...apiConfig };
    }
  }

  /**
   * Update a specific config value
   * @param {string} key - Config key to update
   * @param {*} value - New value
   */
  set(key, value) {
    this.config[key] = value;
  }

  /**
   * Get a specific config value
   * @param {string} key - Config key to retrieve
   * @returns {*} Config value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Get the entire config object
   * @returns {Object} Complete configuration
   */
  getAll() {
    return { ...this.config }; // Return copy to prevent external mutation
  }

  // Convenience getters for commonly used config
  getScoreType() {
    return this.config.scoreType || 'average';
  }

  getDefaultEmptyScore() {
    return this.config.defaultEmptyScore;
  }

  getLifeQualityWeights() {
    return this.config.lifeQualityWeights || {
      1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
    };
  }

  getBirthdate() {
    return this.config.birthdate;
  }

  getFilesPath() {
    return this.config.filesPath;
  }

  getWordCountGoal() {
    return this.config.wordCountGoal || 100;
  }
}

// Create singleton instance
const configStore = new ConfigStore();

// Export singleton for browser
if (typeof window !== 'undefined') {
  window.configStore = configStore;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = configStore;
}