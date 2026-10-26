# Close Circle v2 — CLAUDE.md

> Personal CRM. Single-tenant, multi-user (family). AI-first, agentic-forward.
> Built on Node.js + Hono + DuckDB (local file, in Docker). Designed to be read/written by humans and agents equally well.

---

## What This App Is

Close Circle is a personal relationship manager for a small group of trusted users (family members). It helps users:

- Keep rich records on the people they care about
- Log interactions, set reminders, and track important dates
- Talk to an AI assistant that can read and write their CRM data naturally
- Get push notifications for reminders and upcoming dates

It is **not** a SaaS product. There are no tenants, no subscription tiers, no billing, no invite flows. Think of it as a shared household tool — like a family wiki for your relationships.

---

## Business Requirements

Since time is critical to relationship management and creating reminders, ensure time entry and formatting is consistent throughout the UI. Ensure time-date accounts for user's local time. 

While the app is AI native and hyper integrated for agentic interface, the UI is still important. Pay attention to style queues for the best possible user-centered product, regardless of modality. 

### Must-have
- Contact management: full CRUD with rich fields (name, org, role, notes, factoids, groups, contact methods)
- Interaction log: timestamped touchpoints per contact (type, date, freeform notes)
- Reminders: due-date tasks, optionally linked to a contact, with optional recurrence
- Important dates: recurring annual events (birthdays, anniversaries) with push notification support
- AI chat: natural language interface that can read *and write* all CRM data via structured tool calls
- Push notifications: FCM-based, web PWA + mobile, sent server-side only (no keys in frontend)
- User customization: accent color, font, layout density — stored per user, applied globally

### Nice-to-have
- Relationship graph between contacts
- Contact timeline view (interactions + dates on a single scrollable history)
- Bulk import from CSV (contacts) and the legacy close-circle exports (interactions, reminders)
- Duplicate detection on import

### Explicitly out of scope
- Multi-tenancy
- Subscription/billing
- Contact sharing between users (all contacts are visible to all users in the household)
- Email digest / scheduled email notifications
- Attachment uploads
- Native mobile app (PWA is sufficient)

---

## Data Model

The canonical schema lives in `schema.sql`. All tables use `TEXT` primary keys (UUIDs generated in application code). No `SERIAL` / auto-increment — IDs must be portable across import/export.

### Core tables

```
users               id, email, name, created_at
contacts            id, user_id, full_name, nickname, organization, title,
                    date_of_birth, type, notes, is_self, groups[], factoids[], created_at, updated_at
contact_methods     id, contact_id, type, value, label, is_primary
relationships       id, contact_id, related_contact_id, relationship_type, notes
interactions        id, contact_id, user_id, type, date, notes, created_at
important_dates     id, contact_id, user_id, title, date, notes, last_notified_year
reminders           id, contact_id (nullable), user_id, title, notes, due_date,
                    completed, completed_at, recurrence_days, recurrence_end_date, created_at
chat_sessions       id, user_id, title, created_at, updated_at
chat_messages       id, session_id, role, content, tool_calls (JSON), created_at
device_tokens       id, user_id, token, platform, created_at, last_seen
user_preferences    user_id, theme, accent_color, font_family, layout, custom_css, settings (JSON)
```

### Design rules
- Every table that belongs to a user has a `user_id` column. All queries must be scoped to `user_id` — enforced in the query/service layer, not in the DB.
- `contact_methods` handles email, phone, address, and social links. `type` is one of: `email | phone | address | social`. For social, `label` is the platform name.
- `groups` and `factoids` on contacts are stored as **JSON TEXT** (a JSON array serialized to a string), NOT DuckDB `TEXT[]`. They are parsed/serialized in the application layer (`parseContactArrays` in `api/src/routes/contacts.ts`). **Do not change them back to `TEXT[]`** — MotherDuck/DuckDB raises a false FK-constraint error when updating a native array column on any row that has child rows (see the comment in `schema.sql`).
- `chat_messages.tool_calls` is a JSON array of `{tool, input, output, success}` objects. This is the full audit trail — do not use a separate table.
- `reminders.contact_id` is nullable — standalone reminders (not linked to a person) are valid and common.

---

## Tech Stack

> **Note on drift:** earlier versions of this doc described a Cloudflare Workers + MotherDuck deployment. The app now runs as a **Node.js server in Docker** against a **local DuckDB file**.

### Backend API
- **Runtime:** Node.js 20 (`node:20-slim` Docker image) running a **Hono** app via `@hono/node-server`. Entry point `api/src/server.ts` (starts migrations, then the HTTP server + in-process cron).
- **Database:** **DuckDB** (`duckdb-async`) on a **single local file** at `/data/close_circle.duckdb`, persisted in a Docker volume (`duckdb_data`). One singleton connection shared across requests. No MotherDuck in the runtime path.
- **Auth:** JWT issued by the API, verified on every request via middleware in `auth.ts`. Bcrypt for password hashing. No third-party auth provider.
- **Push:** FCM HTTP v1 API called server-side only. FCM credentials live in `api/.env` (container env), never the frontend.
- **Scheduled jobs:** in-process `node-cron` in `api/src/server.ts` — a job every 5 minutes checks due reminders and upcoming important dates (`cron/reminders.ts`, `cron/dates.ts`).
- **Timezone (important):** the `api` container runs with `TZ=America/New_York` (set in `docker-compose.yml`). `important_dates.date` is a `DATE` column (a timezone-independent calendar day), but the dates cron computes "today" via `new Date().getDate()` in `cron/dates.ts`, evaluated in the container's zone. If the container runs in UTC, that flips to the next calendar day at 8pm EDT, so date notifications fire one local day early. Do not remove the `TZ` env var.
- **AI:** **GROQ** via the `openai` SDK pointed at `https://api.groq.com/openai/v1` (model in `routes/chat.ts`). The `/chat` endpoint runs the agentic tool loop and streams responses over SSE. Long-term goal: expose an MCP endpoint so other agents (opencode, Open WebUI) can drive the CRM.

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS with CSS custom properties for theming
- **State:** Zustand (one store per domain: contacts, reminders, chat, ui/preferences)
- **Data fetching:** TanStack Query — all server state goes through it
- **Routing:** React Router v6
- **PWA:** Vite PWA plugin + Firebase messaging service worker for background push

### Monorepo layout
```
/
  api/          Node.js + Hono API (Docker)
    src/
      server.ts       process entry: runs migrations, starts server + node-cron
      index.ts        Hono app: middleware + route registration
      auth.ts         JWT middleware
      db.ts           DuckDB (duckdb-async) connection factory
      routes/
        contacts.ts
        interactions.ts
        reminders.ts
        dates.ts
        chat.ts
        notifications.ts
        users.ts
      tools/          AI tool implementations (used by chat route)
        index.ts      tool registry
        contacts.ts
        interactions.ts
        reminders.ts
        dates.ts
      cron/
        reminders.ts  due reminder check + FCM dispatch
        dates.ts      upcoming date check + FCM dispatch
      migrations/     numbered .sql migrations (applied automatically at startup)
    Dockerfile        node:20-slim, builds + runs dist/server.js

  app/          React frontend
    src/
      components/     pure UI components
      features/       domain feature modules (contacts, reminders, chat, dates)
      stores/         Zustand stores
      hooks/          TanStack Query hooks (data fetching + mutations)
      lib/
        api.ts        typed API client (fetch wrapper)
        auth.ts       token storage + refresh
      types/          shared TypeScript types (mirrored from schema)
      utils/
        csv.ts        CSV import/export helpers
        dates.ts      date formatting utilities
    public/
      firebase-messaging-sw.js

  schema.sql    canonical schema (symlinked / duplicated into api/)
  CLAUDE.md     this file
```

---

## System Architecture (as deployed)

This is the wiring diagram. Read this before touching routing, the DB, or deployment.

```
                ┌───────────────────────────  Docker Compose  ───────────────────────────┐
                │                                                                        │
 Browser ──►   nginx:8090   (public; only published port)                                │
   (PWA)        │  serves built React SPA (app/dist)                                     │
                │  proxies /api/*  ──────────────┐                                       │
                └────────────────────────────────┼───────────────────────────────────────┘
                                                 ▼
                                       api:8787  (Hono on Node, container-internal)
                                                 │
                                                 │  duckdb-async, one singleton conn
                                                 ▼
                                    /data/close_circle.duckdb
                                    (Docker volume: duckdb_data — survives rebuilds)
```

- **Only port 8090 is published** (nginx). The API port 8787 is reachable only inside the `internal` Docker network. From the host, test API routes through nginx: `http://localhost:8090/api/...`.
- **Reachable from the tailnet** via Tailscale (hostname and server address are in the gitignored `.deploy.env` / `CLAUDE.local.md`).
- **Auth flow:** browser holds a JWT (localStorage via `app/src/lib/auth.ts`). Every `/api/*` request sends `Authorization: Bearer <jwt>`; the middleware in `api/src/auth.ts` validates it and sets `c.get('userId')`. Public paths (`/api/auth/*`, `/api/health`, the reminder-completion webhook, public photos) skip auth.

### Request flow (one example — logging an interaction)
```
UI  (ContactDetail.tsx — "Log Interaction" modal)
  → useLogInteraction().mutate  (app/src/hooks/useInteractions.ts)
  → api.post('/api/contacts/:id/interactions', body)  (app/src/lib/api.ts — adds Bearer token)
  → nginx :8090  →  api :8787  →  interactionsRouter  (api/src/routes/interactions.ts)
  → createDb(env) → DuckDB INSERT  (contact ownership checked via user_id)
  → { data: interaction } back up the same path
  → hook's onSuccess invalidates ['interactions', id] + ['contacts', id]
  → detail page refetches the contact, which re-embeds the updated interactions
```

### The data-embedding gotcha (important for list UIs)
`GET /api/contacts/:id` does **not** just return the contact row. It embeds, on the same object:
- `contact_methods` (from `contact_methods`)
- `interactions` — last 10, `SELECT * FROM interactions WHERE contact_id = ?` (**not** user-scoped — all interactions on a visible contact are shown)
- `important_dates` (from `important_dates`)

So the **Recent Interactions / Important Dates sections in `ContactDetail.tsx` render off the contact object**, not a separate `useInteractions` fetch. After an add/edit/delete, mutations invalidate the `['contacts', id]` query so the embedded arrays refresh. (The standalone `useInteractions` query against `/api/contacts/:id/interactions` also exists but the detail page's list uses the embedded data.)

### Deploying a change
1. Edit code in `~/close-circle-v2`.
2. `docker compose build <api|nginx>` (or both) then `docker compose up -d` — or just run `./deploy.sh` from the server, which does `docker compose up --build -d`.
3. Verify: `docker compose ps` (api should be **healthy**), and `curl http://localhost:8090/api/health`.
4. From a dev machine, `./sync-and-deploy.sh` rsyncs local code to the server (excluding `.env`, `node_modules`, `dist`) and runs the remote deploy.

---

## How to Make a Change (checklist)

The repeating "wiring" pattern for any CRUD feature. Each feature touches up to four places:

1. **Route** — `api/src/routes/<feature>.ts`. Register in `api/src/index.ts` (routers are mounted at both a nested path like `/api/contacts` and, where needed, a flat path like `/api/interactions`). Validate the body with **Zod**. Always scope writes/reads to `user_id`. For edit/delete, look the record up by `id` **and** `user_id` first (404 if not found), then `UPDATE`/`DELETE`.
2. **Hook** — `app/src/hooks/use<Feature>.ts`. One `useMutation` per verb (`useLogX`, `useUpdateX`, `useDeleteX`). On `onSuccess`, **invalidate the relevant TanStack Query keys** — both the feature key (e.g. `['interactions']`) **and** `['contacts']`/`['contacts', id]` (because contact detail embeds the child arrays).
3. **UI** — `app/src/features/<domain>/*.tsx`. For edit/delete, follow the existing **Important Dates** pattern in `ContactDetail.tsx`: a small pencil (edit) + X (delete) icon on each row; editing swaps the row for an inline form with Save/Cancel. Keep icon sizes/colors consistent with the dates rows.
4. **AI tool** (if the feature is agent-addressable) — add a matching tool in `api/src/tools/<feature>.ts` and register it in `api/src/tools/index.ts`. The chat should be able to do anything the UI can.
5. **Schema change?** Add a new numbered file in `api/src/migrations/` (e.g. `0008_foo.sql`). Migrations run automatically at container start (`runMigrations` in `server.ts`) and are tracked in the `schema_migrations` table — never re-apply an applied file. **Also update `schema.sql`**: a fresh (empty) database is bootstrapped from `schema.sql` and all migrations are marked applied, so it must always reflect the latest schema.
6. **Rebuild + verify** — see "Deploying a change". Typecheck the frontend with `npx tsc --noEmit` in `app/` (the API's local `node_modules` is incomplete, so typecheck it inside Docker / via the build instead).

### Cache-invalidation rule of thumb
Child collections (interactions, dates, reminders, contact methods) are embedded on the contact object. Any mutation to a child **must** also invalidate the parent contact query, or the detail page goes stale.

---

## AI Chat — Architecture

The chat feature is the primary interface for power users. Design it to be fully agentic: the AI can perform any read or write operation a human user can.

### Flow
```
User message
  → POST /api/chat/:sessionId
  → Auth middleware validates JWT, extracts user_id
  → Chat route loads recent message history (last 20 messages)
  → Calls GROQ (openai SDK, openai/gpt-oss-120b) with system prompt + history + tool definitions
  → Model may call tools (zero or more rounds)
  → Each tool call: execute → append result to message → continue
  → Final text response streamed back to client (SSE)
  → All messages + tool calls persisted to chat_messages
```

### Tool definitions (implement all of these)
```
search_contacts(query)                    → Contact[]
get_contact(id)                           → Contact (full, with methods + recent interactions)
create_contact(fields)                    → Contact
update_contact(id, fields)                → Contact
list_interactions(contact_id, limit?)     → Interaction[]
log_interaction(contact_id, type, date, notes) → Interaction
list_reminders(filter?)                   → Reminder[]   filter: {due_before, completed, contact_id}
create_reminder(fields)                   → Reminder
complete_reminder(id)                     → Reminder
list_important_dates(contact_id?)         → ImportantDate[]
add_important_date(contact_id, title, date, notes?) → ImportantDate
get_user_context()                        → {user, upcoming_reminders, upcoming_dates}  (orientation tool)
```

### System prompt principles
- The AI knows it is operating inside a personal CRM on behalf of a specific user.
- It should be concise and action-oriented. Confirm what it did, not what it's about to do.
- When creating records, prefer action over confirmation (just do it, then say what you did).
- `get_user_context` should be called automatically at the start of every new session to orient the AI.
- The AI must never fabricate contact data. If a contact isn't found, say so.

### Streaming
The chat endpoint streams over **SSE** (`data: {...}\n\n` frames). The frontend (`app/src/lib/api.ts` → `streamChatMessage`) reads the stream and renders tokens as they arrive. Tool call results are shown as collapsible "tool used" blocks in the chat UI.

---

## Notifications — Architecture

### Registration
1. Frontend requests browser notification permission on first login.
2. If granted: call Firebase `getToken()` → POST to `PUT /api/device-tokens` with the FCM token.
3. Token stored in `device_tokens` table.
4. On app startup, refresh and upsert the token (tokens rotate).

### Delivery
All FCM sends happen server-side in the in-process `node-cron` job (every 5 minutes, started in `api/src/server.ts`). The frontend never talks to FCM directly.

```
Cron: every 5 minutes (node-cron in api/src/server.ts)
  → Query reminders WHERE due_date BETWEEN now-5m AND now AND completed = false
  → Query important_dates WHERE date matches today (yearly) AND last_notified_year != current_year
  → For each hit: look up device_tokens for user_id
  → POST to FCM HTTP v1: https://fcm.googleapis.com/v1/projects/{project}/messages:send
  → Use service account key from Worker secret (GOOGLE_SERVICE_ACCOUNT_JSON)
  → On UNREGISTERED error: delete token from device_tokens
  → Update last_notified_year for important_dates on success
```

### Reminder completion from notification
Notifications for reminders include a "Mark Complete" action. Implementation:
1. On send, generate a short-lived HMAC token: `HMAC-SHA256(reminderId:userId, COMPLETION_SECRET)`
2. Include in notification data payload: `completionUrl = /api/reminders/:id/complete?token=...`
3. Service worker intercepts the action click, fetches the URL
4. Worker validates HMAC, marks reminder complete
5. If reminder has `recurrence_days`, create the next instance

---

## Theming System

User preferences drive CSS custom properties on `<html>`. No Tailwind `dark:` prefix needed — all theme values go through variables.

```css
/* Applied from user_preferences at login */
:root {
  --accent-h: 250;          /* HSL hue */
  --accent-s: 84%;
  --accent-l: 60%;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 0.5rem;
  --density: 1;             /* 0.85 = compact, 1 = default, 1.15 = cozy */
}
```

Tailwind config uses `hsl(var(--accent-h) var(--accent-s) var(--accent-l))` for the accent color. All component spacing uses `calc(var(--density) * <base>rem)` for layout density.

### User-facing controls
- Accent color: 12 presets + hex input (stored as HSL)
- Font: Inter (default), Lora (serif), DM Mono, Nunito (rounded)
- Layout density: Compact / Default / Cozy (slider or 3-option toggle)
- Color scheme: System / Light / Dark
- These are saved to `user_preferences` via `PATCH /api/users/me/preferences` and applied immediately on change.

---

## API Design Conventions

- All routes are under `/api/`
- Auth: `Authorization: Bearer <jwt>` header on every request
- Responses: `{ data: T }` on success, `{ error: string, code?: string }` on failure
- HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error
- Timestamps: ISO 8601 strings everywhere. Store as `TIMESTAMPTZ` in DuckDB.
- IDs: UUID v4, generated with `crypto.randomUUID()` in application code
- Pagination: cursor-based where needed. `?cursor=<id>&limit=<n>`. Default limit: 50.

### Key routes
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
PATCH  /api/users/me/preferences

GET    /api/contacts
POST   /api/contacts
GET    /api/contacts/:id
PATCH  /api/contacts/:id
DELETE /api/contacts/:id

GET    /api/contacts/:id/interactions
POST   /api/contacts/:id/interactions
GET    /api/interactions                # global list (query: contact_id, type, since, limit)
PATCH  /api/interactions/:id            # edit type/date/notes
DELETE /api/interactions/:id

GET    /api/contacts/:id/dates
POST   /api/contacts/:id/dates
PATCH  /api/contacts/:id/dates/:dateId  # edit title/date/notes
DELETE /api/contacts/:id/dates/:dateId
GET    /api/dates                       # all dates across contacts (upcoming + all)

GET    /api/reminders
POST   /api/reminders
PATCH  /api/reminders/:id
POST   /api/reminders/:id/complete

GET    /api/chat/sessions
POST   /api/chat/sessions
GET    /api/chat/sessions/:id/messages
POST   /api/chat/sessions/:id/messages   ← main chat endpoint, streams response

PUT    /api/device-tokens
DELETE /api/device-tokens/:id
```

---

## Migration from Close Circle v1

v1 data was migrated once from Supabase CSV exports (contacts, interactions, reminders), with contacts fuzzy-matched by name (Levenshtein ≤ 2). The one-time migration scripts have since been removed from the repo. Ongoing import/export (CSV + vCard) lives in the frontend: `app/src/utils/csv.ts`, `vcf.ts`, `import-contacts.ts`.

---

## Development & Deployment

### Run locally (dev)
```bash
# Prerequisites: Node 20+, Docker (for the full stack)

# Install (root is an npm workspace)
npm install

# Configure secrets (api/.env — see api/.env.example)
#   DUCKDB_PATH, JWT_SECRET, GROQ_API_KEY, COMPLETION_SECRET,
#   GOOGLE_SERVICE_ACCOUNT_JSON, FCM_PROJECT_ID, SMTP_* / NOTIFICATION_EMAIL

# Dev servers
npm run dev:api      # tsx watch src/server.ts  → http://localhost:8787
npm run dev:app      # vite                     → http://localhost:5173

# Full stack (mirrors prod)
docker compose up --build -d
#   → app at http://localhost:8090 (nginx), API internal at :8787
```

### Deploy (on the server — address in `.deploy.env`)
```bash
# From a dev machine — rsync code to server, then rebuild + restart
# (reads DEPLOY_SERVER / DEPLOY_DIR / DEPLOY_URL from .deploy.env):
./sync-and-deploy.sh

# Or, directly on the server:
cd ~/close-circle-v2 && ./deploy.sh        # = docker compose up --build -d

# Verify
docker compose ps                          # api must be "healthy"
curl http://localhost:8090/api/health
```

> The Docker build installs deps fresh and runs `tsc`, so a successful `docker compose build` is the authoritative typecheck. The API's on-disk `node_modules` is intentionally incomplete — don't rely on a local `tsc` there.

---

## Code Style & Conventions

- TypeScript strict mode everywhere. No `any` except at JSON parse boundaries (cast immediately).
- No `console.log` in production paths — use a structured logger or omit.
- Zod for runtime validation at API boundaries (request bodies, external data).
- React components: function components only. One component per file.
- Stores (Zustand): one file per domain. Keep actions colocated with state.
- TanStack Query keys: `['contacts']`, `['contacts', id]`, `['reminders']`, etc. — simple, predictable.
- CSS: Tailwind utility classes only. No inline `style` except for dynamic CSS variable injection (theming).
- No `useEffect` for data fetching — use TanStack Query hooks.
- Prefer `async/await` over promise chains.

---

## What an Agent Should Know

If you are an AI agent working in this codebase:

1. **The database is DuckDB** (a local file at `/data/close_circle.duckdb`, accessed via `duckdb-async`). SQL syntax is DuckDB — not PostgreSQL. No `uuid_generate_v4()`; generate UUIDs in app code with `crypto.randomUUID()`. Note: `groups`/`factoids` are JSON TEXT, not native arrays (see Data Model).

2. **User scoping is mandatory.** Every query that touches user data must include `WHERE user_id = ?`. This is not enforced by the DB — it is enforced by you. If you write a query without a `user_id` filter on a user-owned table, it is a bug.

3. **The AI chat tools are the write interface.** When adding a new CRM feature, also add a corresponding tool in `api/src/tools/`. The chat interface should be able to do everything the UI can do.

4. **Secrets never touch the frontend.** FCM credentials, service account keys, the GROQ key, and the COMPLETION_SECRET live in `api/.env` (container env) only — `api/.env` is excluded from `sync-and-deploy.sh` rsync. The frontend only holds a JWT.

5. **IDs are UUIDs generated in application code.** `crypto.randomUUID()` before INSERT. Never rely on DB-generated IDs.

6. **Reminders and important dates are separate.** Reminders are tasks with a due date. Important dates are recurring annual events (birthdays, etc.) that generate notifications but are never "completed."

7. **The export/import format is a data contract.** If you change contact column names in the schema, update the CSV/vCard mapping in `app/src/utils/csv.ts`, `vcf.ts`, and `import-contacts.ts`.

8. **The app runs in Docker, not on a bare host.** Code changes require a rebuild + container restart (`./deploy.sh` on the server, or `./sync-and-deploy.sh` from a dev machine). Editing files on the server does nothing until you rebuild. The DuckDB data lives in the `duckdb_data` volume — a rebuild never wipes it, but a fresh `docker compose down -v` **would** destroy all data.

9. **Child collections are embedded on the contact object.** `GET /api/contacts/:id` returns `contact_methods`, `interactions` (last 10), and `important_dates` inline. The detail-page lists render from that embedded data, so child mutations must also invalidate the `['contacts', id]` query — otherwise the UI goes stale. See "How to Make a Change".

10. **Route mounting is dual.** Some routers (e.g. `interactionsRouter`) are mounted at both a nested path (`/api/contacts`) and a flat path (`/api/interactions`) in `api/src/index.ts`. Edit/delete-by-id handlers live on the flat mount; add/create handlers live on the nested mount. Check `index.ts` before assuming where a route resolves.

11. **DuckDB is locked down at the connection level.** `db.ts` opens the database with `enable_external_access=false` and `lock_configuration=true`, so `read_text()`/`read_csv()` on host files, `COPY TO`, `ATTACH`, extension installs and `SET` all fail. This is what makes `POST /api/query` (used by the MCP server) safe to expose; that route additionally rejects multi-statement SQL and the `users` / `device_tokens` tables. Don't relax these settings — the app only ever needs its own database file.

12. **Registration is closed by default.** `POST /api/auth/register` only works while the `users` table is empty, or when `ALLOW_REGISTRATION=true` is set in `api/.env`. Failed logins are throttled per email (10 per 15 min, in memory). The API refuses to start if `JWT_SECRET` or `COMPLETION_SECRET` is shorter than 32 characters.

---

## Password Reset (Manual / Agent)

Passwords are bcrypt-hashed (10 rounds) and **never stored in plaintext**. There is no self-service email reset flow. The built-in `POST /api/auth/forgot-password` endpoint uses a manual token file — but the fastest path for an agent with SSH access is the **volume swap** method below.

### Why you cannot just UPDATE the DB file directly
The running API container holds an **exclusive lock** on `/data/close_circle.duckdb`. Any attempt to open that file from a second process (even read-only) fails with:
```
IO Error: Could not set lock on file "/data/close_circle.duckdb": Conflicting lock is held
```
You **must** work on a copy and swap it back.

### Why you need CHECKPOINT
DuckDB writes updates to an **in-memory WAL** first. A `conn.all()` read after an UPDATE sees the new value from memory, but the file on disk is unchanged until a `CHECKPOINT` flushes the WAL. If you skip the checkpoint, you will copy a file that still has the old hash, and the login will fail even though your in-memory verification said it worked.

### The volume-swap procedure (tested, Aug 2026)

Run all commands from `~/close-circle-v2` on the server.

**Step 1: Copy the live DB file into the container tmp dir**
```bash
docker compose exec -T api sh -c "cp /data/close_circle.duckdb /tmp/cc_copy.duckdb"
```

**Step 2: Write and run the reset script inside the container**
Replace `<EMAIL>` and `<NEW-PASSWORD>` before running.

```bash
docker compose exec -T api sh -c "cat > /app/reset_pw.cjs << 'SCRIPT'
const { Database } = require(\"duckdb-async\");
const bcrypt = require(\"bcryptjs\");
const fs = require(\"fs\");
async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  const db = await Database.create(\"/tmp/cc_copy.duckdb\");
  const conn = await db.connect();
  const newHash = await bcrypt.hash(newPassword, 10);
  await conn.run(\"UPDATE users SET password_hash = ? WHERE email = ?\", newHash, email);
  await conn.run(\"CHECKPOINT\");
  const verify = await conn.all(\"SELECT email, password_hash FROM users WHERE email = ?\", email);
  const inFile = fs.readFileSync(\"/tmp/cc_copy.duckdb\").indexOf(Buffer.from(verify[0].password_hash)) > -1;
  const match = await bcrypt.compare(newPassword, verify[0].password_hash);
  console.log(\"hash written to file:\", inFile);
  console.log(\"new password matches:\", match);
  await conn.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
SCRIPT
node /app/reset_pw.cjs <EMAIL> <NEW-PASSWORD>"
```

Both lines must print `true`. If `hash written to file` is `false`, the CHECKPOINT did not flush and you need to re-run.

**Step 3: Copy the modified file out of the container**
```bash
docker compose cp api:/tmp/cc_copy.duckdb /tmp/cc_new.duckdb
```

**Step 4: Stop the API, swap the file into the volume, restart**
```bash
docker compose stop api
docker run --rm \
  -v close-circle-v2_duckdb_data:/data \
  -v /tmp/cc_new.duckdb:/src.duckdb:ro \
  alpine sh -c "cp /src.duckdb /data/close_circle.duckdb"
docker compose up -d api
```

**Step 5: Verify login works**
```bash
sleep 8
curl -s -X POST http://localhost:8090/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"<EMAIL>\",\"password\":\"<NEW-PASSWORD>\"}"
```
A successful response includes `"token"` and `"user"`.

### Gotchas
- **`docker compose cp` into a running container does NOT persist to the volume.** It writes to the container writable layer, which is discarded on restart. You must stop the container and use the `docker run` + volume-mount trick in step 4.
- **`docker compose cp` from a running container overwrites `/tmp` files** from prior operations. Always re-copy from `/data/` to get the current state.
- **The MCP host service** (`close-circle-mcp.service`) talks to the API over HTTP, not directly to DuckDB, so it does not hold the lock. You do not need to stop it.
- **`docker compose restart api` is not enough** after a file swap. Use `stop` then `run` (swap) then `up -d`.
- The `database.db` file in `/data/` is a leftover from an earlier SQLite era and is not used by the running app.
