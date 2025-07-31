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
   * Prepares scores for calculation by handling empty scores according to config
   * @param {Array} scores - Array of score objects with .summary property
   * @returns {Array} - Processed scores ready for calculation
   */
  prepareScores(scores) {
    if (!scores || scores.length === 0) return [];
    
    const defaultEmptyScore = this.getDefaultEmptyScore();
    
    if (defaultEmptyScore !== null) {
      // Replace empty scores with default value
      return scores.map(s => ({
        ...s,
        summary: (s.summary > 0) ? s.summary : defaultEmptyScore
      }));
    } else {
      // Skip empty scores (original behavior)
      return scores.filter(s => s.summary > 0);
    }
  }

  /**
   * Calculate average score from prepared scores
   * @param {Array} preparedScores - Scores already processed by prepareScores
   * @param {number} expectedCount - Optional expected count for handling missing days not in array
   * @param {number} originalCount - Original count before prepareScores processing
   * @returns {number} - Average score
   */
  calculateAverage(preparedScores, expectedCount = null, originalCount = null) {
    if (preparedScores.length === 0 && !expectedCount) return 0;
    
    // If expectedCount provided and we have fewer original scores than expected,
    // add missing days with default score
    if (expectedCount && originalCount !== null && expectedCount > originalCount) {
      const defaultEmptyScore = this.getDefaultEmptyScore();
      if (defaultEmptyScore !== null && !isNaN(defaultEmptyScore)) {
        // Calculate sum of existing scores (already includes defaults from prepareScores)
        const existingSum = preparedScores.reduce((sum, s) => sum + (s.summary || 0), 0);
        // Add contribution from completely missing days (not even in the original array)
        const missingDays = expectedCount - originalCount;
        const missingSum = missingDays * defaultEmptyScore;
        const result = (existingSum + missingSum) / expectedCount;
        return isNaN(result) ? 0 : result;
      }
    }
    
    // Standard calculation using prepared scores
    if (preparedScores.length === 0) return 0;
    
    // Use manual average calculation to avoid potential Sugar.js issues
    const sum = preparedScores.reduce((total, s) => total + (s.summary || 0), 0);
    const result = sum / preparedScores.length;
    return isNaN(result) ? 0 : result;
  }

  /**
   * Calculate median score from prepared scores
   * @param {Array} preparedScores - Scores already processed by prepareScores
   * @returns {number} - Median score
   */
  calculateMedian(preparedScores) {
    if (preparedScores.length === 0) return 0;
    
    // Manual median calculation to avoid potential Sugar.js issues
    const scores = preparedScores.map(s => s.summary || 0).sort((a, b) => a - b);
    const middle = Math.floor(scores.length / 2);
    
    if (scores.length % 2 === 0) {
      const result = (scores[middle - 1] + scores[middle]) / 2;
      return isNaN(result) ? 0 : result;
    } else {
      const result = scores[middle];
      return isNaN(result) ? 0 : result;
    }
  }

  /**
   * Calculate quality score from prepared scores
   * @param {Array} preparedScores - Scores already processed by prepareScores
   * @returns {number} - Quality score using life quality weights
   */
  calculateQuality(preparedScores) {
    if (preparedScores.length === 0) return 0;
    
    const weights = this.getLifeQualityWeights();
    const totalQuality = preparedScores.reduce((sum, entry) => {
      const score = entry.summary || 0;
      const weight = weights[score] || 0;
      return sum + weight;
    }, 0);
    const result = totalQuality / preparedScores.length;
    return isNaN(result) ? 0 : result;
  }

  /**
   * Main calculation method - calculates score based on current settings
   * @param {Array} scores - Raw score array
   * @param {number} expectedCount - Optional expected count for handling missing days
   * @returns {number} - Calculated score based on current score type setting
   */
  calculate(scores, expectedCount = null) {
    const originalCount = scores ? scores.length : 0;
    const preparedScores = this.prepareScores(scores);
    if (preparedScores.length === 0 && !expectedCount) return 0;
    
    const scoreType = this.getScoreType();
    
    switch (scoreType) {
      case 'average':
        return this.calculateAverage(preparedScores, expectedCount, originalCount);
      case 'median':
        return this.calculateMedian(preparedScores);
      case 'quality':
        return this.calculateQuality(preparedScores);
      default:
        return this.calculateAverage(preparedScores, expectedCount, originalCount);
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