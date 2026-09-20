# WMS Architecture

## Stack

- **Next.js 16** App Router (Server Components + Server Actions)
- **Prisma 7** with libSQL/SQLite (dev) or PostgreSQL (prod)
- **NextAuth v5** credentials auth with role-based access
- **Vitest** for unit tests

## Module system

Modules are defined in `src/lib/modules/registry.ts` and toggled via `Settings`:

| Module | Routes | TSD API |
|---|---|---|
| nsi | `/nsi`, `/catalog`, `/labels` | — |
| inbound | `/inbound` | `/api/tsd/receive`, `/api/tsd/orders`, `/api/tsd/putaway` |
| outbound | `/outbound` | `/api/tsd/pick` |
| control | `/inventory`, `/operations` | — |
| topology | `/topology` | `/api/tsd/transfer` |
| lots | `/lots` | — |
| admin | `/admin`, `/settings` | `/api/integration` |

## Data flow

```
Web UI ──► Server Actions ──► Prisma ──► SQLite/PostgreSQL
TSD UI ──► REST API (/api/tsd/*) ──► Prisma
External ──► Integration Inbox ──► Inbox Mapper ──► Prisma
Business events ──► Outbox ──► Webhook / 1C adapter
```

## Meta-system

Dynamic catalogs use EAV (`MetaEntity`, `MetaRecord`, `MetaValue`). System entities are seeded in `src/lib/meta/seed-system.ts`. Custom entities can be created in Admin → Meta.

**Roadmap:** унификация документов под конструктор — [switch-plan.md](./switch-plan.md) (P0–7 ✅). Остаточные недочёты — [gaps-switch-plan.md](./gaps-switch-plan.md). Целевая архитектура (историческая) — [wms-constructor-switch-plan.md](./wms-constructor-switch-plan.md).

## Auth layers

1. **Proxy** (`src/proxy.ts`) — session check, role check for admin module
2. **Server Actions** — `requireModuleWrite`, `requireWriteAccess` (blocks viewer mutations)
3. **TSD API** — API key (`x-api-key`) + NextAuth session permission
4. **Integration API** — bcrypt API key or HMAC webhook signature

## TSD workflows

| Flow | OperationDocument | Outbox event |
|---|---|---|
| Receive | RECEIVE_REPORT | stock.receipt |
| Putaway | PUTAWAY | stock.putaway |
| Transfer | TRANSFER | stock.transfer |
| Pick | PICK | stock.shipment |

## Integration

**Inbox** event types: `product.upsert`, `counterparty.upsert`, `inbound.create`, `outbound.create`, `location.upsert`, `stock.snapshot`

**Outbox** drains via admin UI or `POST /api/integration/outbox/drain`. Failed items can be retried from admin.
