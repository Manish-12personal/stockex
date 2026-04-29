/** Who may configure limit / SL-M gate (`allowLimitPendingOrders`) — Super Admin & Admin only (not Broker/Sub broker). */
export function canManageLimitPendingSegmentGate(role) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
