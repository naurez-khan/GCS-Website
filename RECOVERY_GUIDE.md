# Math Department Portal Recovery Guide

This guide explains how to restore the website if the development computer or local project folder is lost.

## What must be backed up

Keep these three items separately:

1. **Source code:** the GitHub repository `https://github.com/naurez-khan/GCS-Website.git`
2. **Database:** the Neon project and its pooled PostgreSQL connection string
3. **Private configuration:** the production environment variables listed below

Do not store real passwords, database connection strings, or JWT secrets in this repository.

## Important distinction

Neon does not provide the application's `JWT_SECRET`.

- `DATABASE_URL` connects the website to Neon.
- `JWT_SECRET` is a private random value created by the website owner. It signs login sessions.

If `JWT_SECRET` is replaced, existing users and data remain safe, but everyone currently signed in must log in again.

## Save the production secrets now

Store the following entries in a trusted password manager or encrypted backup:

```text
Site name: Math Department Portal
Production URL: https://www.gcsmd.site
GitHub repository: https://github.com/naurez-khan/GCS-Website.git
DATABASE_URL: paste the pooled Neon connection string here
JWT_SECRET: paste the production JWT secret here
NODE_ENV: production
ADMIN_EMAIL: record the administrator email here
Hosting account: record the hosting provider and account email here
Neon account: record the Neon account email and project name here
```

Keep at least two secure copies, for example:

- One entry in a password manager
- One encrypted backup stored offline or in a trusted cloud drive

Never place the completed secret list in GitHub, email, ordinary notes, or a public cloud document.

## Create a new JWT secret

If the original JWT secret cannot be recovered, create a new one on a trusted computer:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value directly into the hosting provider's `JWT_SECRET` environment variable and into the secure password-manager entry. Do not paste it into source code or commit it.

After changing `JWT_SECRET`, redeploy or restart the website. Existing login sessions will become invalid and users will need to sign in again.

## Find the Neon connection string

1. Sign in to the Neon account.
2. Open the Math Department Portal project.
3. Open the connection details.
4. Select the pooled connection string.
5. Ensure the string includes `sslmode=require`.
6. Save it as `DATABASE_URL` in the hosting provider and password manager.

The database connection string contains a password and must be treated as a secret.

## Restore the project on another computer

Install Git and Node.js 20 or newer, then run:

```powershell
git clone https://github.com/naurez-khan/GCS-Website.git
cd GCS-Website
npm install
npm --prefix backend install
```

For a local PostgreSQL database, copy `backend/.env.example` to `backend/.env` and enter the local database values plus a private `JWT_SECRET`.

For Neon, configure these values in the hosting provider:

```text
DATABASE_URL=<pooled Neon connection string>
JWT_SECRET=<private random value of at least 32 characters>
NODE_ENV=production
```

Then apply every database migration:

```powershell
npm --prefix backend run migrate
```

Run the verification checks:

```powershell
npm run check
npm test
npm --prefix backend run check:db
```

Start a local copy with:

```powershell
npm --prefix backend start
```

Then open `http://localhost:5000/test-login.html`.

## Restore or replace the administrator account

The administrator account is normally stored in the database. If a new database has been created and it contains no administrator, temporarily configure:

```text
ADMIN_NAME=<administrator name>
ADMIN_EMAIL=<administrator email>
ADMIN_PASSWORD=<strong temporary password>
```

Then run:

```powershell
npm --prefix backend run create-admin
```

Remove the temporary administrator password from the environment after the account is created.

## Routine backup checklist

Perform this checklist after important development work:

1. Commit and push all intended source-code changes to GitHub.
2. Confirm the production deployment completed successfully.
3. Confirm the latest database migrations were applied to Neon.
4. Verify that the password-manager entry contains the current `DATABASE_URL` and `JWT_SECRET`.
5. Keep a recent Neon database backup or use the recovery features available for the Neon project.
6. Open the production website and test administrator login, teacher login, attendance history, and one export.

## What GitHub does not back up

GitHub does not automatically contain:

- Neon database records
- Environment variables or `.env` files
- Uncommitted local changes
- Untracked output files
- Hosting-provider configuration

The code, database, and private configuration must therefore be protected separately.
