# Close Circle v2

A personal CRM for the people who matter most. Single-tenant, multi-user (household). AI-first — the chat interface can read and write all your contact data in natural language.

Built on **Node.js + Hono** · **DuckDB (local file)** · **React 18 + Vite** · runs in **Docker Compose** behind nginx.

> This is a self-hosted household tool, not a SaaS. It's designed to run on a private network (e.g. a Tailscale tailnet), not on the open internet.

---

## Features

- Contacts with rich fields — organization, title, notes, factoids, groups, contact methods, photos, private contacts
- Interaction log per contact (type, date, notes) with edit/delete
- Reminders — standalone or linked to a contact, with day-interval or annual recurrence
- Important dates — birthdays, anniversaries, with "Turning N" and day-of push notifications
- AI chat (Groq, via the `openai` SDK) with tool calls covering all CRM operations, streamed over SSE
- Push notifications via FCM (sent server-side only), including "Mark Complete" from the notification
- CSV and vCard import/export
- Per-user theming — accent color, font, density, light/dark/system

---

## Getting Started

### Prerequisites

- Docker + Docker Compose (for the full stack)
- Node 20+ (for local dev servers)

### Configure

```bash
cp api/.env.example api/.env
cp app/.env.example app/.env
```

`api/.env` (secrets — never committed, never baked into an image):

```bash
DUCKDB_PATH=/data/close_circle.duckdb
JWT_SECRET=                     # required, ≥ 32 chars (API refuses to start otherwise)
COMPLETION_SECRET=              # required, ≥ 32 chars — signs notification "complete" links
GROQ_API_KEY=                   # required for AI chat
GOOGLE_SERVICE_ACCOUNT_JSON={}  # required for push notifications
FCM_PROJECT_ID=                 # required for push notifications
ALLOW_REGISTRATION=false        # see "First run" below
```

Generate secrets with `openssl rand -base64 32`.

`app/.env` holds the public Firebase web config (`VITE_FIREBASE_*`). It's only needed for push notifications. Vite bakes these values into the JS bundle at build time — they are public by design, so restrict the Firebase API key to your domain in the Google Cloud console.

### First run

```bash
docker compose up --build -d
```

Open http://localhost:8090 and use **Create Account**. Registration is open only while there are no users; after the first account exists it's closed. To add another household member, set `ALLOW_REGISTRATION=true` in `api/.env`, restart the API (`docker compose up -d api`), register, then set it back to `false`.

### Local dev servers

```bash
npm install
npm run dev:api   # Node.js API server → http://localhost:8787
npm run dev:app   # Vite frontend    → http://localhost:5173
```

---

## Container / Production

```
nginx (port 8090 → 80)   serves the built React SPA + proxies /api/* to the api container
api  (internal :8787)    Node.js + Hono, DuckDB file at /data/close_circle.duckdb (volume: duckdb_data)
```

- The nginx image is built from `app/Dockerfile` (multi-stage: Node builder → nginx:alpine). Its config is bind-mounted from `nginx/nginx.conf`.
- The api image is built from `api/Dockerfile` (Node 20 slim, runs `dist/server.js`). SQL migrations in `api/migrations/` apply automatically at startup.
- Only port 8090 is published; the API is reachable only inside the Docker network.
- Reminder and important-date notifications run from an in-process `node-cron` job every 5 minutes.

### Common commands

```bash
docker compose build && docker compose up -d   # rebuild + recreate after code changes
docker compose ps                              # api should be "healthy"
docker compose logs -f api
curl http://localhost:8090/api/health
./backup.sh                                    # stop api, copy DB to backups/, restart
```

> `docker compose build` alone does not update running containers — always follow it with `docker compose up -d`. `docker compose down -v` **deletes the database volume**.

If you change any `VITE_*` value, rebuild the nginx image (`docker compose build nginx && docker compose up -d nginx`).

### Deploying from another machine

`sync-and-deploy.sh` rsyncs the repo to a server and runs `deploy.sh` there. Put the target in a gitignored `.deploy.env`:

```bash
DEPLOY_SERVER="user@your-server"
DEPLOY_DIR="~/close-circle-v2"
DEPLOY_URL="https://your-host.example.ts.net"
```

### Timezone

The `api` container runs with `TZ=America/New_York` (set in `docker-compose.yml`) — change it to your own zone. The dates cron computes "today" in the container's timezone; in UTC, important-date notifications would fire a day early for US time zones.

---

## Architecture

```
/
  api/            Node.js + Hono API server
    src/
      server.ts       entry point: migrations, HTTP server, node-cron
      index.ts        Hono app + route registration
      auth.ts         JWT middleware (jose) + bcrypt
      db.ts           duckdb-async singleton connection
      routes/         REST endpoints
      tools/          AI tool implementations (used by chat route)
      cron/           reminder + important-date notification jobs
    migrations/       numbered .sql migrations
  app/            React 18 + TypeScript + Vite PWA
    src/
      features/       contacts, reminders, dates, chat, settings, auth
      components/     shared UI
      hooks/          TanStack Query data hooks
      stores/         Zustand UI state
      lib/            api.ts (typed fetch wrapper), auth.ts (token storage)
      utils/          dates, CSV/vCard import + export
  nginx/          nginx.conf
  schema.sql      canonical schema
```

See [`CLAUDE.md`](CLAUDE.md) for the detailed architecture, conventions, and change checklist.

### Security notes

- All user data is scoped by `user_id` in the query layer; contacts are shared across the household unless marked private.
- The DuckDB connection is opened with external file access disabled and its configuration locked, so SQL cannot read host files, attach other databases, or install extensions.
- `POST /api/query` (read-only SQL for agent/MCP integrations) accepts a single `SELECT` statement and cannot read the `users` or `device_tokens` tables.
- Failed logins are throttled per email. JWTs are valid for 30 days.
- Password reset is manual (requires server access) — see `CLAUDE.md`.

---

## Data Model (summary)

```
users               one per household member
contacts            people you know — belongs to a user
contact_methods     email, phone, address, social links
relationships       links between contacts (no UI yet)
interactions        logged touchpoints — meeting, call, note, etc.
important_dates     recurring annual events — birthday, anniversary
reminders           tasks with a due date, optional recurrence
chat_sessions       AI conversation threads
chat_messages       individual messages + full tool call audit trail
device_tokens       FCM tokens for push notifications
user_preferences    per-user theming + settings
```

Full schema: [`schema.sql`](schema.sql)

---

## Roadmap

- Relationship graph between contacts (table exists, no routes/UI)
- Contact timeline view (interactions + dates in one scrollable history)
- Global group management (rename/merge)
- Chat session rename/delete
- MCP endpoint so other agents can drive the CRM directly
