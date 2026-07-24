import { Router } from 'express';
import sql from '../db.js';
import { authenticateToken } from '../lib/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOrgAdmin(user, org) {
  if (!user || !org) return false;
  if (user.role === 'admin') return true;
  try {
    const adminIds = JSON.parse(org.admin_user_ids || '[]');
    return adminIds.includes(user.id);
  } catch {
    return false;
  }
}

async function getOrg(orgId) {
  const rs = await sql.execute({
    sql: 'SELECT * FROM organizations WHERE id = :id LIMIT 1',
    args: { id: orgId },
  });
  return rs.rows[0] || null;
}

async function getMessage(id) {
  const rs = await sql.execute({
    sql: 'SELECT * FROM system_messages WHERE id = :id LIMIT 1',
    args: { id },
  });
  return rs.rows[0] || null;
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// ---------------------------------------------------------------------------
// GET /api/system-messages/org/:orgId  — active messages for an org (public)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/system-messages/org/{orgId}:
 *   get:
 *     summary: Get all active system-wide messages for an organization (public)
 *     tags: [System Messages]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of active system messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SystemMessage'
 *       404:
 *         description: Organization not found
 */
router.get('/org/:orgId', async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const org = await getOrg(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const rs = await sql.execute({
      sql: `SELECT id, org_id, title, text, pastel_color, is_dismissable, is_active, created_date, updated_date
            FROM system_messages
            WHERE org_id = :orgId AND is_active = 1
            ORDER BY created_date DESC`,
      args: { orgId },
    });

    res.json(rs.rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system-messages/org/:orgId/dismissed  — user's dismissed IDs (auth)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/system-messages/org/{orgId}/dismissed:
 *   get:
 *     summary: Get message IDs the current user has dismissed (auth required)
 *     tags: [System Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of dismissed message IDs
 */
router.get('/org/:orgId/dismissed', authenticateToken, async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const userId = req.user.id;

    const rs = await sql.execute({
      sql: `SELECT dm.message_id
            FROM dismissed_messages dm
            JOIN system_messages sm ON sm.id = dm.message_id
            WHERE dm.user_id = :userId AND sm.org_id = :orgId`,
      args: { userId, orgId },
    });

    const ids = rs.rows.map(r => r.message_id);
    res.json(ids);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/system-messages  — create a new message (admin only)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/system-messages:
 *   post:
 *     summary: Create a new system-wide message (admin only)
 *     tags: [System Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SystemMessageCreateRequest'
 *     responses:
 *       201:
 *         description: Created system message
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { org_id, title, text, pastel_color, is_dismissable } = req.body || {};

    // Validate org_id
    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' });
    }
    const org = await getOrg(org_id);
    if (!org) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    // Authorization: must be org admin or global admin
    if (!isOrgAdmin(req.user, org)) {
      return res.status(403).json({ error: 'Admin access required for this organization' });
    }

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
      return res.status(400).json({ error: 'title is required (1-200 characters)' });
    }

    // Validate text
    if (typeof text !== 'string' || text.length > 2000) {
      return res.status(400).json({ error: 'text must be a string (max 2000 characters)' });
    }

    // Validate pastel_color
    if (!pastel_color || !HEX_COLOR_RE.test(pastel_color)) {
      return res.status(400).json({ error: 'pastel_color must be a valid hex color (e.g., #E8F4FD)' });
    }

    // Validate is_dismissable
    const dismissable = is_dismissable === true || is_dismissable === 1 || is_dismissable === '1' || is_dismissable === 'true';

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql.execute({
      sql: `INSERT INTO system_messages (id, org_id, title, text, pastel_color, is_dismissable, is_active, created_date, updated_date, created_by_id)
            VALUES (:id, :org_id, :title, :text, :pastel_color, :is_dismissable, 1, :now, :now, :created_by_id)`,
      args: {
        id,
        org_id,
        title: title.trim(),
        text: text || '',
        pastel_color,
        is_dismissable: dismissable ? 1 : 0,
        now,
        created_by_id: req.user.id,
      },
    });

    const created = await getMessage(id);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/system-messages/:id  — update a message (admin only)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/system-messages/{id}:
 *   patch:
 *     summary: Update a system-wide message (admin only)
 *     tags: [System Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SystemMessageUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated system message
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Message not found
 */
router.patch('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await getMessage(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Authorization: must be admin of the message's org
    const org = await getOrg(message.org_id);
    if (!isOrgAdmin(req.user, org)) {
      return res.status(403).json({ error: 'Admin access required for this organization' });
    }

    const { title, text, pastel_color, is_dismissable, is_active } = req.body || {};
    const updates = [];
    const args = { id };

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
        return res.status(400).json({ error: 'title must be 1-200 characters' });
      }
      updates.push('title = :title');
      args.title = title.trim();
    }

    if (text !== undefined) {
      if (typeof text !== 'string' || text.length > 2000) {
        return res.status(400).json({ error: 'text must be a string (max 2000 characters)' });
      }
      updates.push('text = :text');
      args.text = text;
    }

    if (pastel_color !== undefined) {
      if (!HEX_COLOR_RE.test(pastel_color)) {
        return res.status(400).json({ error: 'pastel_color must be a valid hex color (e.g., #E8F4FD)' });
      }
      updates.push('pastel_color = :pastel_color');
      args.pastel_color = pastel_color;
    }

    if (is_dismissable !== undefined) {
      const val = is_dismissable === true || is_dismissable === 1 || is_dismissable === '1' || is_dismissable === 'true';
      updates.push('is_dismissable = :is_dismissable');
      args.is_dismissable = val ? 1 : 0;
    }

    if (is_active !== undefined) {
      const val = is_active === true || is_active === 1 || is_active === '1' || is_active === 'true';
      updates.push('is_active = :is_active');
      args.is_active = val ? 1 : 0;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updated_date = :now");
    args.now = new Date().toISOString();

    await sql.execute({
      sql: `UPDATE system_messages SET ${updates.join(', ')} WHERE id = :id`,
      args,
    });

    const updated = await getMessage(id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/system-messages/:id  — soft-delete a message (admin only)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/system-messages/{id}:
 *   delete:
 *     summary: Soft-delete a system-wide message (admin only)
 *     tags: [System Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Message not found
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await getMessage(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Authorization: must be admin of the message's org
    const org = await getOrg(message.org_id);
    if (!isOrgAdmin(req.user, org)) {
      return res.status(403).json({ error: 'Admin access required for this organization' });
    }

    await sql.execute({
      sql: `UPDATE system_messages SET is_active = 0, updated_date = :now WHERE id = :id`,
      args: { id, now: new Date().toISOString() },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/system-messages/:id/dismiss  — user dismisses a message (auth)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/system-messages/{id}/dismiss:
 *   post:
 *     summary: Dismiss a system-wide message (auth required)
 *     tags: [System Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dismissed successfully
 *       404:
 *         description: Message not found
 */
router.post('/:id/dismiss', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await getMessage(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const userId = req.user.id;

    // Upsert dismissal (ignore if already dismissed)
    await sql.execute({
      sql: `INSERT OR IGNORE INTO dismissed_messages (id, user_id, message_id, dismissed_date)
            VALUES (:dismissId, :userId, :messageId, :now)`,
      args: {
        dismissId: crypto.randomUUID(),
        userId,
        messageId: id,
        now: new Date().toISOString(),
      },
    });

    res.json({ dismissed: true });
  } catch (err) {
    next(err);
  }
});

export default router;