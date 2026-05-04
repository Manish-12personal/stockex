/**
 * Environment Configuration Utility
 * 
 * Clean and scalable environment-based URL configuration
 * Follows SOLID principles with single responsibility
 */

class EnvironmentConfig {
  constructor() {
    this.isProduction = this.detectProduction();
    this.baseUrl = this.getBaseUrl();
    this.callbackUrl = this.getCallbackUrl();
  }

  /**
   * Detect if we're in production environment
   */
  detectProduction() {
    // Debug environment variables
    console.log('Environment Debug:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
    
    // Check multiple indicators for production
    const isProduction = (
      process.env.NODE_ENV === 'production' ||
      process.env.FRONTEND_URL?.includes('stockex.in') ||
      process.env.FRONTEND_URL?.includes('https://stockex.com')
    );
    
    console.log('Production detected:', isProduction);
    return isProduction;
  }

  /**
   * Get base URL based on environment
   */
  getBaseUrl() {
    if (this.isProduction) {
      return process.env.FRONTEND_URL || 'https://stockex.in';
    }
    return 'http://localhost:3000';
  }

  /**
   * Get callback URL for Zerodha OAuth
   */
  getCallbackUrl() {
    if (this.isProduction) {
      return 'https://stockex.in/api/zerodha/callback';
    }
    return 'http://localhost:5001/api/zerodha/callback';
  }

  /**
   * Get dashboard redirect URLs
   */
  getDashboardUrls() {
    const baseUrl = this.baseUrl;
    return {
      success: `${baseUrl}/superadmin/dashboard?zerodha=connected`,
      error: `${baseUrl}/superadmin/dashboard?zerodha=error`
    };
  }

  /**
   * Get environment info for logging
   */
  getEnvironmentInfo() {
    return {
      isProduction: this.isProduction,
      baseUrl: this.baseUrl,
      callbackUrl: this.callbackUrl,
      dashboardUrls: this.getDashboardUrls()
    };
  }
}

// Export singleton instance
const environmentConfig = new EnvironmentConfig();
export default environmentConfig;
