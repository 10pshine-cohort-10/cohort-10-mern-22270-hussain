# cohort-10-mern-22270-hussain — Folio Notes

Cohort 10 — MERN (NodeJS+ReactJS) assignment for Hussain Rizvi.

A full-stack personal notebook using React, Express/Node.js and **MySQL**. This follows the requested SQL database choice rather than MongoDB.

## Requirements

Node.js 22 or newer, npm, and MySQL 8.4 (or Docker Desktop).

## Run locally

From this directory in PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
# Generate a secret, then put its value in JWT_SECRET in .env:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up -d mysql --wait
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:5173. Register an account to start; there are no seeded credentials. Use this exact host (rather than localhost) because write requests and WebSocket connections validate APP_ORIGIN.

If using an existing MySQL installation, create the `notes` database and a dedicated user with schema/data permissions, update the DB variables in `.env`, and skip the Docker command. Migrations are explicit, repeatable table creation; future schema changes should be added as versioned migrations.

After configuring `.env`, Windows users can also run `./Start-Local.ps1`. It checks for an existing local database, starts MySQL through Docker when available, installs missing dependencies, migrates the schema and launches the app. No database files or private environment configuration are included in this repository.

## Assignment submission

The implementation is submitted on `feature/notes-app-submission` in [Hrizvi01's fork](https://github.com/Hrizvi01/cohort-10-mern-22270-hussain), with ten named implementation commits above the original assignment commits. The pull request targets `main` in [the cohort repository](https://github.com/10pshine-cohort-10/cohort-10-mern-22270-hussain). The original `.coderabbit.yaml` is preserved for automated review. The optional chatbot has been removed; this submission contains the Notes App only.

## Features

- Sign up, log in, log out; hashed passwords, HttpOnly session cookies, session revocation on logout.
- Owner-scoped CRUD; every note query includes its authenticated owner.
- Responsive notes dashboard, profile, empty states, error messages and deletion confirmation.
- Rich text: headings, bold, italic, lists, quotes, undo/redo. HTML is sanitized on the server.
- Color collections, pinning, search across titles/content.
- JSON export/import (maximum 500 notes per import, transactional database writes).
- Socket.IO updates across tabs for the same user; live updates do not overwrite an open editor. Saving an editor uses last-write-wins behavior.
- Pino structured HTTP/event/exception logs; cookies and authorization headers are redacted. Note content and passwords are not logged. Global middleware returns safe error messages.
- Mocha/Chai backend/controller/service/repository tests, Jest frontend tests, real MySQL integration suite, CI and SonarQube configuration.

## Commands

```powershell
npm test
npm run test:integration # requires a migrated MySQL database
npm run test:live # optional: requires the app server running as well
npm run build
npm start
```

For a production build served by Node locally, change APP_ORIGIN to http://127.0.0.1:3001 and keep NODE_ENV=development for HTTP testing. For deployment, use HTTPS and NODE_ENV=production (enables secure cookies), set APP_ORIGIN to the HTTPS origin, and place a reverse proxy in front of the loopback-bound Node server. Forward WebSocket upgrades. Use private database access, unique credentials and persistent backups. The server never needs to expose MySQL publicly.

## SonarQube

```powershell
docker compose --profile quality up -d sonarqube
# Open http://127.0.0.1:9000, change initial admin password, create project folio-notes and a token.
npm test
$env:SONAR_HOST_URL = 'http://127.0.0.1:9000'
$env:SONAR_TOKEN = '<your-token>'
sonar-scanner
```

Install SonarScanner CLI separately. The included project configuration imports both LCOV reports. In SonarQube, assign the JavaScript **Sonar way** quality profile and quality gate to `folio-notes`; customize rules there. There are no TypeScript files. GitHub CI runs analysis when repository variable `SONAR_HOST_URL` and secret `SONAR_TOKEN` are set; the URL must be reachable from the runner. The local Docker server is not reachable from GitHub-hosted runners without additional networking or a self-hosted runner. A passing analysis/gate must be verified on the actual SonarQube server.

## API

All writes require an Origin matching APP_ORIGIN and JSON request bodies. Auth uses cookies. Errors use `{error, requestId}`.

| Method         | Path               | Purpose                                                          |
| -------------- | ------------------ | ---------------------------------------------------------------- |
| POST           | /api/auth/register | name, email, password (10–72 characters; maximum 72 UTF-8 bytes) |
| POST           | /api/auth/login    | email, password                                                  |
| POST           | /api/auth/logout   | Revoke all sessions for this account                             |
| GET            | /api/auth/me       | Current public profile                                           |
| GET            | /api/notes         | Own notes, pinned then newest first                              |
| POST           | /api/notes         | Create title, content (HTML), color, pinned                      |
| GET/PUT/DELETE | /api/notes/:id     | Read/update/delete own note                                      |
| GET            | /api/notes/export  | Download portable JSON                                           |
| POST           | /api/notes/import  | Import `{notes: [...]}`                                          |
| GET            | /api/health        | Database connectivity health                                     |

## Structure and Git workflow

`client/` contains React UI and API helpers. `server/` separates HTTP controllers, services, parameterized data access and SQL schema. `test/` contains backend, frontend and opt-in database integration tests.

Use `main` as the stable branch. Create `feature/<name>` branches, make focused commits, and merge through a reviewed pull request after tests/build/quality checks pass. `.env`, dependencies, logs, build artifacts and coverage are ignored. Do not commit credentials or database exports containing private notes.
