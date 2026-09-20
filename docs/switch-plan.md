# Switch Plan — WMS-конструктор

План переключения на единую мета-модель документов.  
**Статус миграции P0–7: ✅ завершена** (аудит 2026-09-01).  
Остаточный backlog недочётов: **[gaps-switch-plan.md](./gaps-switch-plan.md)** (2026-09-12).

Обновлено: 2026-09-12 (ссылка на gaps-план; этапы конструктора без изменений).

Связанные документы:

- [gaps-switch-plan.md](./gaps-switch-plan.md) — недочёты после конструктора (актуальный backlog)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — стек и модули
- [wms-constructor-switch-plan.md](./wms-constructor-switch-plan.md) — подробное описание целевой архитектуры и черновики Prisma
- [status-matrix.md](./status-matrix.md) — матрица статусов

---

## 1. Текущий статус

| Проверка | Результат |
|----------|-----------|
| `npm test` | ✅ 53 теста |
| `npm run lint` | ✅ 0 предупреждений |
| `npm run build` | ✅ успешно |
| Git | вне scope (не требуется) |
| i18n | ✅ MVP (`ru` + `en`, см. [i18n-plan.md](./i18n-plan.md)) |

### Прогресс по этапам

| Этап | Название | Статус | Комментарий |
|------|----------|--------|-------------|
| **P0** | Разблокировать сборку | ✅ готово | build, lint, tests зелёные |
| **0** | Типы и реестр | ✅ готово | `types.ts`, `document-registry.ts`, тесты |
| **1** | Маршруты `/doc/*` | ✅ готово | Редиректы `/inbound`, `/outbound`, `/operations` |
| **2** | Единый рендерер форм | ✅ готово | `MetaRecordFields`, `MetaFormSections`, widgets |
| **3** | DOCUMENT_HANDLERS | ✅ готово | фасад, save-модули, тесты, TSD webPath |
| **4** | Табличная часть в мета | ✅ готово | `MetaLineRecord`, custom lines UI, generic handler |
| **5** | Операции в мета | ✅ готово | `/doc/operation`, handler `operation` |
| **6** | Унификация прав | ✅ готово | `permissionForEntity`, `document.*` в UI ролей, алиасы |
| **7** | Workflow и триггеры | ✅ готово | `DocumentStatusControl`, `executeDocumentTransition`, admin |

---

## 2. Целевое состояние

```
/catalog/{entity}   — справочники (system + custom)
/doc/{entity}       — документы и журналы (system + custom)
  ├── список
  ├── карточка (секции из MetaAttribute)
  ├── табличная часть (если capability lines)
  └── статусы (если capability workflow)

/inbound/*          — редирект → /doc/inbound/*
/outbound/*         — редирект → /doc/outbound/*
/operations/*       — редирект → /doc/operation/*
```

**Handlers:** `generic` | `inbound` | `outbound` | `operation`  
**Capabilities:** `lines` | `workflow` | `stock` | `tsd`

---

## 3. Этап P0 — Разблокировать production build

> Приоритет: **критический**. Без этого этапа деплой невозможен.

| # | Задача | Файлы | Критерий |
|---|--------|-------|----------|
| P0.1 | Создать форму добавления строки отгрузки | `src/components/outbound-add-line-form.tsx` (новый) | `doc/outbound/{id}/new` открывается |
| P0.2 | Разделить pure-форматтеры и server-логику рамп | `src/lib/receiving-dock-labels.ts` (новый), `src/lib/receiving-dock.ts` | Client bundle не тянет `prisma`/`pg` |
| P0.3 | Обновить импорты форматтеров | `src/lib/meta/document-form-shared.ts` | Импорт только из `receiving-dock-labels.ts` |
| P0.4 | Исправить `generic` handler | `src/lib/meta/document-handlers/generic.ts` | Убрать `"use server"` с фабрики; server actions — только в async-методах |
| P0.5 | Проверить client/server границы | `src/components/meta-document-fields.tsx` | Нет импортов server-only модулей |
| P0.6 | Убрать lint warnings | `inbound-detail.tsx`, `workflow/seed.ts` | `npm run lint` — 0 warnings |

**Критерий готовности P0:**

- [x] `npm run build` — успешно
- [x] `npm test` — все тесты зелёные
- [x] Карточки inbound/outbound открываются без ошибок в dev

**Оценка:** 0.5–1 день.

---

## 4. Этап 2 — Единый рендерер форм

**Цель:** одна точка рендера реквизитов для system + custom документов и справочников.

| # | Задача | Файлы |
|---|--------|-------|
| 2.1 | Вынести виджеты в отдельный модуль | `src/lib/meta/widgets/` |
| 2.2 | Объединить client-компоненты | `src/components/meta-record-fields.tsx` ← `MetaDocumentFields` + `CustomMetaRecordFields` |
| 2.3 | Общий компонент секций | `src/components/meta-form-sections.tsx` (новый) |
| 2.4 | Обновить страницы | `doc/[entity]/new`, `doc/[entity]/[id]`, `catalog/[entity]/*` |
| 2.5 | Deprecate старые файлы | `meta-document-fields.tsx`, `custom-meta-record-fields.tsx` → re-export |

**Критерий готовности:**

- [x] Шапка inbound/outbound/custom — единый компонент
- [x] EAV-реквизиты на системных документах работают
- [x] Секции, required, readonly — одинаковое поведение

**Оценка:** 2–3 дня.

---

## 5. Этап 3 — Завершить DOCUMENT_HANDLERS

**Цель:** все операции с документами — только через handler-фасад.

| # | Задача | Файлы |
|---|--------|-------|
| 3.1 | Тесты inbound handler | `src/lib/meta/document-handlers/inbound.test.ts` |
| 3.2 | Тесты generic handler | `src/lib/meta/document-handlers/generic.test.ts` |
| 3.3 | Убрать прямые вызовы из страниц | `inbound-detail.tsx`, `outbound-detail.tsx`, `doc/*/page.tsx` |
| 3.4 | Thin wrapper в actions | `document-form-actions.ts` → только делегирование |
| 3.5 | Canonical URL в TSD API | `src/app/api/tsd/orders/route.ts` и др. |

**Критерий готовности:**

- [x] Создание/редактирование inbound, outbound, custom — через `saveDocumentFromForm`
- [x] Нет прямых `saveInboundDocumentMeta` / `saveOutboundDocumentMeta` из UI
- [x] +2 тестовых файла в `npm test`

**Оценка:** 2–3 дня.

---

## 6. Этап 4 — Табличная часть для custom-документов

**Цель:** capability `lines` работает не только для system docs.

| # | Задача | Файлы |
|---|--------|-------|
| 4.1 | UI создания line definition в админке | `admin/meta/[code]/` |
| 4.2 | Хранение строк custom docs | `MetaLineRecord` (JSON `dataJson`) |
| 4.3 | Рендер строк на карточке custom doc | `doc/[entity]/[id]/page.tsx`, `meta-document-lines.tsx` |
| 4.4 | Сохранение строк в generic handler | `document-handlers/generic.ts` |
| 4.5 | Форма добавления строки custom doc | `doc/[entity]/[id]/new/page.tsx` — generic ветка |

**Уже сделано (не трогать):**

- `MetaLineDefinition` / `MetaLineColumn` в Prisma
- Seed колонок inbound/outbound/operation
- `MetaDocumentLinesTable` на system cards

**Критерий готовности:**

- [x] Custom-документ с capability `lines` — CRUD строк (create + list + edit/delete)
- [x] Inbound/outbound строки по-прежнему из мета

**Оценка:** 4–5 дней.

---

## 7. Этап 6 — Завершить унификацию прав

**Цель:** единый resolver для всех типов сущностей.

| # | Задача | Файлы |
|---|--------|-------|
| 6.1 | Использовать `permissionForEntity` везде | `proxy.ts`, `session.ts`, server actions |
| 6.2 | Admin roles UI — показать `document.*` codes | `admin/roles/` |
| 6.3 | Deprecation notice для `module.*` в registry | `permissions/registry.ts` |
| 6.4 | Тесты resolver | `entity-permissions.test.ts` |

**Уже сделано:**

- `entity-permissions.ts` с алиасами `module.inbound` → `document.inbound`
- `permissionForEntity(entityCode, action)`

**Критерий готовности:**

- [x] Одна функция для catalog + document + journal
- [x] Старые permission codes работают (backward compat)

**Оценка:** 1–2 дня.

---

## 8. Этап 7 — Динамические статусы и триггеры

**Цель:** кнопки статусов и TSD-переходы полностью из `StatusWorkflow`, без hardcode в UI.

| # | Задача | Файлы |
|---|--------|-------|
| 7.1 | Универсальный status control | `src/components/document-status-control.tsx` (новый) |
| 7.2 | Заменить inbound/outbound controls | `inbound-status-control.tsx`, `outbound-status-control.tsx` → re-export или удалить |
| 7.3 | Рендер кнопок из `StatusTrigger kind=manual` | `doc-handlers/inbound-detail.tsx`, `outbound-detail.tsx` |
| 7.4 | `executeTransition` в module-actions | `module-actions.ts` |
| 7.5 | Admin UI: редактирование триггеров | `admin/statuses/page.tsx` |
| 7.6 | Тесты workflow transitions | `workflow/engine.test.ts` — расширить |
| 7.7 | Capability `workflow` на entity | `seed-system.ts`, admin meta |

**Уже сделано:**

- Prisma: `StatusWorkflow`, `StatusTransition`, `StatusTrigger`
- `workflow/engine.ts` — `loadWorkflowForEntity`, `isTransitionAllowed`, `getManualTargetStatuses`
- `workflow/seed.ts` — seed из `status-matrix.md`
- `workflow/tsd.ts` — TSD-переходы через workflow
- `inbound-status.ts` / `outbound-status.ts` — workflow-driven options
- `/admin/statuses` — базовый UI

**Критерий готовности:**

- [x] Админ добавляет переход приёмки без деплоя
- [x] Кнопки на карточке — из БД, не из hardcoded списка
- [x] TSD-события сопоставляются с триггерами

**Оценка:** 5–7 дней.

---

## 9. Порядок работ

```
P0 (build) ──► Этап 2 ──► Этап 3 ──► Этап 4
                              └──► Этап 6
                                        └──► Этап 7
```

**Рекомендуемая последовательность:**

1. **P0** — разблокировать build (сейчас)
2. **Этап 2** — единые формы (снижает дублирование)
3. **Этап 3** — завершить handlers + тесты
4. ~~**Этап 6** — права~~ ✅
5. ~~**Этап 4** — custom lines~~ ✅
6. ~~**Этап 7** — динамические статусы~~ ✅

---

## 10. Чеклист регрессии

Прогонять после каждого этапа:

- [x] `npm test` (2026-09-12: 54)
- [x] `npm run build` (2026-09-12)
- [x] `npm run lint` (2026-09-12: 0 errors)
- [ ] Создание приёмки → DRAFT → RELEASED → ТСД ACCEPTED → PLACED
- [ ] Создание отгрузки → DRAFT → RELEASED → ТСД pick → POSTED
- [ ] Добавление строки inbound/outbound (`/doc/{entity}/{id}/new`)
- [ ] Custom catalog: CRUD в НСИ и `/m/{nav}`
- [ ] Custom document: CRUD в `/doc/{code}` (+ lines edit/delete)
- [ ] Права viewer / operator / admin
- [ ] Редиректы: `/inbound/{id}` → `/doc/inbound/{id}`
- [ ] Integration inbox: `inbound.create`, `outbound.create`
- [ ] Outbox drain из admin

---

## 11. Feature flags

> **Решение (2026-09-01):** feature flags из первоначального плана **не внедряем**.  
> Миграция маршрутов уже выполнена (этапы 0–1, 5). Откат — через git revert отдельных коммитов, не через runtime-флаги.

Если понадобится поэтапный rollout в production:

```ts
// Settings — только при необходимости
constructorLines: boolean      // этап 4
workflowDynamicUi: boolean     // этап 7
```

---

## 12. Откат

| Этап | Действие |
|------|----------|
| P0 | Revert коммита; build снова сломан — не критично для dev |
| 2 | Revert; старые `MetaDocumentFields` / `CustomMetaRecordFields` |
| 3 | Страницы вызывают `save*Meta` напрямую |
| 4 | Custom lines UI off; system lines из мета остаются |
| 6 | `module.*` permissions primary |
| 7 | Fallback на `INBOUND_FALLBACK` / hardcoded controls |

Миграции Prisma **не откатывать** — новые колонки nullable.

---

## 13. Оценка оставшейся работы

Миграция конструктора (этапы P0–7) **завершена**. Оценки ниже — исторические, на момент планирования до 2026-09-01.

**Актуальный backlog:** [gaps-switch-plan.md](./gaps-switch-plan.md)  
(критичный путь G0–G2 ≈ 4–6 дней: docs, custom lines edit/delete, регрессия).

| Этап | Было в плане | Итог |
|------|--------------|------|
| P0, 2, 3, 4, 6, 7 | суммарно ~3–4 недели | ✅ сделано |

---

## 14. Зафиксированные решения

1. **URL документов:** canonical `/doc/{entityCode}`; legacy — редирект.
2. **Git:** не в scope текущего плана.
3. **Feature flags:** не внедряем для уже выполненных этапов.
4. **Операции:** journal entity `operation`, read-heavy.
5. **Custom docs:** без складской логики по умолчанию; capabilities явно в админке.
6. **Статусы:** engine уже в коде; UI-миграция — этап 7.
7. **Вспомогательные страницы приёмки** (рампы, транспорт): отдельная задача после этапа 4.
