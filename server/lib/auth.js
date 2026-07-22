import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import sql from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const VALID_LOGIN_MODES = new Set(['select', 'password', 'maintenance']);

export function getLoginModeOverride() {
  const envOverride = process.env.LOGIN_MODE?.trim().toLowerCase();
  if (VALID_LOGIN_MODES.has(envOverride)) return envOverride;
  return null;
}

export function getJwtSecretKey() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in .env.local');
  }
  return new TextEncoder().encode(JWT_SECRET);
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function signToken(user) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecretKey());
}

export async function verifyAuthToken(token) {
  const { payload } = await jwtVerify(token, getJwtSecretKey());
  return payload;
}

export async function getUserById(id) {
  const rs = await sql.execute({
    sql: 'SELECT * FROM users WHERE id = :id LIMIT 1',
    args: { id },
  });
  return rs.rows[0] || null;
}

export async function getUserByEmail(email) {
  const rs = await sql.execute({
    sql: 'SELECT * FROM users WHERE email = :email LIMIT 1',
    args: { email },
  });
  return rs.rows[0] || null;
}

/** Express middleware: require valid Bearer JWT; attaches req.user (sanitized). */
export async function authenticateToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const payload = await verifyAuthToken(token);
    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    req.user = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Express middleware: require authenticated super admin (role === 'admin'). */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
