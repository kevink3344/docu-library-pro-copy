import '../config.js';
import sql from '../db.js';
import { hashPassword } from '../lib/auth.js';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node server/scripts/set-password.js <email> <password>');
  process.exit(1);
}

const hash = await hashPassword(password);
const rs = await sql.execute({
  sql: `UPDATE users
        SET password_hash = :hash, updated_date = :updated_date
        WHERE email = :email`,
  args: {
    email,
    hash,
    updated_date: new Date().toISOString(),
  },
});

if (rs.rowsAffected === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log(`Password updated for ${email}`);
