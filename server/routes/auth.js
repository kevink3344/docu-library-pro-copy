import { Router } from 'express';
import {
  getUserById,
  getUserByEmail,
  sanitizeUser,
  signToken,
  verifyPassword,
} from '../lib/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { userId, organizationId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = await signToken(user);
    res.json({
      token,
      user: sanitizeUser(user),
      organizationId: organizationId || null,
    });
  } catch (err) {
    next(err);
  }
});

function matchesSuperAdminEnv(email, password) {
  const envEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!envEmail || !envPassword) return false;
  return String(email).trim().toLowerCase() === envEmail && password === envPassword;
}

router.post('/login-with-password', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim();
    const user = await getUserByEmail(normalizedEmail);

    // Dev/ops bypass: env credentials match → accept without DB password_hash
    const envOk = matchesSuperAdminEnv(normalizedEmail, password);
    const hashOk = user && await verifyPassword(password, user.password_hash);

    if (!user || (!envOk && !hashOk)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await signToken(user);
    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
