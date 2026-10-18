// Loads the demo data from the front-end (demo accounts, fictional charities and projects) into Postgres.
// Safe to re-run. DEMO ONLY: demo accounts use the password "demo", so don't seed a public production database.
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { readFileSync } from 'fs';

const seed = JSON.parse(readFileSync(new URL('./seed-data.json', import.meta.url)));
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const demoHash = await bcrypt.hash('demo', 10);
const co = {}, uid = {}; // old (front-end) id -> new database id

for (const c of seed.companies) {
  const old = (await db.query('SELECT id FROM companies WHERE email_domain=$1', [c.domain])).rows[0];
  co[c.id] = old
    ? (await db.query('UPDATE companies SET name=$2,location=$3,sector=$4,description=$5,verified=true WHERE id=$1 RETURNING id',
      [old.id, c.name, c.loc, c.sector, c.desc])).rows[0].id
    : (await db.query(
      'INSERT INTO companies(name,location,sector,description,email_domain,verified) VALUES($1,$2,$3,$4,$5,true) RETURNING id',
      [c.name, c.loc, c.sector, c.desc, c.domain])).rows[0].id;
}

const addUser = async (u, hash) => (await db.query(
  `INSERT INTO users(role,email,password_hash,name,location,values_text,interests,previous_projects,study_stage,cv_url,charity_number,company_id,
    email_verified,lead_approved,approved,about,focus,serves,ways_to_help,logo,brand_color)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,true,true,$13,$14,$15,$16,$17,$18)
   ON CONFLICT (email) DO UPDATE SET role=EXCLUDED.role,password_hash=EXCLUDED.password_hash,name=EXCLUDED.name,
     location=EXCLUDED.location,values_text=EXCLUDED.values_text,interests=EXCLUDED.interests,previous_projects=EXCLUDED.previous_projects,
     study_stage=EXCLUDED.study_stage,cv_url=EXCLUDED.cv_url,charity_number=EXCLUDED.charity_number,company_id=EXCLUDED.company_id,
     email_verified=true,lead_approved=true,approved=true,about=EXCLUDED.about,focus=EXCLUDED.focus,serves=EXCLUDED.serves,
     ways_to_help=EXCLUDED.ways_to_help,logo=EXCLUDED.logo,brand_color=EXCLUDED.brand_color RETURNING id`,
  [u.role, u.email, hash, u.name, u.loc ?? null, u.values ?? null, u.interests ?? null, u.projects ?? null, u.year ?? null, u.cv ?? null,
    u.charityNo ?? null, u.companyId ? co[u.companyId] : null, u.about ?? null, u.focus ?? null, u.serves ?? null, u.waysToHelp ?? null,
    u.logo ?? null, u.brandColor ?? null])).rows[0].id;

for (const u of seed.users) uid[u.id] = await addUser(u, demoHash);
for (const c of seed.charities) {
  const email = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@demo.skill-issue.test';
  // showcase charities cannot log in (random password)
  uid[c.id] = await addUser({ ...c, role: 'charity', email }, await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10));
}

const pid = {};
let added = 0;
for (const p of seed.projects) {
  const charity = uid[p.charityId];
  const old = (await db.query('SELECT id FROM projects WHERE title=$1 AND charity_id=$2', [p.title, charity])).rows[0];
  if (old) {
    pid[p.id] = old.id;
    continue;
  }
  pid[p.id] = (await db.query(
    `INSERT INTO projects(charity_id,title,what,why,skills,timeline,deadline,budget,sector,location,hours,ask,mentoring_type,status,employee_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [charity, p.title, p.what, p.why, p.skills, p.timeline, p.deadline, p.budget, p.sector, p.loc, p.hours, p.ask, p.type, p.status,
      p.employeeId ? uid[p.employeeId] : null])).rows[0].id;
  added++;
}
let appCount = 0;
for (const a of seed.applications || []) {
  const cv = seed.users.find(u => u.id === a.userId)?.cv ?? null;
  await db.query(
    `INSERT INTO applications(project_id,user_id,message,extra,cv_url,status)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (project_id,user_id) DO UPDATE SET message=EXCLUDED.message,extra=EXCLUDED.extra,cv_url=EXCLUDED.cv_url,status=EXCLUDED.status`,
    [pid[a.projectId], uid[a.userId], a.message, a.extra ?? null, cv, a.status]);
  appCount++;
}
console.log(`Seeded: ${seed.users.length} demo accounts, ${seed.charities.length} charity profiles, ${added} new projects, ${appCount} demo applications.`);
await db.end();
