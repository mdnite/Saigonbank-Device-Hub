# IDSM — SaigonBank Device Hub

Internal IT device / asset management app for SaigonBank. This repo is an npm workspace with
three top-level areas:

| Folder | What it is | Status |
|--------|-----------|--------|
| [`frontend/`](frontend/) | React + Vite + TypeScript + Tailwind web app (pragmatic DDD) | Implemented |
| [`backend/`](backend/) | API service | Not built yet — see `backend/README.md` |
| [`database/`](database/) | Schema migrations + ERD, tracked for review | Scaffold — see `database/README.md` |

## Run

```bash
npm install        # from the repo root — installs every workspace
npm run dev        # starts the frontend on http://localhost:5173
npm test           # frontend unit tests (vitest)
npm run build      # type-check + production build of the frontend
```

Each script is a thin alias for the matching `-w frontend` command; run per-workspace
commands directly with `npm run <script> -w frontend`.

## Docs

- [`docs/CONTEXT.md`](docs/CONTEXT.md) — codebase map, shared conventions, and the list of
  known placeholders. Read this before picking up a module.
- `docs/` also holds the database ERD (source of truth for schema) and design screenshots.
