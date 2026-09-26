# Automated Terminal Report System for Ghanaian Basic Schools

A modern, GES/NaCCA-aligned web application for generating terminal report cards.

## Features

- Student management with photo upload
- Class & subject configuration
- SBA + Examination score entry with automatic 50:50 scaling, grading and ranking
- Attendance, Conduct, Interest, Attitude & Talents
- Class Teacher & Headteacher remarks
- Professional PDF terminal report generation
- Role-based demo login (Admin, Headteacher, Class Teacher)
- School settings (name, year, term, weights)

## Demo Accounts

| Role          | Email                     | Password |
|---------------|---------------------------|----------|
| Admin         | admin@school.edu.gh       | any      |
| Headteacher   | head@school.edu.gh        | any      |
| Class Teacher | teacher@school.edu.gh     | any      |

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Free Hosting on Vercel (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New Project** → import `MAWUENAMM/terminal-report-system`.
3. Leave build settings as default (Next.js is auto-detected).
4. Click **Deploy**.

Your prototype will be live within ~1–2 minutes.

## Data Storage Note

This prototype currently uses **browser localStorage** so it works immediately without a database.  
Data is stored per browser. For multi-user / production use, migrate the `src/lib/store.ts` layer to Supabase, Neon, or any PostgreSQL backend.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- jsPDF + autotable (report generation)
- localStorage (prototype persistence)

Built for Ghanaian basic schools · September 2026
