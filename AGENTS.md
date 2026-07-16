AGENTS.md for Solato

Purpose

This document is written for programmatic agents and engineers who will implement, maintain, or extend Solato. It explains the repository structure, responsibilities, data flows, important invariants, and practical run/test/PR guidance. The system language is English.

High-level architecture

- Desktop app built with Tauri: React frontend (Vite) + Rust native backend (solato_lib).
- All business and data logic lives in the Rust backend (src-tauri/). The React UI is intentionally "dumb" and only orchestrates UI rendering and lightweight caching for UX.
- Local persistence: SQLite (sqlx). The app is offline-first: local DB is the single source of truth for user data while offline.
- Cloud sync: a separate Spring-based API (external project, built with Gradle and deployed to production) handles server-side synchronization. This repository only contains the desktop client and clients for that API.

Important design rules / invariants

- Business logic location: implement/modify all domain logic in Rust (src-tauri/src/services, src-tauri/src/models, src-tauri/src/database). The frontend must not implement domain rules, validation, or conflict resolution.
- UI responsibilities: rendering, invoking Tauri commands, optimistic UI updates and short-term cache via react-query only. No long lived logic should run in React.
- Data model: canonical data is in SQLite. Sync merges use timestamps (updated_at) and UUIDs. The Rust sync logic applies upserts that prefer the record with a newer updated_at.
- Auth: tokens are stored in memory (access token in ApiState) and the refresh token is stored in the OS keyring.
- Error handling: Rust services return Result<T, String> for commands exposed to Tauri commands; UI shows messages based on these results.

Repository layout (important paths)

- package.json — frontend and dev scripts (root). Key scripts: dev, build, tauri, tauri:build:linux.
- README.md — developer quickstart and notes.
- src/ — React frontend (Vite + TypeScript + React 19). Important files:
  - src/main.tsx — app entry
  - src/App.tsx — router and React Query provider
  - src/features/* — domain UI features: timer, projects, analytics, settings, login
  - src/shared/* — shared UI components and types
  - Many hooks call Tauri commands via @tauri-apps/api invoke (useAuth, useSettings, etc.)

- src-tauri/ — Rust native crate and Tauri glue. Important subfolders:
  - Cargo.toml — Rust crate configuration (solato_lib)
  - src/main.rs — small launcher that calls solato_lib::run()
  - src/lib.rs and solato_lib crate — main app runtime and wiring
  - src/commands/ — Tauri commands exposed to the frontend (analytics_commands, api, discord_commands, project_commands, settings_commands, timer_commands)
  - src/services/ — core services (api, sync, auth, project, session, settings, analytics, timer, discord, etc.)
  - src/api/ — Api client wrapper (api_client.rs) and request/response models for /sync
  - src/database/ — DB layer and sqlx; migrations expected in this module (migrations folder referenced in Cargo.toml/sqlx configuration)
  - src/models/ — domain models and sync models (ProjectSync, SessionSync, SyncRequest, SyncResponse, analytics types)

Key Rust modules and responsibilities

- ApiState (src-tauri/src/api/api_client.rs)
  - Manages base_url, reqwest client, and access_token (Mutex<Option<String>>).
  - Builds headers (Authorization: Bearer <token>) and sends POST requests via post(endpoint, body).
  - Implements transparent refresh flow: on 401 (except auth/public endpoints) attempts refresh using stored refresh token (OS keyring). On successful refresh updates access_token and retry; otherwise clears tokens and fails with session-expired error.
  - Stores refresh token in OS keyring using keyring crate.

- SyncService (src-tauri/src/services/api/sync_service.rs)
  - Offline-first sync flow: reads last_synced_at from sync_meta table, builds a SyncRequest with changed local projects and sessions (changed by updated_at > last_synced_at), posts to /sync endpoint on external API, and applies cloud updates using upsert statements.
  - Upsert logic: INSERT ... ON CONFLICT(id) DO UPDATE ... WHERE excluded.updated_at > table.updated_at — i.e., last-write-wins according to updated_at timestamp.
  - After successful sync, writes new sync timestamp to sync_meta.

- AuthService (src-tauri/src/services/api/auth_service.rs) and commands/api/auth_commands.rs
  - Commands exposed: register_user, login_user, logout, is_logged_in (and additional auth-related commands referenced by UI).
  - Uses ApiState to call auth endpoints and sets access_token in ApiState and refresh token in keyring.

- Database (src-tauri/src/database)
  - Uses sqlx with sqlite feature. Database models include projects, sessions, sync_meta, settings, etc.
  - Migrations are run with sqlx command (README instructs cargo sqlx migrate run).
  - Typical tables observed (in queries):
    - projects(id TEXT PK, name TEXT, description TEXT, color TEXT, created_at TEXT, updated_at TEXT, is_deleted INTEGER)
    - sessions(id TEXT PK, project_id TEXT, start_time TEXT, end_time TEXT, session_type TEXT, mode TEXT, updated_at TEXT, is_deleted INTEGER)
    - sync_meta(key TEXT PRIMARY KEY, value TEXT)

Frontend responsibilities and contracts

- All remote interactions and data mutations are done by invoking Tauri commands (invoke('some_command', {...})). The React code uses @tanstack/react-query for caching and optimistic updates.
- Example hooks:
  - useAuth() — fetches current user, exposes login and register mutations that call tauri commands (login_user, register_user).
  - useSettings() — uses query key ['settings'] and calls invoke('get_settings'), update_settings, with optimistic updates via react-query.
- UI must not implement domain rules. Any validation, conflict resolution, sync decisions, or final persistence must be implemented in Rust.

Sync and conflict semantics (detailed)

- Sync is initiated by the Rust backend (SyncService). Frontend may invoke a sync Tauri command (check commands/api) but the core policy is local-first: write locally, then let sync propagate.
- Server API contract (client-side): POST /sync with SyncRequest { last_synced_at, projects[], sessions[] } -> returns SyncResponse { projects[], sessions[], sync_timestamp }.
- Conflict resolution: upsert in DB where cloud data replaces local only if cloud.updated_at > local.updated_at. This is last-writer-wins by timestamp.
- Time formats: RFC3339 or fallback to "%Y-%m-%d %H:%M:%S"; code parses both.

Authentication and token lifecycle

- Access tokens are stored in-memory (ApiState.access_token). Refresh tokens are stored securely in OS keyring.
- ApiState.post() will attempt token refresh automatically on a 401 (except for public auth endpoints) and retry once.
- If refresh fails, both tokens are cleared and the client must log in again.

Practical run & dev instructions (summary)

1. Install Node >=18 and npm (or pnpm). Install Rust toolchain (rustup + cargo).
2. From project root:
   - npm i
   - cd src-tauri
   - create .env from .env.example if needed
   - cargo install sqlx-cli --no-default-features --features rustls,sqlite
   - cargo sqlx database create
   - cargo sqlx migrate run
   - go back to root and run: npm run tauri dev  (serves frontend and launches native window)
3. Build: npm run build && npm run tauri build (or use npm run tauri:build:linux on Linux if needed)

Testing and verification guidance for agents

- Local DB tests: ensure migrations run, seed data set.
- API integration: the external Spring API must be reachable (or mocked) for sync-related tests. Use ApiState.base_url override in dev to point to a test server.
- Token tests: ensure keyring read/write works across platforms; tests should mock keyring access or run in an environment with OS keyring access.
- UI tests: frontend is UI-only; unit tests should only cover rendering and that the correct Tauri command is invoked. Domain tests must be in Rust.

Notes for agents modifying code

- When adding features that change data models:
  - Modify Rust models (src-tauri/src/models)
  - Update database migrations (sqlx) and bump migration files
  - Update sync request/response models used by ApiState and SyncService
  - Keep frontend types (src/shared/lib/models) in sync with Rust models. Frontend may keep a thin DTO representation only for rendering.
- When changing sync semantics:
  - Update SyncService and the SQL upsert statements carefully, include tests for merging and timestamp edge cases.
  - Coordinate with the Spring API team if server-side expectations change (UUID formats, timestamp precision, required fields).
- When changing authentication:
  - Update ApiState.post refresh flow and keyring usage. Ensure old cached tokens are invalidated properly.

Recommended tasks (initial backlog for agents)

- Add automated integration tests for SyncService using a test sqlite database and a mock HTTP server to simulate the Spring API.
- Harden error handling in ApiState.post: better error classification and logging; instrument network retries and exponential backoff for transient errors.
- Add CI job: run cargo check, cargo fmt -- --check, npm ci, npm run build, and run sqlx migrate in a test DB.
- Add CONTRIBUTING.md with PR checklist specific to solato (run migrations, update frontend DTOs, run formatting).

Developer ergonomics and debugging tips

- Logging: code uses a log! macro — check native logs in Tauri runtime. Enable debug logging where possible for deeper traces.
- Database inspection: use sqlite CLI or DB browser on the sqlite file created in dev to inspect projects/sessions/sync_meta.
- Reproducing sync: create local changes, run SyncService.execute_sync() (either through UI action or call the Tauri command that triggers sync) while proxying traffic to a mock server to verify payloads.
- Token issues: check keyring contents, and inspect ApiState.access_token for presence/absence.

Checklist for PRs by agents

- Run Rust lints and cargo check; ensure sqlx macros compile with the test DB
- Run npm build and ensure frontend compiles
- If DB model changed: add sqlx migration and test it locally
- Add/update integration tests for the changed behavior (prefer Rust-level tests for business logic)
- Keep UI changes minimal and justified: attach screenshots or short gif for UI additions

Who owns what (mapping for agents)

- Rust backend (src-tauri/*): owns domain logic, DB schema, sync, token lifecycle, Tauri commands.
- Frontend (src/*): owns UI components, routing, and minimal client-side cache and UX.
- External API (separate Spring/Gradle project): owns server-side sync merge behavior and central user/account data.

Quick reference of important files (paths)

- Root: package.json, README.md
- Frontend: src/main.tsx, src/App.tsx, src/features/*, src/shared/*
- Tauri & Rust: src-tauri/Cargo.toml, src-tauri/src/main.rs, src-tauri/src/lib.rs
- Commands: src-tauri/src/commands/* (tauri commands)
- Services: src-tauri/src/services/* (sync_service.rs, auth_service.rs, project_service.rs, session_service.rs, settings_service.rs)
- API client: src-tauri/src/api/api_client.rs
- Models: src-tauri/src/models/* and src/shared/lib/models/* (frontend DTOs)

Contact points for coordination

- If a change affects the server API or contract, coordinate with the Spring API team (Gradle project). Server changes require versioned API changes and coordinated deploys.

Final notes for autonomous agents

- Follow the invariant: keep domain logic in Rust. If an agent wants to implement a new behavior, prefer Rust services and Tauri commands.
- Always run migrations locally and test sync end-to-end when changing models or upsert rules.
- Use the sqlite DB and mock/stubbed HTTP servers for safe testing; do not depend on the production Spring API.

-- End of AGENTS.md
