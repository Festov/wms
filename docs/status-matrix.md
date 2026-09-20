# Матрица статусов WMS

Справочник: `Status` (seed в `src/lib/status/seed.ts`).

## Inbound (приёмка)

| Код | Название | Переходы |
|-----|----------|----------|
| DRAFT | Новый | → RELEASED, CANCELLED |
| RELEASED | К исполнению | → ACCEPTED, CANCELLED (ТСД) |
| ACCEPTED | Принят | → PLACED (после размещения) |
| PLACED | Размещён | терминальный для заказа |
| COMPLETED | Завершён | legacy → мигрируется в PLACED |
| CANCELLED | Отменён | терминальный |

Web: создание в DRAFT → «К исполнению» (RELEASED). ТСД: приёмка меняет на ACCEPTED. Размещение ТН → PLACED.

## Outbound (отгрузка)

| Код | Название | Переходы |
|-----|----------|----------|
| DRAFT | Новый | → RELEASED, CANCELLED |
| RELEASED | К исполнению | → POSTED, CANCELLED |
| POSTED | Проведён | терминальный (списание остатков) |
| CANCELLED | Отменён | терминальный |

Web: создание в DRAFT → «К исполнению» (RELEASED) → «Провести» (POSTED). ТСД: отбор по документам в RELEASED.

## Pallet (товарный носитель)

| Код | Название |
|-----|----------|
| AVAILABLE | Свободен |
| ACCEPTED | Принят (на зоне приёмки) |
| PLACED | Размещён в ячейке |

## Putaway / Transfer (операции)

| Код | Название |
|-----|----------|
| DRAFT | Новый |
| COMPLETED | Завершён |
| POSTED | Проведён |
| CANCELLED | Отменён |

Операционные документы (`OperationDocument`) используют тип + статус из этого справочника.
