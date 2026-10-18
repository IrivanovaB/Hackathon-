import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const FREE = /@(gmail|yahoo|hotmail|outlook|icloud|live|aol|proton(mail)?|me)\./i;
const STU = /(\.ac\.[a-z]{2}|\.edu(\.[a-z]{2})?$|\.sch\.uk|school|college|academy|sixthform)/i;
const YEARS = ['A-level Year 12', 'A-level Year 13', 'University Year 1', 'University Year 2'];
const SECTORS = ['Technology', 'Legal', 'Education', 'Health', 'Environment', 'Arts', 'Finance', 'Community'];
const TYPES = ['none', 'shadow', 'mentor', 'both'];

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

const bad = (m, s = 400) => { const e = new Error(m); e.status = s; throw e; };
const getUser = async req => {
  try {
    const id = jwt.verify(req.cookies.t, SECRET).id;
    return (await db.query('SELECT * FROM users WHERE id=$1 AND email_verified', [id])).rows[0] || null;
  } catch { return null; }
};
// roles: undefined = public, true = any approved user, array = those roles only
const wrap = (fn, roles) => async (req, res) => {
  try {
    if (roles) {
      req.user = await getUser(req);
      if (!req.user) bad('Please log in.', 401);
      if (!req.user.approved) bad('Your account is not verified yet.', 403);
      if (roles !== true && !roles.includes(req.user.role)) bad('Not allowed.', 403);
    }
    res.json((await fn(req, res)) || { ok: true });
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error' });
  }
};

// ---------- reading data (shaped to match what the page expects) ----------
const PS = `SELECT id,charity_id AS "charityId",title,what,why,skills,timeline,to_char(deadline,'YYYY-MM-DD') AS deadline,budget,mentoring_type AS type,sector,location AS loc,hours,ask,status,employee_id AS "employeeId" FROM projects`;
const AS = `SELECT id,project_id AS "projectId",user_id AS "userId",message AS msg,extra,cv_url AS cv,status FROM applications`;
const US = `SELECT id,role,email,name,location AS loc,values_text AS "values",interests,previous_projects AS projects,study_stage AS year,cv_url AS cv,charity_number AS "charityNo",company_id AS "companyId",approved,lead_approved AS "leadOk",about,focus,serves,ways_to_help AS "waysToHelp",logo,brand_color AS "brandColor" FROM users`;
const CS = `SELECT id,name,location AS loc,sector,description AS "desc",email_domain AS domain,verified FROM companies`;
const mine = `id IN (SELECT project_id FROM applications WHERE user_id=$1)`;
const Q = {
  admin: [`${PS} WHERE $1>0`, `${AS} WHERE $1<0`],
  company: [`${PS} WHERE $1<0`, `${AS} WHERE $1<0`],
  charity: [`${PS} WHERE charity_id=$1`, `${AS} WHERE project_id IN (SELECT id FROM projects WHERE charity_id=$1)`],
  student: [`${PS} WHERE (status='live' AND (mentoring_type='none' OR employee_id IS NOT NULL)) OR ${mine}`, `${AS} WHERE user_id=$1`],
  employee: [`${PS} WHERE (status='live' AND mentoring_type<>'none' AND (employee_id IS NULL OR employee_id=$1)) OR ${mine}`,
    `${AS} WHERE user_id=$1 OR project_id IN (SELECT id FROM projects WHERE employee_id=$1)`]
};
app.get('/api/state', wrap(async req => {
  const me = await getUser(req);
  if (!me) { // logged-out visitors see live projects and their charities (no emails)
    const projects = (await db.query(`${PS} WHERE status='live'`)).rows;
    const users = (await db.query(`${US} WHERE role='charity' AND approved AND id=ANY($1)`, [[...new Set(projects.map(p => p.charityId))]])).rows.map(({ email, charityNo, ...r }) => r);
    return { me: null, users, projects, apps: [], companies: (await db.query(`${CS} WHERE verified`)).rows };
  }
  const [pq, aq] = Q[me.role];
  const projects = (await db.query(pq, [me.id])).rows, apps = (await db.query(aq, [me.id])).rows;
  const ids = [...new Set([me.id, ...projects.map(p => p.charityId), ...projects.map(p => p.employeeId).filter(Boolean), ...apps.map(a => a.userId)])];
  const admin = me.role === 'admin';
  const users = (await db.query(`${US} WHERE email_verified AND (id=ANY($1) OR company_id=$2 OR $3)`, [ids, me.company_id, admin])).rows
    .map(u => (admin || u.id === me.id || (me.role === 'company' && u.companyId === me.company_id)) ? u : (({ email, charityNo, ...r }) => r)(u));
  const companies = (await db.query(admin ? CS : `${CS} WHERE verified OR id=$1`, admin ? [] : [me.company_id])).rows;
  return { me: users.find(u => u.id === me.id), users, projects, apps, companies };
}));

// ---------- accounts ----------
app.post('/api/signup', wrap(async req => {
  const b = req.body, role = b.role, email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim();
  if (!['student', 'charity', 'company'].includes(role)) bad('Unknown account type.');
  if (!/^\S+@\S+\.\S+$/.test(email)) bad('Enter a valid email address.');
  if (String(b.password || '').length < 8) bad('Password needs at least 8 characters.');
  if (!name) bad('Name is required.');
  if (FREE.test(email)) bad('Free email providers are not accepted. Use your organisation email.');
  const old = (await db.query('SELECT id,email_verified FROM users WHERE email=$1', [email])).rows[0];
  if (old?.email_verified) bad('That email is already registered.');
  const u = { role, loc: null, values: null, year: null, charityNo: null, companyId: null };
  let newCo = null;
  if (role === 'student') {
    if (!STU.test(email)) bad('Student emails must be a school, college or university address (for example .ac.uk).');
    if (b.year === 'Beyond second year') bad('Skill Issue is for A-level students up to second-year university students.');
    if (!YEARS.includes(b.year)) bad('Choose your study stage.');
    u.year = b.year;
  }
  if (role === 'charity') {
    if (!/^\d{6,8}$/.test(String(b.charityNo || '').trim())) bad('Enter a valid 6 to 8 digit Charity Commission registration number.');
    Object.assign(u, { charityNo: b.charityNo.trim(), loc: b.loc || null, values: b.values || null });
  }
  if (role === 'company') {
    if (b.mode === 'emp') {
      const c = (await db.query('SELECT * FROM companies WHERE id=$1 AND verified', [+b.companyId || 0])).rows[0];
      if (!c) bad('No verified company to join yet.');
      if (email.split('@')[1] !== c.email_domain) bad(`Your email must end @${c.email_domain} to join ${c.name}.`);
      u.role = 'employee'; u.companyId = c.id;
    } else {
      newCo = b.company || {};
      if (!String(newCo.name || '').trim()) bad('Company name is required.');
    }
  }
  const code = String(crypto.randomInt(100000, 1000000)), hash = await bcrypt.hash(String(b.password), 10);
  const cl = await db.connect();
  try {
    await cl.query('BEGIN');
    if (old) { await cl.query('DELETE FROM email_codes WHERE user_id=$1', [old.id]); await cl.query('DELETE FROM users WHERE id=$1', [old.id]); }
    if (newCo) u.companyId = (await cl.query('INSERT INTO companies(name,location,sector,description,email_domain) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [newCo.name.trim(), newCo.loc || null, SECTORS.includes(newCo.sector) ? newCo.sector : null, newCo.desc || null, email.split('@')[1]])).rows[0].id;
    const id = (await cl.query('INSERT INTO users(role,email,password_hash,name,location,values_text,study_stage,charity_number,company_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [u.role, email, hash, name, u.loc, u.values, u.year, u.charityNo, u.companyId])).rows[0].id;
    await cl.query(`INSERT INTO email_codes VALUES($1,$2,now()+interval '10 minutes')`, [id, sha(code)]);
    await cl.query('COMMIT');
  } catch (e) { await cl.query('ROLLBACK'); throw e; } finally { cl.release(); }
  return { role: u.role, code }; // DEMO: code returned instead of emailed
}));

app.post('/api/verify', wrap(async req => {
  const u = (await db.query('SELECT * FROM users WHERE email=$1', [String(req.body.email || '').toLowerCase()])).rows[0];
  if (!u) bad('Account not found.');
  const ok = (await db.query('SELECT 1 FROM email_codes WHERE user_id=$1 AND code_hash=$2 AND expires_at>now()', [u.id, sha(String(req.body.code || ''))])).rows[0];
  if (!ok) bad('That code is not right or has expired. Try again.');
  await db.query(`UPDATE users SET email_verified=true, approved=(role='student' OR approved) WHERE id=$1`, [u.id]);
  await db.query('DELETE FROM email_codes WHERE user_id=$1', [u.id]);
  return { role: u.role };
}));

app.post('/api/login', wrap(async (req, res) => {
  const { email, password, role } = req.body;
  const u = (await db.query('SELECT * FROM users WHERE email=$1', [String(email || '').trim().toLowerCase()])).rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) bad('Email or password not recognised.', 401);
  if (u.role !== role && !(role === 'company' && u.role === 'employee')) bad(`This email is registered as a ${u.role}. Pick that role on the home page.`);
  if (!u.email_verified) bad('Please verify your email first.');
  if (!u.approved) bad('Your account is still waiting for verification.', 403);
  res.cookie('t', jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' }), { httpOnly: true, sameSite: 'lax' });
}));
app.post('/api/logout', wrap(async (req, res) => { res.clearCookie('t'); }));

app.post('/api/profile', wrap(async req => {
  const b = req.body, s = v => (typeof v === 'string' ? v.slice(0, 2000) : null);
  await db.query(`UPDATE users SET name=COALESCE($2,name),location=COALESCE($3,location),values_text=COALESCE($4,values_text),
    interests=COALESCE($5,interests),previous_projects=COALESCE($6,previous_projects),cv_url=COALESCE($7,cv_url) WHERE id=$1`,
    [req.user.id, s(b.name), s(b.loc), s(b.values), s(b.interests), s(b.projects), s(b.cv)]);
}, true));

// ---------- projects and applications ----------
app.post('/api/projects', wrap(async req => {
  const b = req.body, g = k => String(b[k] || '').trim();
  if (!g('title') || !g('what') || !g('why') || !g('skills') || !g('deadline')) bad('Fill in title, what, why, skills and deadline.');
  if (!TYPES.includes(b.type)) bad('Choose a mentoring option.');
  await db.query(`INSERT INTO projects(charity_id,title,what,why,skills,timeline,deadline,budget,sector,location,hours,ask,mentoring_type)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [req.user.id, g('title'), g('what'), g('why'), g('skills'), g('timeline'), g('deadline'), g('budget') || 'None',
      SECTORS.includes(b.sector) ? b.sector : null, req.user.location, Math.max(1, +b.hours || 1), g('ask'), b.type]);
}, ['charity']));

app.post('/api/applications', wrap(async req => {
  const u = req.user, b = req.body;
  const p = (await db.query('SELECT * FROM projects WHERE id=$1', [+b.projectId || 0])).rows[0];
  if (!p || p.status !== 'live') bad('Project not found.', 404);
  if (!String(b.msg || '').trim()) bad('Add a short message first.');
  if (u.role === 'student') {
    if (!u.cv_url) bad('Add your CV to your profile first.');
    if (p.mentoring_type !== 'none' && !p.employee_id) bad('This project is not open to students yet.');
  } else {
    const c = (await db.query('SELECT verified FROM companies WHERE id=$1', [u.company_id])).rows[0];
    if (!c?.verified) bad('Your company is not verified yet.', 403);
    if (p.mentoring_type === 'none' || p.employee_id) bad('This project is not open to company offers.');
  }
  try {
    await db.query('INSERT INTO applications(project_id,user_id,message,extra,cv_url) VALUES($1,$2,$3,$4,$5)',
      [p.id, u.id, String(b.msg).slice(0, 3000), String(b.extra || '').slice(0, 1000), u.cv_url]);
  } catch (e) { if (e.code === '23505') bad('You have already sent an offer for this project.'); throw e; }
}, ['student', 'employee']));

// Charity decides on employee offers and on student offers for direct projects.
// The matched employee decides on student offers for mentoring projects.
app.post('/api/decide', wrap(async req => {
  const u = req.user, { id, status } = req.body;
  if (!['accepted', 'declined'].includes(status)) bad('Invalid decision.');
  const a = (await db.query(`SELECT a.*,p.charity_id,p.employee_id,x.role AS arole FROM applications a
    JOIN projects p ON p.id=a.project_id JOIN users x ON x.id=a.user_id WHERE a.id=$1`, [+id || 0])).rows[0];
  if (!a) bad('Offer not found.', 404);
  const isEmp = a.arole === 'employee';
  const allowed = u.role === 'charity' ? a.charity_id === u.id && (isEmp || !a.employee_id) : u.id === a.employee_id && !isEmp;
  if (!allowed) bad('Not allowed.', 403);
  if (a.status !== 'sent') bad('Already decided.');
  if (isEmp && status === 'accepted') {
    if (a.employee_id) bad('This project already has a company match.');
    await db.query('UPDATE projects SET employee_id=$1 WHERE id=$2', [a.user_id, a.project_id]);
  }
  await db.query('UPDATE applications SET status=$1 WHERE id=$2', [status, a.id]);
}, ['charity', 'employee']));

// ---------- approvals ----------
app.post('/api/lead-approve', wrap(async req => {
  await db.query(`UPDATE users SET lead_approved=true WHERE id=$1 AND role='employee' AND company_id=$2`, [+req.body.id || 0, req.user.company_id]);
}, ['company']));

app.post('/api/approve', wrap(async req => {
  const { kind, id } = req.body, n = +id || 0;
  if (kind === 'company') {
    await db.query('UPDATE companies SET verified=true WHERE id=$1', [n]);
    await db.query(`UPDATE users SET approved=true WHERE company_id=$1 AND role='company' AND email_verified`, [n]);
  } else if (kind === 'user') {
    const u = (await db.query('SELECT u.*,c.verified AS cv FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=$1', [n])).rows[0];
    if (!u) bad('User not found.', 404);
    if (u.role === 'employee' && !(u.lead_approved && u.cv)) bad('Company lead must approve this employee, and the company must be verified.');
    await db.query('UPDATE users SET approved=true WHERE id=$1', [n]);
  } else if (kind === 'project') {
    await db.query(`UPDATE projects SET status='live' WHERE id=$1 AND charity_id IN (SELECT id FROM users WHERE approved)`, [n]);
  } else bad('Unknown item.');
}, ['admin']));

// ---------- CV scanner: forwards the CV + live projects to the Python/Gemini service ----------
const SCANNER = process.env.SCANNER_URL || 'http://127.0.0.1:8000';
app.post('/api/scan', express.raw({ type: () => true, limit: '10mb' }), wrap(async req => {
  if (!req.body?.length) bad('Choose a CV file first.');
  const live = (await db.query(Q.student[0], [req.user.id])).rows.filter(p => p.status === 'live');
  if (!live.length) bad('There are no open projects to match against yet.');
  const fd = new FormData();
  fd.append('file', new Blob([req.body], { type: req.get('content-type') || 'application/pdf' }), 'cv');
  fd.append('projects', JSON.stringify(live.map(p => ({ id: String(p.id), title: p.title, description: p.what,
    required_skills: String(p.skills || '').split(',').map(x => x.trim()).filter(Boolean) }))));
  let r;
  try { r = await fetch(SCANNER + '/api/scan', { method: 'POST', body: fd }); }
  catch (e) {
    console.error('CV scanner request failed:', e);
    bad('CV scanner is unavailable. Install its dependencies with `python -m pip install -r scanner/requirements.txt`, then start it with `npm run scanner`.', 503);
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) bad(d.detail || 'CV scan failed.', 502);
  return d;
}, ['student']));

// ---------- start ----------
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  await db.query(`INSERT INTO users(role,email,password_hash,name,email_verified,approved) VALUES('admin',$1,$2,'Platform reviewer',true,true) ON CONFLICT (email) DO NOTHING`,
    [process.env.ADMIN_EMAIL.toLowerCase(), await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)]);
}
if (!process.env.JWT_SECRET) console.warn('Tip: set JWT_SECRET in .env so logins survive server restarts.');
app.listen(process.env.PORT || 3000, () => console.log('Skill Issue running at http://localhost:' + (process.env.PORT || 3000)));
