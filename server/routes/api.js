import { Router } from 'express';
import multer from 'multer';
import sql from '../db.js';
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

function getFileContentType(fileType) {
  switch (fileType) {
    case 'pdf': return 'application/pdf';
    case 'word': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'excel': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default: return 'application/octet-stream';
  }
}

function getFileTypeFromName(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  return 'file';
}

// File upload/download for KBB documents (stored as BLOBs in Turso)
router.post('/kbb_documents/:id/file', upload.single('file'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const fileType = getFileTypeFromName(file.originalname);
    await sql.execute({
      sql: `UPDATE kbb_documents
            SET file_blob = :file_blob, file_url = :file_url, file_type = :file_type, updated_date = :updated_date
            WHERE id = :id`,
      args: {
        id,
        file_blob: file.buffer,
        file_url: file.originalname,
        file_type: fileType,
        updated_date: new Date().toISOString(),
      },
    });

    const row = await db.KBBDocument.get(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.get('/kbb_documents/:id/file', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rs = await sql.execute({
      sql: `SELECT file_blob, file_url, file_type FROM kbb_documents WHERE id = :id`,
      args: { id },
    });
    const row = rs.rows[0];
    if (!row || !row.file_blob) {
      return res.status(404).json({ error: 'File not found' });
    }

    const buffer = Buffer.from(row.file_blob);
    res.setHeader('Content-Type', getFileContentType(row.file_type));
    res.setHeader('Content-Disposition', `inline; filename="${row.file_url || 'document'}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

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
