/**
 * Ordered unique Admin ObjectIds (as strings) for merging hierarchy restrictions.
 * Prefer User.hierarchyPath when set (full ancestor chain including immediate manager),
 * and always fold in the direct manager document when populated.
 */
export function collectHierarchyAdminIds(userLike) {
  const out = [];
  const seen = new Set();
  function push(id) {
    if (id == null || id === '') return;
    const s =
      typeof id === 'object' && id != null && typeof id.toString === 'function'
        ? id.toString()
        : String(id);
    if (!s || s === 'undefined') return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  }

  const hpUser = userLike?.hierarchyPath;
  if (Array.isArray(hpUser)) {
    for (const id of hpUser) push(id);
  }

  const adm = userLike?.admin;
  if (adm && typeof adm === 'object') {
    const hpAdm = adm.hierarchyPath;
    if (Array.isArray(hpAdm)) {
      for (const id of hpAdm) push(id);
    }
    if (adm._id != null) push(adm._id);
  } else if (adm != null && typeof adm !== 'object') {
    push(adm);
  }

  return out;
}
