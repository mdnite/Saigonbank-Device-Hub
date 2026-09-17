# database

Single source of truth for the IDSM database schema. Kept at the repo root — not inside
`backend/` — so the people reviewing schema changes can watch this one folder.

> **Scaffold.** No migration tool is wired up yet. This README defines the convention so
> the first migration lands in the right shape.

## Layout

```
database/
  migrations/     ordered schema-change files (see naming below)
  README.md
```

The ERD lives in [`../docs/`](../docs/) and must be updated in the same PR as any migration
that changes the shape it describes.

## Naming convention

```
migrations/NNNN_verb_noun.sql
```

- `NNNN` — zero-padded sequential number (`0001`, `0002`, …). Deterministic order, no
  timestamp collisions between branches.
- `verb_noun` — what the migration does: `0001_create_devices`, `0002_add_status_to_devices`,
  `0003_create_allocations`.

If the chosen tool needs paired rollbacks, add `NNNN_verb_noun.down.sql` alongside.

## Workflow rules

1. **One logical change per migration**, one migration per PR where practical.
2. **Never edit a migration that has been merged.** Fix-forward with a new migration.
3. **Every forward migration ships with a rollback** (or a documented reason it can't).
4. **Update the ERD in `docs/`** in the same PR when the schema shape changes.
5. Migrations are append-only history — treat them like git commits.

## When starting

Pick a migration runner (node-pg-migrate, Knex, Prisma Migrate, Flyway, …), record the
choice here, and wire it into `backend/` so it reads from `./migrations`.
