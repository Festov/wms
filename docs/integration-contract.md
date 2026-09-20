# Контракт интеграции WMS v1

Версия payload: `1`

## Outbox (WMS → внешняя система)

HTTP POST на webhook endpoint. Тело:

```json
{
  "id": "cuid",
  "eventType": "inbound.received",
  "aggregateType": "InboundDocument",
  "aggregateId": "cuid",
  "payload": { "version": 1, "..." },
  "createdAt": "ISO-8601"
}
```

Заголовок `x-signature`: HMAC-SHA256 тела, секрет из endpoint.

### Типы событий

| eventType | Когда |
|-----------|-------|
| `inbound.released` | Заказ к исполнению |
| `inbound.received` | Приёмка на ТСД |
| `inbound.pallet_completed` | Паллета завершена |
| `inbound.placed` | Размещение завершено |
| `outbound.posted` | Отгрузка проведена |
| `putaway.confirmed` | Размещение ТН |
| `pick.confirmed` | Отбор |
| `transfer.confirmed` | Перемещение |

## Inbox (внешняя система → WMS)

`POST /api/integration/inbox`

Авторизация: `Authorization: Bearer <api-key>` или заголовок из настроек.

```json
{
  "source": "1c",
  "eventType": "product.upsert",
  "externalId": "1c-guid-optional",
  "payload": {
    "version": 1,
    "sku": "SKU-001",
    "name": "Товар",
    "barcode": "460..."
  }
}
```

### Поддерживаемые eventType

| eventType | Действие |
|-----------|----------|
| `product.upsert` | Создать/обновить номенклатуру |
| `counterparty.upsert` | Создать/обновить контрагента |
| `inbound.create` | Создать заказ на приёмку |

Идемпотентность: пара `source` + `externalId` — дубликат возвращает `{ duplicate: true }`.
