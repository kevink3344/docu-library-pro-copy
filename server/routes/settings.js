import { Router } from 'express';
import sql from '../db.js';
import { authenticateToken, requireAdmin, getLoginModeOverride } from '../lib/auth.js';

const router = Router();

const ALLOWED_KEYS = new Set(['login_mode', 'maintenance_message']);

const DEFAULTS = {
  login_mode: 'select',
  maintenance_message: 'The system is currently undergoing maintenance. Please try again later.',
};

const VALID_LOGIN_MODES = new Set(['select', 'password', 'maintenance']);

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
