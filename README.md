# TS Electronics — Stock & Order Management

Internal ERP-lite for **หจก ที เอส อีเลคโทรนิค (1992)**: stock + sales + purchasing
+ AR/AP + cheques + multi-bank cash accounts, with offline-first sync to Supabase.

Currently at `v1.7.0-cash-accounts`.

## Tech stack

- **React 19** + **Vite 8** (PWA via `vite-plugin-pwa`)
- **TypeScript** (incremental — `allowJs: true`; data layer + UI primitives are `.ts(x)`)
- **Supabase** for auth + Postgres + Realtime
- **localStorage cache** with 3-way merge + optimistic locking
- **Vitest + React Testing Library** for tests, **Storybook 10** for UI primitives
- **Recharts**, **xlsx**, **DOMPurify + marked** (AI chat) — no Tailwind, inline styles + CSS vars

## Quick start

```bash
npm install
npm run dev               # http://localhost:5173
```

You'll need a `.env` with `ANTHROPIC_API_KEY` (AI features) and `AKSONOCR_API_KEY`
(OCR) if you exercise those flows — everything else runs against the public
Supabase project baked into [`src/utils/supabase.ts`](src/utils/supabase.ts).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` (PWA assets included) |
| `npm run preview` | Serve `dist/` for QA |
| `npm run typecheck` | `tsc --noEmit` (strict; 0 errors expected) |
| `npm test` | Vitest run (currently 55 tests) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest + v8 coverage |
| `npm run storybook` | Storybook dev → http://localhost:6006 |
| `npm run build-storybook` | Static Storybook export |
| `npm run lint` | ESLint (note: pre-existing baseline in `api/*.js`) |

## Project layout (short version)

```
src/
├── App.jsx                 ← root: auth, routing, sync hub, modal coordination
├── components/
│   ├── Finance.jsx         ← router for AR/AP/Bank/Cheque/CN/Billing tabs (modal hub)
│   ├── Finance/            ← extracted sub-tabs (ARAP, Bank, Cheque, CN, Billing, …)
│   ├── ui/                 ← shared primitives (Modal, Field, StatCard, …)
│   └── …                   ← Sales, Products, Reports, Dashboard, Events, etc.
├── utils/
│   ├── storage.ts          ← localStorage + Supabase load/save (KEY_MAP)
│   ├── merge.ts            ← 3-way merge for sync
│   ├── auth.ts             ← Supabase auth wrapper + profile <-> user mapping
│   ├── helpers.ts          ← fmt, toBE, getSS, promo math, … (all typed)
│   └── constants.js        ← stock-status table, dashboard widgets, etc.
├── test/setup.ts           ← jest-dom + auto-cleanup for RTL
└── …
```

For the full module map, cross-tab dependencies, and "where to add X" guidance,
see [HANDOFF.md](HANDOFF.md).

## Documentation

| Doc | Use it when |
|---|---|
| [HANDOFF.md](HANDOFF.md) | Picking up dev work — module map, sync model, KEY_MAP discipline |
| [SYSTEM_SPEC.md](SYSTEM_SPEC.md) | Setup walkthrough + business-rule spec |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | Company info + feature-level overview |

## Key invariants

- **KEY_MAP discipline** — new persisted state must be registered in `KEY_MAP`
  ([`storage.ts`](src/utils/storage.ts)), `MERGE_CFG` ([`merge.ts`](src/utils/merge.ts)),
  and `App.jsx`'s sync hub. Forgetting any of the three breaks sync silently.
- **Thai date format** — store as `YYYY-MM-DD` (AD), render as พ.ศ. via `toBE()`.
- **Permissions** — `canE("finance")` / `canD("finance")` etc.; `ed` / `cd` are
  the in-component shorthands.
- **Modal hub stays in `Finance.jsx`** — sub-tabs trigger parent's `addPay` /
  `viewSO` / `viewBill` / `confirmDelPay` via prop callbacks so cross-tab edits
  (e.g. editing a payment while viewing a billing record) work uniformly.
