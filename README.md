# IDSM — Quản lý thiết bị (SaigonBank Device Hub)

React + TypeScript + Tailwind front-end for the IDSM asset-management app, ported from the
Figma file `OuDy5KuU8mWCWiFvdrU0jZ`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # tsc + vite build
```

Login accepts **any** non-empty username/password (mock auth). Password-reset codes are
printed to the browser console by the mock adapter.

## What's in this pass

| Module | Screens | Figma frames |
|--------|---------|--------------|
| `auth` | Login, Quên mật khẩu, OTP, Đổi mật khẩu | Group 1, 3, 4, 5 |
| `dashboard` | Tổng quan (4 thẻ thống kê) | Group 2 |
| `device` | Danh mục thiết bị, Thêm tài sản, Cấp phát - Thu hồi | Group 10, 14, 15, 16 |

Not yet built (routed to a "đang phát triển" placeholder): Người dùng, Điều chuyển, Kiểm kê,
Cài đặt, Danh sách đơn cấp phát (Group 11–13, 7–9).

## Architecture — pragmatic DDD

Each bounded context under `src/modules/<context>/` has four layers:

```
domain/          Pure models + rules. No React, no fetch. Unit-tested.
application/     Use-case services + repository *interfaces* (ports).
infrastructure/  Repository implementations (currently in-memory) + container.ts (DI wiring).
presentation/    React pages, hooks, and UI-only mappings.
```

Rules:

- `presentation` imports `infrastructure/container.ts` for a ready-made service — never
  `new`s a repository itself.
- `domain` and `application` never import from `presentation`, `infrastructure`, or React.
- Swapping the mock for a real backend = write an `HttpXRepository implements XRepository`
  and change one line in `container.ts`. Nothing else moves.

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
