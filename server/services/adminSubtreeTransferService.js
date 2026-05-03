import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import User from '../models/User.js';

function childHierarchyPath(parent) {
  const p = parent?.hierarchyPath || [];
  return [...p, parent._id];
}

function resolveOfficeType(adminDoc) {
  return adminDoc?.officePartnerType === 'INTERNAL' ? 'INTERNAL' : 'EXTERNAL';
}

/** @param {import('mongoose').Query} q */
function withSessionMaybe(q, session) {
  return session ? q.session(session) : q;
}

function txnLikelyUnsupported(err) {
  const m = String(err?.message || '');
  return /replica set|Transaction numbers|not supported|MongooseError.*transaction|IllegalOperation/i.test(
    m
  );
}

async function executeTransfer(fromAdminId, toAdminId, session) {
  const fromIdStr = String(fromAdminId);
  const toIdStr = String(toAdminId);

  const fromAdmin = await withSessionMaybe(Admin.findById(fromIdStr), session);
  const toAdmin = await withSessionMaybe(Admin.findById(toIdStr), session);

  if (!fromAdmin || !toAdmin) {
    throw new Error('Admin not found');
  }
  if (fromAdmin.role !== 'ADMIN' || toAdmin.role !== 'ADMIN') {
    throw new Error('Subtree transfer only applies between ADMIN accounts');
  }
  if (fromAdmin.status !== 'ACTIVE' || toAdmin.status !== 'ACTIVE') {
    throw new Error('Both admins must be ACTIVE');
  }
  if (resolveOfficeType(fromAdmin) !== 'EXTERNAL') {
    throw new Error('Source admin must be EXTERNAL (outside partner)');
  }
  if (resolveOfficeType(toAdmin) !== 'INTERNAL') {
    throw new Error('Destination admin must be INTERNAL (office)');
  }

  const dstInsideSrc = await withSessionMaybe(
    Admin.countDocuments({
      _id: toAdmin._id,
      hierarchyPath: fromAdmin._id,
    }),
    session
  );
  if (dstInsideSrc > 0) {
    throw new Error('Destination admin cannot belong to source admin subtree');
  }

  const descendants = await withSessionMaybe(
    Admin.find({ hierarchyPath: fromAdmin._id }).sort({ hierarchyLevel: 1, role: 1 }),
    session
  );

  const descendantIds = descendants.map((d) => d._id);
  const subtreeManagerIds = [fromAdmin._id, ...descendantIds];

  const userQ = User.find({
    admin: { $in: subtreeManagerIds },
    deletedAt: null,
  }).select('_id admin adminCode creatorRole isActive createdBy');
  const users = await withSessionMaybe(userQ, session).lean();

  if (descendants.length === 0 && users.length === 0) {
    throw new Error('No brokers, sub-brokers, or users under this admin to transfer');
  }

  const brokersToReparent = descendants.filter(
    (d) => d.role === 'BROKER' && d.parentId && String(d.parentId) === fromIdStr
  );

  for (const br of brokersToReparent) {
    const newPath = childHierarchyPath(toAdmin);
    await withSessionMaybe(
      Admin.updateOne(
        { _id: br._id },
        { $set: { parentId: toAdmin._id, hierarchyPath: newPath } }
      ),
      session
    );
  }

  const subBrokers = descendants.filter((d) => d.role === 'SUB_BROKER');
  for (const sb of subBrokers) {
    const parentBroker = await withSessionMaybe(Admin.findById(sb.parentId), session);
    if (!parentBroker || parentBroker.role !== 'BROKER') {
      throw new Error(
        `Sub-broker ${sb.adminCode || sb.username || sb._id}: invalid broker parent`
      );
    }
    await withSessionMaybe(
      Admin.updateOne(
        { _id: sb._id },
        { $set: { hierarchyPath: childHierarchyPath(parentBroker) } }
      ),
      session
    );
  }

  const deltas = {};

  function bump(id, dt, da) {
    const k = String(id);
    if (!deltas[k]) deltas[k] = { t: 0, a: 0 };
    deltas[k].t += dt;
    deltas[k].a += da;
  }

  for (const u of users) {
    const directUnderSource = String(u.admin) === fromIdStr;
    const activeBump = u.isActive ? 1 : 0;

    if (directUnderSource) {
      bump(fromIdStr, -1, -activeBump);
      bump(toIdStr, 1, activeBump);
      await withSessionMaybe(
        User.updateOne(
          { _id: u._id },
          {
            $set: {
              admin: toAdmin._id,
              adminCode: toAdmin.adminCode,
              creatorRole: toAdmin.role,
              createdBy: toAdmin._id,
              hierarchyPath: childHierarchyPath(toAdmin),
            },
          }
        ),
        session
      );
    } else {
      const mgr = await withSessionMaybe(Admin.findById(u.admin), session);
      if (!mgr) {
        throw new Error(`User ${u._id}: managing admin missing`);
      }
      await withSessionMaybe(
        User.updateOne(
          { _id: u._id },
          { $set: { hierarchyPath: childHierarchyPath(mgr) } }
        ),
        session
      );
    }
  }

  for (const [aid, { t, a }] of Object.entries(deltas)) {
    if (t === 0 && a === 0) continue;
    await withSessionMaybe(
      Admin.updateOne(
        { _id: aid },
        {
          $inc: {
            'stats.totalUsers': t,
            'stats.activeUsers': a,
          },
        }
      ),
      session
    );
  }

  return {
    movedBrokers: brokersToReparent.length,
    movedSubBrokers: subBrokers.length,
    movedUsers: users.length,
    fromAdmin: {
      _id: fromAdmin._id,
      username: fromAdmin.username,
      adminCode: fromAdmin.adminCode,
    },
    toAdmin: {
      _id: toAdmin._id,
      username: toAdmin.username,
      adminCode: toAdmin.adminCode,
    },
  };
}

export async function transferExternalAdminSubtreeToInternalAdmin({
  fromAdminId,
  toAdminId,
}) {
  if (String(fromAdminId) === String(toAdminId)) {
    throw new Error('Source and destination admin must differ');
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    try {
      const summary = await executeTransfer(fromAdminId, toAdminId, session);
      await session.commitTransaction();
      return summary;
    } catch (e) {
      await session.abortTransaction().catch(() => {});
      throw e;
    } finally {
      session.endSession();
    }
  } catch (outer) {
    if (txnLikelyUnsupported(outer)) {
      console.warn('[adminSubtreeTransfer]', outer.message || outer);
      return executeTransfer(fromAdminId, toAdminId, null);
    }
    throw outer;
  }
}
