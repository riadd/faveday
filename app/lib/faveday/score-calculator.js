/**
 * ScoreCalculator - Centralized Score Calculation System
 * 
 * Single source of truth for all score calculations in FaveDay app.
 * Handles average, median, and quality score calculations using
 * the global config store.
 */
class ScoreCalculator {
  constructor() {
    // No local config storage - uses global configStore
  }

  getScoreType() {
    return window.configStore ? window.configStore.getScoreType() : 'average';
  }

  getDefaultEmptyScore() {
    return window.configStore ? window.configStore.getDefaultEmptyScore() : null;
  }

  getLifeQualityWeights() {
    return window.configStore ? window.configStore.getLifeQualityWeights() : {
      1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
    };
  }


  /**
   * Calculate average score from scores
   * @param {Array} scores - Array of score objects
   * @param {number} expectedCount - Optional expected count for handling missing days
   * @returns {number} - Average score
   */
  calculateAverage(scores, expectedCount = null) {
    if (!scores || scores.length === 0) return 0;
    
    // Filter out empty scores
    const validScores = scores.filter(s => s.summary > 0);
    if (validScores.length === 0) return 0;
    
    const sum = validScores.reduce((total, s) => total + (s.summary || 0), 0);
    const result = sum / validScores.length;
    return isNaN(result) ? 0 : result;
  }

  /**
   * Calculate median score from scores
   * @param {Array} scores - Array of score objects
   * @returns {number} - Median score
   */
  calculateMedian(scores) {
    if (!scores || scores.length === 0) return 0;
    
    // Filter out empty scores
    const validScores = scores.filter(s => s.summary > 0).map(s => s.summary).sort((a, b) => a - b);
    if (validScores.length === 0) return 0;
    
    const middle = Math.floor(validScores.length / 2);
    
    if (validScores.length % 2 === 0) {
      const result = (validScores[middle - 1] + validScores[middle]) / 2;
      return isNaN(result) ? 0 : result;
    } else {
      const result = validScores[middle];
      return isNaN(result) ? 0 : result;
    }
  }

  /**
   * Calculate quality score from scores
   * @param {Array} scores - Array of score objects
   * @returns {number} - Quality score using life quality weights
   */
  calculateQuality(scores) {
    if (!scores || scores.length === 0) return 0;
    
    // Filter out empty scores
    const validScores = scores.filter(s => s.summary > 0);
    if (validScores.length === 0) return 0;
    
    const weights = this.getLifeQualityWeights();
    const totalQuality = validScores.reduce((sum, entry) => {
      const score = entry.summary || 0;
      const weight = weights[score] || 0;
      return sum + weight;
    }, 0);
    const result = totalQuality / validScores.length;
    return isNaN(result) ? 0 : result;
  }

  /**
   * Main calculation method - calculates score based on current settings
   * @param {Array} scores - Array of score objects
   * @param {number} expectedCount - Optional expected count for handling missing days
   * @returns {number} - Calculated score based on current score type setting
   */
  calculate(scores, expectedCount = null) {
    if (!scores || scores.length === 0) return 0;
    
    const scoreType = this.getScoreType();
    
    switch (scoreType) {
      case 'average':
        return this.calculateAverage(scores, expectedCount);
      case 'median':
        return this.calculateMedian(scores);
      case 'quality':
        return this.calculateQuality(scores);
      default:
        return this.calculateAverage(scores, expectedCount);
    }
  }

  /**
   * Get score type information (icon and name)
   * @returns {Object} - {icon: string, name: string}
   */
  getScoreTypeInfo() {
    const scoreType = this.getScoreType();
    switch (scoreType) {
      case 'average':
        return { icon: '⭐', name: 'Average' };
      case 'median':
        return { icon: '📊', name: 'Median' };
      case 'quality':
        return { icon: '✨', name: 'Quality' };
      default:
        return { icon: '⭐', name: 'Average' };
    }
  }

}

// Export for Node.js (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoreCalculator;
}