# Skill Issue (merged)

One site, two small servers:
- **Node/Express** (`server.js`, port 3000) serves `public/index.html`, handles accounts/projects/applications in Postgres, and forwards CV scans.
- **Python/FastAPI** (`scanner/server.py`, port 8000) reads a CV with Gemini and ranks the live projects. Only Node talks to it.

## First run
1. `cp .env.example .env` and fill it in (use your existing DATABASE_URL, JWT_SECRET, ADMIN_*, GEMINI_API_KEY).
2. `npm install`, then `npm run seed` (creates/updates tables and loads demo data). You can also run `npm run setup` separately to prepare the database without seeding.
3. Terminal A: `npm start`  →  http://localhost:3000
4. In a second terminal, install and run the CV scanner from the project root: `python -m pip install -r scanner/requirements.txt`, then `npm run scanner`. The scanner listens on `127.0.0.1:8000`; keep it running while using CV matching.

## Demo data
The homepage includes six demo login buttons: three students (Amara, Leila and Owen) and three company accounts (Northline Capital, BrightPath Studio and Copperleaf Creative). All six use the password `demo`. The Northline mentor and Green Roots charity demo logins are also available.

Seeding adds 24 sample opportunities, fictional community-charity profiles and sample applications so student and charity views have useful content during a walkthrough. These are dummy records for filming and are not real opportunities. One profile is an explicitly fictional Oxfam concept; it is not affiliated with or endorsed by Oxfam. `npm run seed` is safe to re-run and updates the seeded demo applications.

## Using the CV matcher
Log in as a student → Opportunities → "Match me to projects" → upload a PDF.

## Notes
- Demo accounts use password `demo`. Don't seed a public production database.
- The scanner sends CVs to Google Gemini. Keep that in your privacy wording.
- CV matching requires the scanner terminal from step 4 to remain running. If it stops, restart it with `npm run scanner`.
- If a scan returns a model error, check the model name in `scanner/server.py` (`model=...`) exists on your Gemini account.
