# Secure Backup and Cloudflare Transfer Guide

Last reviewed: 16 September 2026

This guide covers two separate goals:

1. Creating a recoverable and secure backup of the Math Department Portal
2. Moving the domain or application to Cloudflare

## Part 1: Create a secure backup

### A ZIP of the project is not a complete backup

The project folder contains the website code, but the live records are stored in Neon. A complete recovery set therefore needs:

- The source code
- A PostgreSQL database backup
- The production environment variables
- Access details for GitHub, Neon, the hosting provider, Cloudflare, and the domain registrar

### Recommended backup set

Create these three separate items.

#### 1. Source-code archive

Create a ZIP containing the project source, but exclude:

```text
backend/.env
backend/.env.neon
node_modules/
backend/node_modules/
output/
outputs/
tmp/
*.log
```

These folders are either secret, temporary, or can be rebuilt. The GitHub repository is also a source-code backup, but an additional offline copy is useful.

Use a filename that includes the date and Git commit, for example:

```text
GCS-Website-source-2026-09-16-8ec5f64.zip
```

#### 2. Encrypted recovery archive

If a backup must contain `backend/.env`, do not use an ordinary unencrypted ZIP. Create an encrypted archive using AES-256 encryption, such as a password-protected 7-Zip archive.

Use a long, unique archive password and store that password only in a trusted password manager. Do not store the password beside the archive.

The encrypted recovery archive may contain:

```text
backend/.env
RECOVERY_GUIDE.md
CLOUDFLARE_TRANSFER_GUIDE.md
an inventory of account names and project IDs
```

It should not contain ordinary account passwords if those are already protected by a password manager.

#### 3. Neon database backup

The project ZIP does not include Neon data. Keep a separate PostgreSQL dump or a verified Neon snapshot.

For a manual dump, use the **unpooled** Neon connection string with `pg_dump`, not the pooled application connection string:

```powershell
pg_dump -Fc -v -d "<UNPOOLED_NEON_CONNECTION_STRING>" -f "gcs-neon-2026-09-16.dump"
```

Treat the database dump as sensitive because it contains student and teacher information. Put it inside an AES-256 encrypted archive before storing it in cloud storage or on removable media.

To test a backup safely, restore it into a separate empty PostgreSQL database or Neon test project. Never test a restore by overwriting production.

Official Neon reference: https://neon.com/docs/import/migrate-from-neon

### Where to keep backups

Follow the 3-2-1 principle:

- Keep at least three copies
- Use at least two different storage types
- Keep at least one copy away from the main computer

A practical setup is:

- GitHub for source code
- One encrypted archive in a private cloud drive
- One encrypted archive on an external drive stored safely
- Neon snapshot plus an occasional encrypted `pg_dump`

### Protect the accounts

Enable multi-factor authentication for:

- GitHub
- Neon
- Cloudflare
- Hosting provider
- Domain registrar
- The email account used to recover those services

Store recovery codes in the password manager and in one encrypted offline backup. Use different passwords for every service.

### Verify the archive

After creating a backup:

1. Confirm that the archive opens.
2. Confirm that `package.json`, `frontend/`, `backend/`, `database/`, and the recovery guides are present.
3. Confirm that the public source ZIP does **not** contain `.env` or a database dump.
4. Confirm that the encrypted archive requires its password.
5. Record the current Git commit with `git log -1 --oneline`.
6. Test restoration on another folder or computer when practical.

## Part 2: Understand the Cloudflare options

There are two sensible Cloudflare approaches for this application.

### Option A — Recommended: Cloudflare protects the existing host

Keep the Node/Express application on its current Node-compatible host and keep Neon as the database. Move only DNS, HTTPS proxying, caching, and security controls to Cloudflare.

Benefits:

- No application rewrite
- Lower migration risk
- Cloudflare can protect and accelerate the public domain
- Neon remains unchanged
- The existing PDF, Excel, Express, cookie, and PostgreSQL behavior remains on a normal Node.js server

Architecture:

```text
Visitor → Cloudflare DNS/proxy → Current Node host → Neon PostgreSQL
```

This is the best first Cloudflare step for the current project.

### Option B — Full migration to Cloudflare Workers

Move the frontend assets and backend API to a Cloudflare Worker, while keeping PostgreSQL in Neon and optionally connecting through Cloudflare Hyperdrive.

This is not a direct upload of the existing ZIP. The current application starts an Express server with `app.listen()` and uses Node-oriented PDF, Excel, cookie, and database libraries. A Worker receives requests through a `fetch` handler instead of running a permanent Node server. The backend entry point and any incompatible libraries must therefore be adapted and fully tested.

Cloudflare Workers supports static assets and Node.js compatibility, and Cloudflare recommends `node-postgres` for PostgreSQL through Hyperdrive. That makes a migration possible, but it is a development project rather than a configuration-only transfer.

Official references:

- Workers static assets: https://developers.cloudflare.com/workers/static-assets/
- Deploying full-stack assets: https://developers.cloudflare.com/workers/static-assets/get-started/
- PostgreSQL with Hyperdrive: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/
- Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/

## Part 3: Recommended Cloudflare DNS migration

### Before changing DNS

1. Confirm the production website works on the current host.
2. Record every existing DNS record at the current DNS provider.
3. Record the current hosting target supplied by the host.
4. Confirm access to the domain registrar.
5. Confirm access to the email provider. Missing MX, SPF, DKIM, or DMARC records can break email.
6. Create a fresh source backup and database backup.
7. Do not cancel the existing hosting account.

### Add the domain to Cloudflare

1. Create or sign in to the Cloudflare account.
2. Select **Onboard a domain**.
3. Enter `gcsmd.site`.
4. Choose the desired plan.
5. Let Cloudflare scan the existing DNS records.
6. Compare the imported records with the records saved from the current DNS provider.

Official setup instructions: https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/

### Review DNS carefully

Before changing nameservers, verify:

- The root-domain record for `gcsmd.site`
- The `www` record
- Any host-verification records required by the current hosting provider
- MX records
- SPF, DKIM, and DMARC TXT records
- Any subdomains in use

Do not proceed if important records are missing.

### Change nameservers

1. Copy the two Cloudflare nameservers shown for the domain.
2. Open the domain registrar's nameserver settings.
3. If DNSSEC is active at the old provider, follow Cloudflare's DNSSEC transition guidance before changing nameservers.
4. Replace the old nameservers with the two Cloudflare nameservers exactly.
5. Remove any additional old nameservers.
6. Wait for Cloudflare to show the domain as **Active**. Propagation can take time.

Keep the old host active throughout this process.

### Configure the proxy and HTTPS

1. Proxy the website records through Cloudflare only after their targets are correct.
2. Use an end-to-end HTTPS mode appropriate for an origin that has a valid certificate; do not rely on insecure HTTP between Cloudflare and the origin.
3. Enable automatic HTTPS redirects after confirming HTTPS works.
4. Do not cache authenticated API responses or HTML containing private user data.
5. Test login cookies, admin pages, attendance saving, exports, and logout.

### Test before considering the migration complete

Test all of the following on the production domain:

- Administrator login and logout
- Teacher login and logout
- Class approval
- Class creation and editing
- Attendance save and history
- Public holidays
- Marks and Class Tests
- Published student results
- Excel exports
- Lecture Statement PDF
- Mobile layout
- Email delivery, if the domain also handles email

Only after several successful days should any old DNS or hosting configuration be removed.

## Part 4: Plan for a full Workers migration

Do this in a separate Git branch and a separate Cloudflare test environment.

### Development work required

1. Add Wrangler configuration with a current compatibility date and Node.js compatibility.
2. Configure `frontend/` as Worker static assets.
3. Replace the permanent Express server entry point with a Worker-compatible request handler or an appropriate framework adapter.
4. Keep `/api/*` requests routed to the Worker before static assets.
5. Replace direct process assumptions that are unavailable in the Worker runtime.
6. Connect PostgreSQL through a Hyperdrive binding or a thoroughly tested direct Neon connection.
7. Test `pg`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `ExcelJS`, `xlsx`, and `PDFKit` in the Worker runtime.
8. Recheck secure-cookie behavior and CORS.
9. Move `DATABASE_URL` and `JWT_SECRET` into Cloudflare encrypted secrets, never plaintext Wrangler variables.
10. Run database migrations separately against Neon before sending production traffic to the new Worker.

### Secrets

In Cloudflare Workers, store private values as encrypted secrets:

```powershell
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
```

Cloudflare hides secret values after they are configured. Keep the original values in the password manager because the dashboard is not a backup of the readable secret.

Never put real values in `wrangler.jsonc`, source files, GitHub, screenshots, or support messages.

### Database connection

For Hyperdrive, create a Hyperdrive configuration connected to the Neon PostgreSQL database, then bind it to the Worker. The application database module must use the binding's connection string. Use a supported `pg` version and the Node.js compatibility settings required by Cloudflare.

Do not change the production database connection and application host simultaneously. First deploy and test against a separate Neon branch or test database.

### Staged cutover

1. Deploy to a temporary `workers.dev` address.
2. Run the full automated test suite.
3. Perform the manual workflow checklist.
4. Use a test database or Neon branch first.
5. Add a test subdomain such as `cloud-test.gcsmd.site`.
6. Test with real browsers and mobile devices.
7. Take a new production database backup.
8. Apply pending migrations.
9. Point the production custom domain to the Worker.
10. Monitor errors, database connections, login failures, and export failures.
11. Keep the previous host available for rollback until the Worker deployment is proven stable.

## Rollback plan

Before any DNS or hosting cutover, document:

- The previous DNS records
- The previous hosting target
- The previous deployed Git commit
- The Neon branch or snapshot to restore
- Who has access to Cloudflare, Neon, GitHub, and the registrar

If the new deployment fails, direct the domain back to the previous healthy host. A hosting rollback normally should not require restoring the database unless the migration changed or damaged data.

## Recommendation for this portal

Use Cloudflare DNS and proxy protection in front of the existing Node-compatible host first. Do not move the backend to Workers until the Express entry point, database connection, PDF generation, Excel generation, authentication, and automated tests have been deliberately adapted and verified in a separate environment.
