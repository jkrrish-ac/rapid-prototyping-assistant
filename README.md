# Rapid Prototype Assistant

A monorepo implementation of the platform described in `PRD-Rapid-Prototype-Assistant.md`:
users log in, create a project, and are guided by AI through a 12-stage lifecycle
(IDEA → UNDERSTAND → IDEATE → DECIDE → DESIGN → BUILD → TEST → FIX → SHIP →
REAL USERS → FEEDBACK → ITERATE) that produces a working, downloadable,
frontend-only clickable prototype with a full, append-only decision log.

## Structure

```
rapid-prototype-assistant/
  apps/
    api/   — NestJS platform backend (auth, projects, stages, decisions, AI routing, prototypes, feedback)
    web/   — React + Tailwind platform frontend (dashboard, workspace, lifecycle rail, decision log, preview)
  docker-compose.yml
  .env.example
```

This is an **npm workspaces** monorepo — a single `npm install` at the root
installs both apps.

## Model routing

Every lifecycle stage's AI calls are routed to Opus or Sonnet automatically,
per the PRD (see `apps/api/src/common/lifecycle/stage-definitions.ts` for the
exact per-stage instructions, and `apps/api/src/ai/ai.service.ts` for the
routing + call plumbing):

| Stage | Model |
|---|---|
| IDEA | Sonnet |
| UNDERSTAND, IDEATE, DECIDE | Opus |
| DESIGN | Opus (architecture) → Sonnet (rendering), split on `output.architectureLocked` |
| BUILD, TEST, FIX, SHIP, REAL USERS | Sonnet |
| FEEDBACK, ITERATE | Opus |

Which model produced each decision is stored on the decision itself and shown
in the UI (the badge next to each stage's conversation, and in the Decision
Log drawer).

## Running locally (without Docker)

Requires Node 20+ and a MongoDB instance.

```bash
cp .env.example .env
# edit .env — at minimum set MONGODB_URI (or run `docker compose up mongo` for
# just the database) and ANTHROPIC_API_KEY

npm install

npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173
```

## Running with Docker

```bash
cp .env.example .env
# edit .env — ANTHROPIC_API_KEY at minimum; OAuth vars are optional

docker compose up --build
```

This starts MongoDB, the API (`:4000`), and the web app (`:5173`) with
hot-reload volumes mounted for local development. `docker compose down` to
stop; add `-v` to also drop the Mongo volume.

## Required configuration

- **`ANTHROPIC_API_KEY`** — without this, every lifecycle stage's AI call
  fails with a 503 (auth, project CRUD, and the dashboard/workspace shell all
  still work; only the "send a message" / "advance" actions need this key).
  `ANTHROPIC_MODEL_OPUS` / `ANTHROPIC_MODEL_SONNET` default to
  `claude-opus-4-6` / `claude-sonnet-4-6` — update them to whatever current
  model identifiers your Anthropic account has access to. Use a
  workspace-scoped API key (create it from inside a specific workspace in
  the Console, not a personal/identity-linked key) so no extra
  workspace-ID header is ever needed.
- **Per-stage output token budgets** — each stage has its own `max_tokens`
  ceiling in `apps/api/src/common/lifecycle/stage-definitions.ts`
  (`maxOutputTokens`), because stages that emit source code or long
  structured detail need far more headroom than pure-reasoning ones: BUILD
  defaults to 32000, FIX to 24000, DESIGN's pixel-level render phase to
  16000, and the rest to 6000–8000. If a stage's response keeps getting cut
  off mid-JSON (a 503 explicitly saying the response "hit the token output
  limit"), raise that stage's `maxOutputTokens`, or set
  **`ANTHROPIC_MAX_TOKENS`** in `.env` to override every stage's budget at
  once and restart the API. If your account's model instead rejects a
  higher value with an `max_tokens too large` error, set
  `ANTHROPIC_MAX_TOKENS` to whatever ceiling that error reports.
- **`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`** — change these before any
  real deployment.
- **Google/GitHub OAuth** — optional. Email/password auth works out of the
  box. If `GOOGLE_CLIENT_ID`/`GITHUB_CLIENT_ID` etc. are left blank, the app
  still boots (placeholder credentials are used so Passport doesn't throw at
  startup) but the `/auth/google` and `/auth/github` routes won't work until
  you supply real OAuth app credentials.

## What's implemented vs. known limitations (read this before demoing)

This is a real, working first build, not a mockup — but two things are
intentionally scoped down rather than silently faked:

- **Live in-platform preview supports React prototypes only.** The BUILD/FIX
  stages can target either React or Vue (per DECIDE), and the **download
  zip is complete and correct for both**, but the platform's live preview
  iframe currently only bundles React (via an in-memory esbuild plugin — see
  `apps/api/src/prototypes/bundler.service.ts`). A Vue prototype's preview
  panel shows a "download to run locally" message instead of a live render.
  Wiring in `@vue/compiler-sfc` for live `.vue` bundling is the natural next
  step and the bundler is structured so that's an additive change, not a
  rewrite.
- **The BUILD-stage bundler requires a fixed entry convention** (`src/main.tsx`
  rendering `<App />` via `react-dom/client`) so the preview bundler always
  has a known entry point. This is enforced in the BUILD stage's system
  prompt, not just hoped for.

Everything else in the PRD — the 12-stage state machine with enforced
sequential advancement, the append-only decision log with supersession, the
Opus/Sonnet split-model DESIGN stage, the escalate-to-Opus-on-contradiction
rule for Sonnet stages, the zip download with `DECISIONS.md` + generated
`README.md` + real `package.json`/`tailwind.config.js`/`vite.config.ts`, and
the REAL USERS → FEEDBACK → ITERATE loop (including looping back to DESIGN or
IDEATE) — is implemented against real MongoDB collections and real Anthropic
API calls, end to end.

## Deploying prototypes to Netlify

Per the PRD's Out-of-Scope-for-v1 list, one-click "Deploy to Netlify" for a
shipped prototype is a planned future capability, not part of this build. The
current SHIP stage produces the same downloadable zip either way, which
already `netlify deploy`s cleanly as a static Vite build if you want to do it
manually today (`npm run build` then point Netlify at the `dist/` folder).
