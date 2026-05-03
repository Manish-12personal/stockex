/**
 * Brokerage Restriction Service
 * Handles brokerage restriction logic for games and trading segments
 * Follows SOLID principles with single responsibility
 */

/**
 * Check if games brokerage is restricted for an admin
 * @param {Object} admin - Admin document
 * @returns {boolean} - True if games brokerage is restricted
 */
export function isGamesBrokerageRestricted(admin) {
  if (!admin || !admin.restrictMode) return false;
  return admin.restrictMode.restrictBrokerage?.games === true;
}

/**
 * Check if trading brokerage is restricted for an admin
 * @param {Object} admin - Admin document
 * @returns {boolean} - True if trading brokerage is restricted
 */
export function isTradingBrokerageRestricted(admin) {
  if (!admin || !admin.restrictMode) return false;
  return admin.restrictMode.restrictBrokerage?.trading === true;
}

/**
 * Unified check to determine if brokerage should be redirected to Super Admin
 * @param {Object} admin - Admin document
 * @param {string} segment - 'games' | 'trading'
 * @returns {boolean} - True if brokerage should be redirected to Super Admin
 */
export function shouldRedirectBrokerageToSuperAdmin(admin, segment) {
  if (!admin || !segment) return false;
  
  switch (segment.toLowerCase()) {
    case 'games':
      return isGamesBrokerageRestricted(admin);
    case 'trading':
      return isTradingBrokerageRestricted(admin);
    default:
      return false;
  }
}

/**
 * Get brokerage restriction status for both segments
 * @param {Object} admin - Admin document
 * @returns {Object} - Restriction status for games and trading
 */
export function getBrokerageRestrictionStatus(admin) {
  if (!admin || !admin.restrictMode) {
    return {
      games: false,
      trading: false,
      anyRestricted: false
    };
  }

  const gamesRestricted = isGamesBrokerageRestricted(admin);
  const tradingRestricted = isTradingBrokerageRestricted(admin);

  return {
    games: gamesRestricted,
    trading: tradingRestricted,
    anyRestricted: gamesRestricted || tradingRestricted
  };
}

/**
 * Validate brokerage restriction data
 * @param {Object} data - Restriction data to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validateBrokerageRestrictionData(data) {
  const errors = [];
  
  if (data.restrictBrokerage) {
    if (typeof data.restrictBrokerage.games !== 'boolean') {
      errors.push('Games brokerage restriction must be a boolean');
    }
    if (typeof data.restrictBrokerage.trading !== 'boolean') {
      errors.push('Trading brokerage restriction must be a boolean');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
