# WMS v0.1.0

Warehouse Management System built with Next.js 16, Prisma 7, and NextAuth v5.

## Quick start

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000 and sign in with credentials from seed output (dev only).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file or PostgreSQL connection string |
| `AUTH_SECRET` | Production | JWT secret (`openssl rand -base64 32`) |
| `ADMIN_LOGIN` | No | Seed admin login (default: `admin`) |
| `ADMIN_PASSWORD` | Production | Seed admin password |
| `TSD_API_KEY` | No | TSD API key written to Settings on seed |
| `INTEGRATION_WEBHOOK_URL` | No | Outbox webhook target |
| `INTEGRATION_1C_URL` | No | 1C adapter URL |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed database (roles: admin, operator, viewer) |
| `npm run db:reset` | Reset DB + seed |
| `npm run docs:pdf` | Build user docs PDF |

Set `SEED_DEMO_USERS=1` to also create demo logins `operator` / `viewer` (password `demo123` in non-prod, or `SEED_DEMO_PASSWORD`).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development roadmap

- [docs/switch-plan.md](docs/switch-plan.md) — WMS-конструктор (`/doc/*`, handlers); этапы P0–7 ✅
- [docs/gaps-switch-plan.md](docs/gaps-switch-plan.md) — актуальный backlog недочётов после конструктора

## Security notes

- Set strong `AUTH_SECRET` and `ADMIN_PASSWORD` before production deploy
- Configure TSD API key in Settings (no default demo key)
- TSD and integration APIs require API key + session permissions
- Module flags gate UI routes and TSD API endpoints

## Modules

- **NSI** — catalogs, labels, lots
- **Inbound / Outbound** — warehouse documents
- **Control** — inventory, operations, stock movements
- **Topology** — warehouse map
- **TSD** — terminal workflows (receive, putaway, pick, transfer)
- **Admin** — users, roles, integration, meta entities
