/**
 * Router - Navigation and URL Routing Management
 * 
 * Handles browser history, URL routing, and navigation between views
 * in the FaveDay application.
 */
class Router {
  constructor() {
    this.history = [];
    this.currentRoute = null;
  }

  /**
   * Push a new route to browser history
   * @param {string} url - Route URL (e.g., '/dashboard', '/month/2024/1')
   * @param {string} title - Page title for browser
   */
  pushHistory(url, title) {
    // Update browser history
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ url, title }, title, url);
    }
    
    // Update document title
    if (typeof document !== 'undefined') {
      document.title = title;
    }
    
    // Update internal history
    this.history.push({ url, title, timestamp: Date.now() });
    this.currentRoute = { url, title };
  }

  /**
   * Navigate back in history
   */
  goBack() {
    if (typeof window !== 'undefined' && window.history) {
      window.history.back();
    }
  }

  /**
   * Navigate forward in history
   */
  goForward() {
    if (typeof window !== 'undefined' && window.history) {
      window.history.forward();
    }
  }

  /**
   * Get current route information
   * @returns {Object} Current route with url and title
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Get navigation history
   * @returns {Array} Array of route objects
   */
  getHistory() {
    return this.history;
  }

  /**
   * Parse route URL into components
   * @param {string} url - Route URL to parse
   * @returns {Object} Parsed route components
   */
  parseRoute(url) {
    if (!url || url === '/') {
      return { view: 'dashboard', params: {} };
    }

    // Remove leading slash
    const path = url.startsWith('/') ? url.slice(1) : url;
    const parts = path.split('/');
    const view = parts[0];
    
    const route = { view, params: {} };
    
    // Parse common route patterns
    switch (view) {
      case 'month':
        if (parts.length >= 3) {
          route.params.year = parseInt(parts[1]);
          route.params.month = parseInt(parts[2]);
        }
        break;
        
      case 'year':
        if (parts.length >= 2) {
          route.params.year = parseInt(parts[1]);
        }
        break;
        
      case 'search':
        if (parts.length >= 2) {
          route.params.query = decodeURIComponent(parts[1]);
        }
        break;
        
      case 'tags':
        if (parts.length >= 2) {
          route.params.sortBy = parts[1];
        }
        break;
        
      default:
        // Simple routes without parameters
        break;
    }
    
    return route;
  }

  /**
   * Build URL from route components
   * @param {string} view - View name
   * @param {Object} params - Route parameters
   * @returns {string} Built URL
   */
  buildRoute(view, params = {}) {
    let url = `/${view}`;
    
    switch (view) {
      case 'month':
        if (params.year && params.month) {
          url += `/${params.year}/${params.month}`;
        }
        break;
        
      case 'year':
        if (params.year) {
          url += `/${params.year}`;
        }
        break;
        
      case 'search':
        if (params.query) {
          url += `/${encodeURIComponent(params.query)}`;
        }
        break;
        
      case 'tags':
        if (params.sortBy) {
          url += `/${params.sortBy}`;
        }
        break;
    }
    
    return url;
  }

  /**
   * Check if current route matches a pattern
   * @param {string} pattern - Route pattern to match
   * @returns {boolean} True if current route matches pattern
   */
  isCurrentRoute(pattern) {
    if (!this.currentRoute) return false;
    
    const current = this.parseRoute(this.currentRoute.url);
    const target = this.parseRoute(pattern);
    
    return current.view === target.view;
  }

  /**
   * Get breadcrumb navigation based on current route
   * @returns {Array} Array of breadcrumb objects with name and url
   */
  getBreadcrumbs() {
    if (!this.currentRoute) return [];
    
    const route = this.parseRoute(this.currentRoute.url);
    const breadcrumbs = [{ name: 'Home', url: '/dashboard' }];
    
    switch (route.view) {
      case 'dashboard':
        // Dashboard is home, no additional breadcrumbs
        break;
        
      case 'month':
        breadcrumbs.push({ name: 'Years', url: '/years' });
        if (route.params.year) {
          breadcrumbs.push({ 
            name: route.params.year.toString(), 
            url: `/year/${route.params.year}` 
          });
          if (route.params.month) {
            const monthNames = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ];
            breadcrumbs.push({ 
              name: monthNames[route.params.month - 1], 
              url: this.currentRoute.url 
            });
          }
        }
        break;
        
      case 'year':
        breadcrumbs.push({ name: 'Years', url: '/years' });
        if (route.params.year) {
          breadcrumbs.push({ 
            name: route.params.year.toString(), 
            url: this.currentRoute.url 
          });
        }
        break;
        
      case 'years':
        breadcrumbs.push({ name: 'Years', url: this.currentRoute.url });
        break;
        
      case 'tags':
        breadcrumbs.push({ name: 'Tags', url: this.currentRoute.url });
        break;
        
      case 'search':
        breadcrumbs.push({ name: 'Search', url: this.currentRoute.url });
        break;
        
      case 'journey-analytics':
        breadcrumbs.push({ name: 'Analytics', url: this.currentRoute.url });
        break;
        
      case 'settings':
        breadcrumbs.push({ name: 'Settings', url: this.currentRoute.url });
        break;
    }
    
    return breadcrumbs;
  }

  /**
   * Clear navigation history
   */
  clearHistory() {
    this.history = [];
    this.currentRoute = null;
  }
}

// Export for Node.js (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Router;
}