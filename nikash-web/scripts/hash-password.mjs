// Generates a bcrypt hash for the FIRST super admin.
// There is no signup UI for platform_admins on purpose (only you should
// be able to create one) — insert the hash straight into the database.
//
// Usage:
//   node scripts/hash-password.mjs "YourStrongPassword123"
//
// Then in Supabase SQL Editor:
//   insert into platform_admins (name, email, password_hash, role)
//   values ('Your Name', 'you@example.com', '<paste hash here>', 'super_admin');

import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "YourPassword"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
