import 'dotenv/config';
import pg from 'pg';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

await db.query(`
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, location TEXT, sector TEXT,
  description TEXT, email_domain TEXT NOT NULL, verified BOOLEAN DEFAULT false
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student','employee','company','charity','admin')),
  email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  name TEXT NOT NULL, location TEXT, values_text TEXT, interests TEXT,
  previous_projects TEXT, study_stage TEXT, cv_url TEXT, charity_number TEXT,
  company_id INT REFERENCES companies(id),
  email_verified BOOLEAN DEFAULT false,
  lead_approved BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false
);
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY, charity_id INT REFERENCES users(id),
  title TEXT, what TEXT, why TEXT, skills TEXT, timeline TEXT,
  deadline DATE, budget TEXT, sector TEXT, location TEXT, hours INT, ask TEXT,
  mentoring_type TEXT CHECK (mentoring_type IN ('none','shadow','mentor','both')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','live')),
  employee_id INT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY, project_id INT REFERENCES projects(id),
  user_id INT REFERENCES users(id), message TEXT, extra TEXT, cv_url TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','accepted','declined')),
  UNIQUE (project_id, user_id)
);
CREATE TABLE IF NOT EXISTS email_codes (
  user_id INT REFERENCES users(id), code_hash TEXT, expires_at TIMESTAMPTZ
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS about TEXT, ADD COLUMN IF NOT EXISTS focus TEXT, ADD COLUMN IF NOT EXISTS serves TEXT,
  ADD COLUMN IF NOT EXISTS ways_to_help TEXT, ADD COLUMN IF NOT EXISTS logo TEXT, ADD COLUMN IF NOT EXISTS brand_color TEXT;`);

const { rows } = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
console.log('Tables:', rows.map(r => r.table_name));
await db.end();