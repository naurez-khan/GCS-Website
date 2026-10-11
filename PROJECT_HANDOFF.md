# Mathematics Department Portal — Project Handoff

This document is the starting point for continuing the project in another Codex or ChatGPT account. It intentionally contains **no passwords, tokens, database URLs, or recovery codes**.

## 1. Project location and ownership

- GitHub repository: `https://github.com/naurez-khan/GCS-Website.git`
- Primary branch: `main`
- Local project folder: `E:\math-department-portal`
- Production site: `https://www.gcsmd.site`
- Hosting: Vercel, deployed from the GitHub repository
- Production database: Neon PostgreSQL
- Local development database: local PostgreSQL

The Git repository contains the application code and database migrations. It does not contain the environment files or account passwords.

## 2. Current application

The portal includes:

- Teacher and administrator authentication
- Teacher approval, editing, activation/deactivation, and permanent deletion
- Teacher name editing by administrators
- Class creation, editing, approval, and deletion
- Separate Bachelors and Intermediate class details
- Attendance entry and attendance history
- Monthly attendance Excel and PDF exports
- Absent-student Excel and PDF exports
- Lecture statements and monthly lecture records
- Marks entry and Bachelors/Intermediate award-list exports
- Morning and evening period panels
- Date-effective period assignments, so timetable changes do not rewrite earlier dates
- Backdated period assignment for a month that has already started
- Monthly lecture-record PDF generation

Important recent work is represented by migrations through:

- `database/020_teacher_period_timetable.sql`

At the time of this handoff, the relevant recent commits included:

- `d55b83b` — date-effective period timetable and monthly record
- `ed83291` — mobile spacing improvements
- `2bc0ed7` — monthly-record PDF control polish

Always run `git log --oneline -10` after cloning to confirm the latest commit, because later commits may exist.

## 3. Architecture

- Frontend: static HTML, CSS, and JavaScript in `frontend/`
- Backend: Node.js and Express in `backend/`
- Database: PostgreSQL
- Database migrations: `database/`
- Authentication: JWT-based; the signing secret comes from an environment variable
- Production deployment: Vercel

Useful commands from the repository root:

```powershell
npm install
npm start
npm test
npm run check
```

If the backend has its own dependencies and they were not installed by the root command:

```powershell
Set-Location backend
npm install
Set-Location ..
```

## 4. Continue the project in another Codex account

1. Sign in to the new Codex/ChatGPT account.
2. Make sure the new account has access to the GitHub repository.
3. Clone the repository, or open the existing local folder if both accounts use the same computer:

   ```powershell
   git clone https://github.com/naurez-khan/GCS-Website.git
   Set-Location GCS-Website
   ```

4. Open that folder as a project in Codex.
5. Restore the local environment files from the password manager as described below.
6. Install dependencies and start the server.
7. Give Codex this opening prompt:

   > Read PROJECT_HANDOFF.md, inspect the latest Git history and database migrations, and continue from the current main branch. Do not expose or commit environment secrets. Before changing the database, explain whether the change is for local PostgreSQL, Neon production, or both.

The Git repository is the authoritative source for code. The exported ChatGPT JSON is only supporting context.

## 5. Environment files

The local server normally uses `backend/.env`. Production uses environment variables configured in Vercel and connects to Neon.

Local PostgreSQL commonly requires these variable names:

```dotenv
PORT=5000
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
```

Neon/production commonly requires:

```dotenv
DATABASE_URL=
JWT_SECRET=
```

Rules:

- Never commit `.env`, `.env.neon`, database URLs, passwords, or JWT secrets.
- Do not paste secrets into a Codex chat, screenshot, issue, commit, or handoff document.
- Keep local PostgreSQL and Neon credentials clearly labeled; changing local data does not automatically change Neon data.
- Database schema changes must be applied through the migration files to each intended database.
- After changing Vercel environment variables, redeploy the application.

## 6. Password-manager setup

Use a reputable password manager already trusted by the project owner or institution. Configure it as follows:

1. Create a strong, unique master password. Do not reuse an email, GitHub, database, or college password.
2. Turn on multi-factor authentication for the password manager.
3. Save its recovery key/recovery kit offline in a secure location.
4. Create a vault named **GCS Website**.
5. Add separate login entries for:
   - GitHub
   - Vercel
   - Neon
   - Domain registrar/DNS provider
   - The production administrator account
6. Add a protected secure note named **GCS Environment Secrets** containing labeled fields for:
   - Production `DATABASE_URL`
   - Production `JWT_SECRET`
   - Local PostgreSQL host, port, database, user, and password
   - Any deployment or service tokens still in use
7. Store MFA recovery codes in the vault or in a separate offline recovery location.
8. If another maintainer needs access, use the manager's shared-vault feature. Do not send secrets in email or chat.
9. Give each person only the access they need, and remove access promptly when responsibility changes.

For a new machine/account, copy secret values from the password manager into a new local `backend/.env`. Do not copy the environment file into Git.

If a secret has ever appeared in a chat, screenshot, commit, or public file, treat it as compromised: rotate it in Neon/Vercel, update the password manager, update the local environment, and redeploy.

## 7. Export ChatGPT conversation history as JSON

From the original ChatGPT account:

1. Open **Settings**.
2. Open **Data Controls**.
3. Select **Export Data** and confirm the export.
4. Wait for the download link sent by email or SMS. The export can take time to arrive, and the download link expires after 24 hours.
5. Download the ZIP while signed in to the same account that requested it.
6. Extract the ZIP and locate `conversations.json`. Large exports may contain numbered conversation JSON files.

In the new personal ChatGPT account:

1. Start a new conversation.
2. Upload `conversations.json`, or upload only the relevant smaller JSON file.
3. Tell ChatGPT that it is historical reference material for the Mathematics Department Portal.
4. Also open the Git repository and ask it to read this handoff file; current code and migrations take precedence over old chat messages.

Important limitations:

- Uploading the JSON does not merge the two accounts.
- It does not recreate the old sidebar or restore every conversation as a separate chat.
- It does not transfer subscriptions, memories, custom instructions, GPTs, files, or workspace membership.
- If the JSON is too large, split it into smaller valid JSON files or retain only the relevant project conversations.
- The export may contain private information. Keep it out of GitHub and store it securely.

The ChatGPT **Import from another agent** feature is intended for supported external coding agents such as Claude Code, Claude Cowork, and Cursor. It is not the account-to-account ChatGPT history-transfer method; use the data export process above.

## 8. Local database versus Neon

The local development server should connect to local PostgreSQL when `backend/.env` contains the `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` settings and does not override them with a production `DATABASE_URL`.

Data entered locally remains local. It is not synchronized automatically to Neon. Only code is synchronized through GitHub. To make a schema change available in both places:

1. Add or update a numbered SQL migration in `database/`.
2. Apply it to local PostgreSQL and verify the application/tests.
3. Back up production if the change is risky.
4. Apply the same migration to Neon.
5. Deploy the matching application code.

Do not copy all local data into Neon unless that data transfer is specifically intended and has been reviewed.

## 9. Deployment checklist

Before pushing:

```powershell
git status --short
npm test
npm run check
git diff --check
```

Then review the diff, commit only intended source files, and push `main`. Vercel should deploy from GitHub. Confirm the deployment succeeded and test the changed feature on the production domain.

Do not commit generated preview/output files. In particular, check any untracked `output/` directory before staging files.

## 10. Handoff verification checklist

- [ ] New account can access the GitHub repository
- [ ] Repository opens in Codex and latest `main` is checked out
- [ ] Dependencies install successfully
- [ ] Password-manager vault and MFA are configured
- [ ] Local `backend/.env` is recreated without entering Git
- [ ] Local server connects to local PostgreSQL
- [ ] Tests and checks pass
- [ ] New maintainer can access Vercel and Neon with least-privilege access
- [ ] Vercel environment variables are present
- [ ] Production site login and one read-only workflow are verified
- [ ] ChatGPT JSON export is stored securely and uploaded only when needed

