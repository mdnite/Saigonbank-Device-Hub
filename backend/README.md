# backend

> **Not implemented yet.** This folder is a placeholder so the repo layout is clear while
> the frontend runs against in-memory mocks.

## Intended shape

The backend will expose the API the frontend currently fakes in
`frontend/src/modules/*/infrastructure/InMemory*Repository.ts`.

- **Stack:** TBD. Leaning toward Node + TypeScript so the domain models can be shared with
  the frontend. Confirm before writing code.
- **Layering:** mirror the frontend's pragmatic DDD — per bounded context:
  - `domain/` — pure models + rules (no framework imports)
  - `application/` — use-case services + repository ports
  - `infrastructure/` — real repository implementations (DB, external services)
  - `interface/` (or `http/`) — controllers / route handlers
- **Migrations:** this service does not own the schema files. It runs migrations from
  [`../database/migrations`](../database/migrations) — see `database/README.md` for the
  workflow.

## When starting

1. Decide the stack and record it here.
2. `npm init -w backend` (this is already an npm workspace member) and add real `scripts`.
3. Add a root script alias in the top-level `package.json` (`"dev:api": "npm run dev -w backend"`).
