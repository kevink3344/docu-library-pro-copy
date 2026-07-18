import { Router } from 'express';
import {
  db,
  getOrgsForUser,
  getOrgMembersWithUsers,
  addOrgMember,
  addExistingUserToOrg,
  updateOrgMember,
  removeOrgMember,
} from '../lib/db.js';

const router = Router();
const entityNames = Object.keys(db);

router.get('/:entity', async (req, res, next) => {
  const { entity } = req.params;
  if (!entityNames.includes(entity)) {
    return res.status(404).json({ error: 'Unknown entity' });
  }
  try {
    res.json(await db[entity].list());
  } catch (err) {
    next(err);
  }
});

router.post('/:entity/filter', async (req, res, next) => {
  const { entity } = req.params;
  if (!entityNames.includes(entity)) {
    return res.status(404).json({ error: 'Unknown entity' });
  }
  try {
    const { where = {}, sort = null, limit = null } = req.body || {};
    res.json(await db[entity].filter(where, sort, limit));
  } catch (err) {
    next(err);
  }
});

router.get('/:entity/:id', async (req, res, next) => {
  const { entity, id } = req.params;
  if (!entityNames.includes(entity)) {
    return res.status(404).json({ error: 'Unknown entity' });
  }
  try {
    const row = await db[entity].get(id);
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/:entity', async (req, res, next) => {
  const { entity } = req.params;
  if (!entityNames.includes(entity)) {
    return res.status(404).json({ error: 'Unknown entity' });
  }
  try {
    const row = await db[entity].create(req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.patch('/:entity/:id', async (req, res, next) => {
  const { entity, id } = req.params;
  if (!entityNames.includes(entity)) {
    return res.status(404).json({ error: 'Unknown entity' });
  }
  try {
    res.json(await db[entity].update(id, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/:entity/:id', async (req, res, next) => {
  const { entity, id } = req.params;
  if (!entityNames.includes(entity)) {
    return res.status(404).json({ error: 'Unknown entity' });
  }
  try {
    await db[entity].delete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/rpc/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const body = req.body || {};

    switch (name) {
      case 'getOrgsForUser': {
        const rows = await getOrgsForUser(body.userId, body.userRole);
        return res.json(rows);
      }
      case 'getOrgMembersWithUsers': {
        const rows = await getOrgMembersWithUsers(body.orgId);
        return res.json(rows);
      }
      case 'addOrgMember': {
        const row = await addOrgMember(body.orgId, body.form);
        return res.status(201).json(row);
      }
      case 'addExistingUserToOrg': {
        const row = await addExistingUserToOrg(body.orgId, body.userId, body.role);
        return res.status(201).json(row);
      }
      case 'updateOrgMember': {
        const row = await updateOrgMember(body.memberId, body.userId, body.data);
        return res.json(row);
      }
      case 'removeOrgMember': {
        await removeOrgMember(body.memberId);
        return res.status(204).send();
      }
      default:
        return res.status(404).json({ error: 'Unknown RPC' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
