/**
 * SettingsManager - User Configuration and Settings Management
 * 
 * Handles all user configuration settings including birthdate, score types,
 * life quality weights, and default empty scores. Provides the settings UI
 * and form handling logic.
 */
class SettingsManager {
  constructor(scoreCalculator, router, dataManager) {
    this.scoreCalculator = scoreCalculator;
    this.router = router;
    this.dataManager = dataManager;
  }

  /**
   * Display the settings page
   * @returns {string} Rendered HTML content
   */
  async showSettings() {
    const config = await window.api.getConfig();
    const defaultWeights = await this.scoreCalculator.getLifeQualityWeights();
    
    this.router.pushHistory('/settings', 'Settings');
    
    const scoreType = config.scoreType || 'average';
    
    // Use the render method from the main app (passed through context)
    const renderResult = window.app.render('#tmpl-settings', '#content', {
      birthdate: config.birthdate || '',
      currentFolder: config.filesPath || 'Not set',
      lifeQualityWeights: config.lifeQualityWeights || defaultWeights,
      years: this.dataManager.getYears().map(y => ({year: y})),
      scoreTypeAverage: scoreType === 'average',
      scoreTypeQuality: scoreType === 'quality',
      scoreTypeMedian: scoreType === 'median',
      defaultEmptyScore: config.defaultEmptyScore !== null ? config.defaultEmptyScore : ''
    }, {
      yearsBar: window.Hogan.compile($('#tmpl-years-bar').html())
    });
    
    // Initialize life quality preview if quality score type is selected
    if (scoreType === 'quality') {
      // Use setTimeout to ensure DOM is updated first
      setTimeout(() => {
        this.updateLifeQualityPreview(config.lifeQualityWeights || defaultWeights);
      }, 10);
    }
    
    return renderResult;
  }

  /**
   * Save user's birthdate
   */
  async saveBirthdate() {
    const birthdateInput = document.getElementById('birthdate-input');
    const birthdate = birthdateInput.value;
    
    if (birthdate) {
      await window.api.setBirthdate(birthdate);
      this.showSuccessMessage('Birthdate saved');
      // Refresh dashboard to show new progress
      window.app.showDashboard();
    }
  }

  /**
   * Save life quality weights configuration
   */
  async saveLifeQualityWeights() {
    const weights = {
      1: parseFloat(document.getElementById('weight-1').value) || 0.2,
      2: parseFloat(document.getElementById('weight-2').value) || 1.0,
      3: parseFloat(document.getElementById('weight-3').value) || 3.0,
      4: parseFloat(document.getElementById('weight-4').value) || 8.0,
      5: parseFloat(document.getElementById('weight-5').value) || 25.0
    };
    
    await window.api.setLifeQualityWeights(weights);
    // Update config store since settings changed
    window.configStore.set('lifeQualityWeights', weights);
    this.updateLifeQualityPreview(weights);
    
    // Show toast notification
    this.showSuccessMessage('Life quality weights saved');
    
    // Show button confirmation
    const button = document.querySelector('.button-group .btn-primary');
    if (button) {
      const originalText = button.textContent;
      button.textContent = '✓ Saved!';
      button.style.background = '#28a745';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#007cba';
      }, 2000);
    }
    
    // Refresh current view if not on settings
    if (this.router.getCurrentRoute() !== '/settings') {
      this.refreshCurrentView();
    }
  }

  /**
   * Reset life quality weights to default values
   */
  async resetLifeQualityWeights() {
    const defaultWeights = {
      1: 0.2, 2: 1.0, 3: 3.0, 4: 8.0, 5: 25.0
    };
    
    // Update form inputs
    document.getElementById('weight-1').value = defaultWeights[1];
    document.getElementById('weight-2').value = defaultWeights[2];
    document.getElementById('weight-3').value = defaultWeights[3];
    document.getElementById('weight-4').value = defaultWeights[4];
    document.getElementById('weight-5').value = defaultWeights[5];
    
    this.updateLifeQualityPreview(defaultWeights);
  }

  /**
   * Update the life quality preview with given weights
   * @param {Object} weights - Quality weights configuration
   */
  async updateLifeQualityPreview(weights) {
    // Only update if the preview element exists (Quality section is visible)
    const previewElement = document.getElementById('preview-text');
    if (!previewElement) {
      return; // Element not in DOM, likely because Quality mode is not selected
    }
    
    // Calculate preview with sample data
    const allScores = this.dataManager.getAllScores();
    
    if (allScores && allScores.length > 0) {
      const recentEntries = allScores.slice(-30); // Last 30 entries
      const totalQuality = recentEntries.reduce((sum, entry) => {
        const score = entry.summary || 0;
        return sum + (weights[score] || 0);
      }, 0);
      const avgQuality = (totalQuality / recentEntries.length).toFixed(2);
      
      previewElement.textContent = 
        `Recent life quality: ${avgQuality} (based on last ${recentEntries.length} entries)`;
    } else {
      previewElement.textContent = 
        'Preview will show once you have diary entries';
    }
  }

  /**
   * Show a success message to the user
   * @param {string} message - Message to display
   */
  showSuccessMessage(message) {
    // Create or update a toast notification
    let toast = document.getElementById('settings-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'settings-toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 1000;
        font-size: 14px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = `✓ ${message}`;
    toast.style.transform = 'translateX(0)';
    
    // Hide after 3 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
    }, 3000);
  }

  /**
   * Refresh the current view to show updated scores
   */
  refreshCurrentView() {
    const currentRoute = this.router.getCurrentRoute();
    
    // Trigger a re-render of the current view by calling the appropriate navigation function
    if (currentRoute === '/' || currentRoute === '') {
      window.onShowDashboard();
    } else if (currentRoute.startsWith('/years')) {
      window.onShowYears();
    } else if (currentRoute.startsWith('/year/')) {
      const year = currentRoute.split('/')[2];
      window.onShowYear(year);
    } else if (currentRoute.startsWith('/month/')) {
      const monthId = currentRoute.split('/')[2];
      window.onShowMonth(monthId);
    } else if (currentRoute.startsWith('/search/')) {
      const query = decodeURIComponent(currentRoute.split('/')[2]);
      window.onShowSearch(query);
    }
  }

  /**
   * Set the score calculation type (average, median, quality)
   * @param {string} scoreType - Type of score calculation
   */
  async setScoreType(scoreType) {
    await window.api.setScoreType(scoreType);
    // Update config store since settings changed
    window.configStore.set('scoreType', scoreType);
    
    // Show visual feedback
    this.showSuccessMessage(`Score type changed to ${scoreType.charAt(0).toUpperCase() + scoreType.slice(1)}`);
    
    // Refresh settings page to show/hide quality formula section
    this.showSettings();
    
    // Trigger a refresh of the current view if it's not settings
    if (this.router.getCurrentRoute() !== '/settings') {
      this.refreshCurrentView();
    }
  }

  /**
   * Save the default empty score value
   */
  async saveDefaultEmptyScore() {
    const defaultEmptyScoreInput = document.getElementById('default-score-input');
    const defaultEmptyScore = defaultEmptyScoreInput.value;
    
    await window.api.setDefaultEmptyScore(defaultEmptyScore);
    // Update config store since settings changed
    window.configStore.set('defaultEmptyScore', defaultEmptyScore);
    
    // Show toast notification
    const scoreText = defaultEmptyScore ? `Default empty score set to ${defaultEmptyScore}` : 'Default empty score disabled';
    this.showSuccessMessage(scoreText);
    
    // Show button confirmation
    const button = defaultEmptyScoreInput.nextElementSibling;
    if (button) {
      const originalText = button.textContent;
      button.textContent = '✓ Saved!';
      button.style.background = '#28a745';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#007cba';
      }, 2000);
    }
    
    // Refresh current view if not on settings
    if (this.router.getCurrentRoute() !== '/settings') {
      this.refreshCurrentView();
    }
  }

  /**
   * Get current configuration from API
   * @returns {Object} Current configuration object
   */
  async getConfig() {
    return await window.api.getConfig();
  }

  /**
   * Validate settings form inputs
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateSettings() {
    const errors = [];
    
    // Validate birthdate if provided
    const birthdateInput = document.getElementById('birthdate-input');
    if (birthdateInput && birthdateInput.value) {
      const birthdate = new Date(birthdateInput.value);
      if (isNaN(birthdate.getTime())) {
        errors.push('Invalid birthdate format');
      } else if (birthdate > new Date()) {
        errors.push('Birthdate cannot be in the future');
      }
    }
    
    // Validate weight inputs
    for (let i = 1; i <= 5; i++) {
      const weightInput = document.getElementById(`weight-${i}`);
      if (weightInput) {
        const value = parseFloat(weightInput.value);
        if (isNaN(value) || value < 0) {
          errors.push(`Weight for score ${i} must be a positive number`);
        }
      }
    }
    
    // Validate default empty score
    const defaultEmptyScoreInput = document.getElementById('default-score-input');
    if (defaultEmptyScoreInput && defaultEmptyScoreInput.value !== '') {
      const value = parseFloat(defaultEmptyScoreInput.value);
      if (isNaN(value) || value < 1 || value > 5) {
        errors.push('Default empty score must be between 1 and 5');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

// Export for Node.js (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsManager;
}