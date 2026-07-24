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

const ENTITY_ENUM = ['Organization', 'Location', 'Department', 'KBBDocument', 'CustomField', 'FieldConfig', 'Team', 'OrgMember', 'Notification', 'User'];

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

/**
 * @openapi
 * /api/kbb_documents/{id}/file:
 *   post:
 *     summary: Upload a file for a KBB document (BLOB storage)
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: KBBDocument ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 10 MB)
 *     responses:
 *       200:
 *         description: Updated KBBDocument with file fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KBBDocument'
 *       400:
 *         description: No file uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/kbb_documents/{id}/file:
 *   get:
 *     summary: Download/stream a stored file for a KBB document
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: KBBDocument ID
 *     responses:
 *       200:
 *         description: Binary file content
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/Organization:
 *   get:
 *     summary: List all organizations
 *     tags: [Organization]
 *     responses:
 *       200:
 *         description: Array of organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *   post:
 *     summary: Create a new organization
 *     tags: [Organization]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Organization'
 *     responses:
 *       201:
 *         description: Created organization
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *
 * /api/Organization/{id}:
 *   get:
 *     summary: Get an organization by ID
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Organization object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update an organization
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Organization'
 *     responses:
 *       200:
 *         description: Updated organization
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete an organization
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *
 * /api/Location:
 *   get:
 *     summary: List all locations
 *     tags: [Location]
 *     responses:
 *       200:
 *         description: Array of locations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Location'
 *   post:
 *     summary: Create a new location
 *     tags: [Location]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Location'
 *     responses:
 *       201:
 *         description: Created location
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *
 * /api/Location/{id}:
 *   get:
 *     summary: Get a location by ID
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Location object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update a location
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Location'
 *     responses:
 *       200:
 *         description: Updated location
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete a location
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *
 * /api/Team:
 *   get:
 *     summary: List all teams
 *     tags: [Team]
 *     responses:
 *       200:
 *         description: Array of teams
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Team'
 *   post:
 *     summary: Create a new team
 *     tags: [Team]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Team'
 *     responses:
 *       201:
 *         description: Created team
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
 *
 * /api/Team/{id}:
 *   get:
 *     summary: Get a team by ID
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Team object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update a team
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Team'
 *     responses:
 *       200:
 *         description: Updated team
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete a team
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *
 * /api/Notification:
 *   get:
 *     summary: List all notifications
 *     tags: [Notification]
 *     responses:
 *       200:
 *         description: Array of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *   post:
 *     summary: Create a new notification
 *     tags: [Notification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Notification'
 *     responses:
 *       201:
 *         description: Created notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *
 * /api/Notification/{id}:
 *   get:
 *     summary: Get a notification by ID
 *     tags: [Notification]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update a notification
 *     tags: [Notification]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Notification'
 *     responses:
 *       200:
 *         description: Updated notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notification]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *
 * /api/User:
 *   get:
 *     summary: List all users
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Array of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *
 * /api/User/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update a user
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete a user
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *
 * @openapi
 * /api/{entity}:
 *   get:
 *     summary: List all records for a generic entity
 *     tags: [Entities]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Department, KBBDocument, CustomField, FieldConfig, OrgMember]
 *         description: Entity name
 *     responses:
 *       200:
 *         description: Array of records
 *       404:
 *         description: Unknown entity
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/{entity}/filter:
 *   post:
 *     summary: Filter records for an entity with where, sort, and limit
 *     tags: [Entities]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Organization, Location, Department, KBBDocument, CustomField, FieldConfig, Team, OrgMember, Notification, User]
 *         description: Entity name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               where:
 *                 type: object
 *                 description: Field-value pairs to filter by (equality match)
 *               sort:
 *                 type: string
 *                 description: Field to sort by, prefix with "-" for descending
 *               limit:
 *                 type: integer
 *                 description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: Array of filtered records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Unknown entity
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/{entity}/{id}:
 *   get:
 *     summary: Get a single record by ID
 *     tags: [Entities]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Organization, Location, Department, KBBDocument, CustomField, FieldConfig, Team, OrgMember, Notification, User]
 *         description: Entity name
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Record ID
 *     responses:
 *       200:
 *         description: Record object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/{entity}:
 *   post:
 *     summary: Create a new record for an entity
 *     tags: [Entities]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Organization, Location, Department, KBBDocument, CustomField, FieldConfig, Team, OrgMember, Notification, User]
 *         description: Entity name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Organization'
 *     responses:
 *       201:
 *         description: Created record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Unknown entity
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/{entity}/{id}:
 *   patch:
 *     summary: Update a record by ID
 *     tags: [Entities]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Organization, Location, Department, KBBDocument, CustomField, FieldConfig, Team, OrgMember, Notification, User]
 *         description: Entity name
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Organization'
 *     responses:
 *       200:
 *         description: Updated record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/{entity}/{id}:
 *   delete:
 *     summary: Delete a record by ID
 *     tags: [Entities]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Organization, Location, Department, KBBDocument, CustomField, FieldConfig, Team, OrgMember, Notification, User]
 *         description: Entity name
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Record ID
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/rpc/{name}:
 *   post:
 *     summary: Execute a remote procedure call (RPC)
 *     tags: [RPC]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *           enum: [getOrgsForUser, getOrgMembersWithUsers, addOrgMember, addExistingUserToOrg, updateOrgMember, removeOrgMember]
 *         description: RPC function name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/RpcGetOrgsForUserRequest'
 *               - $ref: '#/components/schemas/RpcGetOrgMembersWithUsersRequest'
 *               - $ref: '#/components/schemas/RpcAddOrgMemberRequest'
 *               - $ref: '#/components/schemas/RpcAddExistingUserToOrgRequest'
 *               - $ref: '#/components/schemas/RpcUpdateOrgMemberRequest'
 *               - $ref: '#/components/schemas/RpcRemoveOrgMemberRequest'
 *     responses:
 *       200:
 *         description: RPC result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       201:
 *         description: Created resource (addOrgMember, addExistingUserToOrg)
 *       204:
 *         description: Deleted successfully (removeOrgMember)
 *       404:
 *         description: Unknown RPC
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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