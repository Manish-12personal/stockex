import { shouldRedirectBrokerageToSuperAdmin } from '../services/brokerageRestrictionService.js';

/**
 * Whether an admin may receive hierarchy brokerage credits (trades / games).
 * Company employees: `receivesHierarchyBrokerage === false` → share diverted to Super Admin.
 * Disabled/closed admins: `status !== 'ACTIVE'` → share diverted to Super Admin.
 * Brokerage restrictions: `restrictBrokerage.games/trading === true` → share diverted to Super Admin.
 */

export function adminReceivesHierarchyBrokerage(admin, segment = null) {
  if (!admin) return true;
  if (admin.receivesHierarchyBrokerage === false) return false;
  if (admin.status !== 'ACTIVE') return false;
  
  // Check brokerage restriction if segment is specified
  if (segment && shouldRedirectBrokerageToSuperAdmin(admin, segment)) {
    return false;
  }
  
  return true;
}

/** @param {object} AdminModel mongoose Admin model */
export async function resolveHierarchyBrokerageRecipient(admin, AdminModel, hierarchyChain = []) {
  if (adminReceivesHierarchyBrokerage(admin)) return admin;
  const fromChain = hierarchyChain.find((h) => h.role === 'SUPER_ADMIN')?.admin;
  if (fromChain && adminReceivesHierarchyBrokerage(fromChain)) return fromChain;
  const sa =
    (await AdminModel.findOne({ role: 'SUPER_ADMIN', status: 'ACTIVE' }).select(
      'wallet stats adminCode username receivesHierarchyBrokerage'
    )) || null;
  return sa;
}
