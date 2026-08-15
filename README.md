# Math Department Portal

A small Express/PostgreSQL portal for managing mathematics classes, attendance, marks, and published student results.

## Features

- Admin login and teacher account management
- Teacher classes with configurable roll ranges and assessment types
- Attendance marking, history, summaries, and spreadsheet export
- Assignment, quiz, midterm, and final marks
- Published student result lookup using a course result code and roll number
- HTTP-only cookie authentication and role-protected admin/teacher APIs

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer

## Setup

1. Create a PostgreSQL database named `math_department_portal`.
2. Run [`database/schema.sql`](database/schema.sql) against that database.
3. In `backend`, copy `.env.example` to `.env` and replace every placeholder.
4. Install and start the backend:

   ```powershell
   cd backend
   npm install
   npm run migrate
   npm run create-admin
   npm start
   ```

5. Open `http://localhost:5000/test-login.html`.

The frontend is served by Express, so no separate frontend server is required. If a separate origin is used during development, put its exact URL in `CORS_ORIGIN`. Multiple origins can be comma-separated.

## Deploy to Vercel with Neon

1. Push the repository to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Leave **Root Directory** set to the repository root and leave the detected framework/build settings unchanged.
3. Add these environment variables for Production, Preview, and Development:

   - `DATABASE_URL`: the pooled Neon connection string, including `sslmode=require`
   - `JWT_SECRET`: a random secret containing at least 32 characters
   - `NODE_ENV`: `production`

4. Deploy. Vercel serves the frontend and runs the Express API from the same address.
5. Open `/api/db-test` on the deployed address to verify the Neon connection, then open `/test-login.html`.

Keep the database password only in Neon/Vercel environment variables. Never commit it to GitHub.

## User flows

- Admins are sent to `/admin.html`, where they can add and view teachers.
- Teachers are sent to `/teacher-dashboard.html`, where they create and manage classes.
- When a teacher enables results for a class, its student result code appears on the course page. Students use that code and their roll number at `/results.html`.

## Verification

From `backend` run:

```powershell
npm run check
npm run check:db
npm run check:api
npm run check:edits
npm test
```

`npm run check` validates every first-party JavaScript file and the SQL file. `npm run check:db` verifies the configured live database. The smoke tests verify static page serving and cookie logout behavior.

## Security notes

- Never commit `backend/.env`.
- Generate a long random `JWT_SECRET` for production.
- Student results are visible only for classes whose `results_enabled` option is on. Treat each class result code as a shared secret and distribute it only to that class.
- Use HTTPS in production so the authentication cookie is transmitted securely.
