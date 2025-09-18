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
    if (!scores) scores = [];

    const validScores = scores.filter(s => (s.summary || 0) > 0);
    const defaultEmptyScore = this.getDefaultEmptyScore();
    if (expectedCount == null || defaultEmptyScore == null) expectedCount = validScores.length;

    let sum = validScores.reduce((total, s) => total + s.summary, 0);
    sum += (expectedCount - validScores.length) * defaultEmptyScore;
    
    const result = sum / expectedCount;
    return isNaN(result) ? 0 : result;
  }

  /**
   * Calculate median score from scores
   * @param {Array} scores - Array of score objects
   * @param {number} expectedCount - Optional expected count for handling missing days
   * @returns {number} - Median score
   */
  calculateMedian(scores, expectedCount = null) {
    if (!scores) scores = [];

    const validScores = scores.filter(s => s.summary > 0);
    const defaultEmptyScore = this.getDefaultEmptyScore();
    if (expectedCount == null || defaultEmptyScore == null) expectedCount = validScores.length;

    // Build array with valid scores and default scores for missing entries
    let allScores = validScores.map(s => s.summary);
    const missingCount = expectedCount - validScores.length;
    for (let i = 0; i < missingCount; i++) {
      allScores.push(defaultEmptyScore || 0);
    }
    
    allScores.sort((a, b) => a - b);
    const middle = Math.floor(allScores.length / 2);
    
    if (allScores.length % 2 === 0) {
      const result = (allScores[middle - 1] + allScores[middle]) / 2;
      return isNaN(result) ? 0 : result;
    } else {
      const result = allScores[middle];
      return isNaN(result) ? 0 : result;
    }
  }

  /**
   * Calculate quality score from scores
   * @param {Array} scores - Array of score objects
   * @param {number} expectedCount - Optional expected count for handling missing days
   * @returns {number} - Quality score using life quality weights
   */
  calculateQuality(scores, expectedCount = null) {
    if (!scores) scores = [];

    const validScores = scores.filter(s => s.summary > 0);
    const defaultEmptyScore = this.getDefaultEmptyScore();
    if (expectedCount == null || defaultEmptyScore == null) expectedCount = validScores.length;

    const weights = this.getLifeQualityWeights();
    let totalQuality = validScores.reduce((sum, entry) => {
      const score = entry.summary || 0;
      const weight = weights[score] || 0;
      return sum + weight;
    }, 0);
    
    // Add quality weight for default scores applied to missing entries
    const defaultWeight = weights[defaultEmptyScore] || 0;
    totalQuality += (expectedCount - validScores.length) * defaultWeight;
    
    const result = totalQuality / expectedCount;
    return isNaN(result) ? 0 : result;
  }

  /**
   * Main calculation method - calculates score based on current settings
   * @param {Array} scores - Array of score objects
   * @param {number} expectedCount - Optional expected count for handling missing days
   * @returns {number} - Calculated score based on current score type setting
   */
  calculate(scores, expectedCount = null) {
    if (!scores) scores = [];
    
    const scoreType = this.getScoreType();
    
    switch (scoreType) {
      case 'average':
        return this.calculateAverage(scores, expectedCount);
      case 'median':
        return this.calculateMedian(scores, expectedCount);
      case 'quality':
        return this.calculateQuality(scores, expectedCount);
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