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
`admin` / `Admin@123` (+ optional `dev` user for the forgot-password flow).

If the browser still holds a session from the old mock build, delete
`localStorage["idsm.session"]` once — otherwise the app thinks you are logged in.

Tests run on Node 25 with `--no-experimental-webstorage` (set in `vite.config.ts`), because
Node's own global `localStorage` shadows jsdom's.

## What's in this pass

| Module | Screens | Figma frames |
|--------|---------|--------------|
| `auth` | Login, Quên mật khẩu, OTP, Đổi mật khẩu | Group 1, 3, 4, 5 |
| `dashboard` | Tổng quan (4 thẻ thống kê) | Group 2 |
| `device` | Danh mục thiết bị, Thêm tài sản, Cấp phát - Thu hồi | Group 10, 14, 15, 16 |
| `user` | Quản lý người dùng (`/users`, `/users/new` — chỉ Quản trị viên) + Cài đặt cá nhân (`/settings`, 3 tab) | Group 7, 8, 9 (chỉ màn cài đặt) |

Not yet built (routed to a "đang phát triển" placeholder): Điều chuyển, Kiểm kê.
Not routed at all: Danh sách/Tạo đơn cấp phát, Approvals Center (Group 11–13).

`auth` and the admin side of `user` are wired to the real API in [`../backend/`](../backend/)
(login, forgot password → OTP email → reset, logout = client-side token removal; `/users` list,
create, lock/unlock, soft delete). `dashboard`, `device` and `/settings` still use in-memory mocks.

## Architecture — pragmatic DDD

Each bounded context under `src/modules/<context>/` has four layers:

```
domain/          Pure models + rules. No React, no fetch. Unit-tested.
application/     Use-case services + repository *interfaces* (ports).
infrastructure/  Repository implementations (HTTP for auth + user admin, in-memory elsewhere) + container.ts (DI wiring).
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
framework-agnostic helpers (`lib/`). `src/app/` is the composition root: router + session
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
