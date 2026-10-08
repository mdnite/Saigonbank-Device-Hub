# IDSM — Quản lý thiết bị (SaigonBank Device Hub)

React + TypeScript + Tailwind front-end for the IDSM asset-management app, ported from the
Figma file `OuDy5KuU8mWCWiFvdrU0jZ`.

## Run

This package is the `frontend` workspace of the repo root. Run from **either** the repo root
(scripts alias to `-w frontend`) or from this directory:

```bash
npm install        # from the repo root — installs all workspaces
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # tsc + vite build
```

CI runs from the repo root: `npm ci` then `npm run build -w frontend`.

**Auth talks to the real backend** — start it first (`backend/`, see
[`../backend/README.md`](../backend/README.md)), otherwise login shows "Không kết nối được máy chủ".
The API base URL comes from `VITE_API_URL` (default `http://localhost:3000`); copy
`.env.example` to `.env` to change it. Dev accounts come from the backend seed:
`admin` / `Admin@123`, `truongphong.ketoan` / `Head@1234` and `ctv.ketoan` / `Collab@1234` for Kiểm kê (+ optional `dev` user for the forgot-password flow).
Current test count: **149 tests in 33 files** (`npm test`).

If the browser still holds a session from the old mock build, delete
`localStorage["idsm.session"]` once — otherwise the app thinks you are logged in.

Tests run on Node 25 with `--no-experimental-webstorage` (set in `vite.config.ts`), because
Node's own global `localStorage` shadows jsdom's.

## What's in this pass

| Module | Screens | Figma frames |
|--------|---------|--------------|
| `auth` | Login, Quên mật khẩu, OTP, Đổi mật khẩu | Group 1, 3, 4, 5 |
| `dashboard` | Tổng quan (4 thẻ thống kê) | Group 2 |
| `device` | Danh mục thiết bị (`/devices`), Thêm/sửa thiết bị (`/devices/new`, `/devices/:id/edit`) | Group 10, 14, 15 |
| `user` | Quản lý người dùng (`/users`, `/users/new` — chỉ Quản trị viên) + Cài đặt cá nhân (`/settings`, 3 tab) | Group 7, 8, 9 (chỉ màn cài đặt) |
| `allocation` | Đơn Cấp phát - Thu hồi (`/allocation`, `/allocation/new`), in biên bản PDF | — (theo spec, không theo Figma) |
| `transfer` | Lệnh Điều chuyển (`/transfers`, `/transfers/new`), in biên bản PDF | — (theo spec, không theo Figma) |
| `audit` | Kiểm kê (`/audit` 3 tab `?tab=detail\|quantity\|summary`, `/audit/:id`, `/audit/summaries/:id`), xuất PDF / CSV — chỉ TP + Chuyên viên Kế toán | Frame `337:2672`, `337:2805`, `338:2878`, `338:3004` + spec |

Not yet built: Kiểm kê số lượng (tab placeholder trong `/audit`), QR thiết bị.
Approvals Center (Group 13) is not a separate screen — approve/reject sits on the `/allocation` and
`/transfers` list rows.

`auth`, the admin side of `user`, and `device` are wired to the real API in
[`../backend/`](../backend/) (login, forgot password → OTP email → reset, logout = client-side
token removal; `/users` list/create/lock-unlock/soft-delete; `/devices` list/create/update/soft-delete;
`/device-orders`, `/device-transfers`, `/audits`, `/audit-summaries`). Permissions (UI hide/show only — the backend enforces them,
see `src/modules/auth/domain/session.ts`): Chuyên viên Kỹ thuật adds/edits devices and creates
orders/transfers, Trưởng phòng Kỹ thuật also deletes devices and approves/rejects, Quản trị viên
manages users and is read-only elsewhere. Kế toán: Chuyên viên Kế toán schedules / counts / submits audits and builds summaries,
Trưởng phòng Kế toán approves / rejects and deletes audits / empties the audit trash / deletes summaries (Kiểm kê is hidden from every other role); Trưởng phòng Kỹ thuật can mark a
"Thất lạc" device as found. `dashboard` and `/settings` still use in-memory mocks.

## Architecture — pragmatic DDD

Each bounded context under `src/modules/<context>/` has four layers:

```
domain/          Pure models + rules. No React, no fetch. Unit-tested.
application/     Use-case services + repository *interfaces* (ports).
infrastructure/  Repository implementations (HTTP for auth, user admin, device, allocation, transfer, audit; in-memory for dashboard + settings) + container.ts (DI wiring).
presentation/    React pages, hooks, and UI-only mappings.
```

Rules:

- `presentation` imports `infrastructure/container.ts` for a ready-made service — never
  `new`s a repository itself.
- `domain` and `application` never import from `presentation`, `infrastructure`, or React.
- Swapping the mock for a real backend = write an `HttpXRepository implements XRepository`
  and change one line in `container.ts`. Nothing else moves. Reference implementation:
  `modules/auth/infrastructure/HttpAuthRepository.ts` on top of `shared/lib/apiClient.ts`
  (`apiPost` unwraps the backend's `{ success, data, error, message }` envelope and throws the
  Vietnamese `message` on error).

`src/shared/` holds the design-system UI kit (`ui/`), layout chrome (`layout/`), and
framework-agnostic helpers (`lib/`, incl. `downloadCsv`); `ui/Modal` wraps the native `<dialog>`. `src/app/` is the composition root: router + session
context + auth guard.

## Design tokens

Palette, fonts, radii, and shadow are approximated from the low-res Figma PNG exports and
live in `tailwind.config.js` (`brand`, `ink`, `surface`, `status`, `card`). Tune there once
Dev Mode / edit access to the Figma file is available for exact values.

## Known gaps vs. Figma

- The 3D character on the auth screens is a raster asset that couldn't be pulled via the
  Figma MCP (View-only access). Drop it at `public/illustrations/person-3d.png` — see the
  README there. Until then only the indigo blob renders.
- Exact spacing/colour values are eyeballed from 800px exports, not read from Figma
  variables.
- The auth blob shape is a hand-tuned SVG approximation.
