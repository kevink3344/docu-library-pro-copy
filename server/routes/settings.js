import { Router } from 'express';
import sql from '../db.js';
import { authenticateToken, requireAdmin, getLoginModeOverride } from '../lib/auth.js';

const router = Router();

const ALLOWED_KEYS = new Set(['login_mode', 'maintenance_message', 'app_logo_url', 'app_title', 'hide_logo']);

const DEFAULTS = {
  login_mode: 'select',
  maintenance_message: 'The system is currently undergoing maintenance. Please try again later.',
  app_logo_url: '',
  app_title: 'KBB Pro',
  hide_logo: 'false',
};

const VALID_LOGIN_MODES = new Set(['select', 'password', 'maintenance']);

/**
 * @openapi
 * /api/settings/{key}:
 *   get:
 *     summary: Get a setting value by key
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum: [login_mode, maintenance_message, app_logo_url, app_title, hide_logo]
 *         description: Setting key
 *     responses:
 *       200:
 *         description: Setting value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SettingsGetResponse'
 *       404:
 *         description: Unknown setting
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(404).json({ error: 'Unknown setting' });
    }

    if (key === 'login_mode') {
      const override = getLoginModeOverride();
      if (override) {
        return res.json({ key: 'login_mode', value: override });
      }
    }

    const rs = await sql.execute({
      sql: 'SELECT value FROM app_settings WHERE key = :key LIMIT 1',
      args: { key },
    });

    const value = rs.rows[0]?.value ?? DEFAULTS[key];
    res.json({ key, value });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/settings/{key}:
 *   put:
 *     summary: Update a setting value (requires admin)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum: [login_mode, maintenance_message, app_logo_url, app_title, hide_logo]
 *         description: Setting key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SettingsPutRequest'
 *     responses:
 *       200:
 *         description: Setting updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SettingsGetResponse'
 *       400:
 *         description: Invalid value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Unknown setting
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:key', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(404).json({ error: 'Unknown setting' });
    }

    const { value } = req.body || {};
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'value must be a string' });
    }

    if (key === 'login_mode' && !VALID_LOGIN_MODES.has(value)) {
      return res.status(400).json({ error: 'Invalid login_mode' });
    }

    await sql.execute({
      sql: `INSERT INTO app_settings (key, value) VALUES (:key, :value)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: { key, value },
    });

    res.json({ key, value });
  } catch (err) {
    next(err);
  }
});

export default router;