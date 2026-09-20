# Switch Plan — закрытие недочётов после конструктора

Актуальный план работ **после** завершения этапов P0–7 в [switch-plan.md](./switch-plan.md).  
Создано: 2026-09-12 (аудит кодовой базы).  
Обновлено: 2026-09-12 (реализация G0–G7).

Связанные документы:

- [switch-plan.md](./switch-plan.md) — миграция на `/doc/*` и мета-handlers (✅ готово)
- [i18n-plan.md](./i18n-plan.md) — хвосты мультиязычности
- [ARCHITECTURE.md](./ARCHITECTURE.md) — стек и модули
- [wms-constructor-switch-plan.md](./wms-constructor-switch-plan.md) — исторический целевой дизайн (частично устарел)

**Вне scope этого плана:** мультиарендность / несколько складов (в модели один `Settings`, один склад). Выносить отдельным продуктовым решением.

---

## 1. Текущий статус

| Проверка | Результат |
|----------|-----------|
| Конструктор документов (P0–7) | ✅ |
| Custom lines create + list + **edit/delete** | ✅ |
| Docs конструктора актуализированы | ✅ G0 |
| i18n PWA manifest от локали | ✅ G3 |
| Рампы/транспорт → `/catalog/*` | ✅ G4 (редиректы в `next.config.ts`) |
| Seed ролей operator / viewer | ✅ G5 |
| Admin `/icons` → `/admin/nav` | ✅ G6 |
| Legacy routes в `next.config` redirects | ✅ G7 |
| Ручной регресс §10 + `npm test/lint/build` | ✅ G2 — test/lint/build/seed прогнаны 2026-09-12 |
| Git init / CI baseline | ⬜ G8 — Git for Windows не установлен |

### Прогресс по этапам

| Этап | Название | Статус | Оценка |
|------|----------|--------|--------|
| **G0** | Актуализировать docs конструктора | ✅ | 0.5 дня |
| **G1** | Custom lines: edit + delete | ✅ | 2–3 дня |
| **G2** | Прогон регрессии + фиксация | ✅ авто (ручной UI — по желанию) | 1–2 дня |
| **G3** | i18n хвосты (PWA + проверки) | ✅ | 1 день |
| **G4** | Рампы / транспорт → канон `/catalog` | ✅ | 1–2 дня |
| **G5** | Seed ролей operator / viewer | ✅ | 0.5–1 день |
| **G6** | Admin UX: icons / hub consistency | ✅ | 0.5 дня |
| **G7** | Legacy routes cleanup | ✅ | 0.5–1 день |
| **G8** | Git / CI baseline | ⬜ нет Git | 0.5 дня |

---

## 2. Целевое состояние

```
Custom document (capability lines)
  ├── список строк          ✅
  ├── добавить строку       ✅  /doc/{code}/{id}/new
  ├── редактировать строку  ✅  /doc/{code}/{id}/lines/{lineId}
  └── удалить строку        ✅  deleteCustomDocumentLineAction

Каталоги приёмки
  ├── /catalog/receiving_docks   ✅
  └── /catalog/transport_units   ✅
  └── /inbound/docks|transport   → redirects

Роли из seed
  ├── admin     ✅ system
  ├── operator  ✅ system
  └── viewer    ✅ system
```

---

## 3. Этап G0 — ✅

См. историю: ссылки в README / ARCHITECTURE / switch-plan §13.

---

## 4. Этап G1 — ✅ Custom lines edit + delete

**Сделано:**

- `updateCustomDocumentLine` / `deleteCustomDocumentLine` / `getCustomDocumentLine` — `src/lib/meta/custom-lines.ts`
- Actions — `src/lib/meta/actions.ts`
- UI edit — `src/app/doc/[entity]/[id]/lines/[lineId]/page.tsx`
- Кнопки на карточке — `src/app/doc/[entity]/[id]/page.tsx`
- `docLineEditPath` — `src/lib/meta/document-paths.ts`
- Форма с `values` / `submitLabel` — `custom-document-add-line-form.tsx`
- Тест на update form data — `custom-lines.test.ts`
- i18n: `editLineTitle`, `actions`

**Критерий готовности:**

- [x] API + UI edit/delete
- [x] Перенумерация `lineNo` при delete
- [ ] `npm test` в среде с Node (G2)

---

## 5. Этап G2 — ✅ авто-регрессия (2026-09-12)

Прогнано через portable Node 20 в `.tools/` (в системном PATH не было):

| Команда | Результат |
|---------|-----------|
| `npm test` | ✅ 54/54 |
| `npm run lint` | ✅ 0 errors (1 pre-existing warning в `show-all-dialog.tsx`) |
| `npm run build` | ✅ после починки битого `enhanced-resolve` и очистки `.next` |
| `SEED_DEMO_USERS=1 npm run db:seed` | ✅ admin / operator / viewer |

**Побочная находка:** в `node_modules/enhanced-resolve/lib/Resolver.js` был мусорный байт `0x19` (OneDrive/копирование?) — переустановка пакета починила build.

Ручной UI-чеклист §10 (ТСД/inbox) — не автоматизирован, см. §13.

---

## 6. Этап G3 — ✅ i18n

- `src/app/manifest.ts` — `lang` / name из cookie `wms.locale`
- Удалён статичный `public/manifest.webmanifest`
- Login уже на `getTranslations("login")`
- [i18n-plan.md](./i18n-plan.md) обновлён

---

## 7. Этап G4 — ✅ Рампы / транспорт

Канон уже был `/catalog/receiving_docks` и `/catalog/transport_units`; redirects в `next.config.ts` проверены (`/inbound/docks|transport` + `new` + `:id`).

---

## 8. Этап G5 — ✅ Seed ролей

- `SYSTEM_ROLE_CODES`: admin, operator, viewer — `permissions/check.ts`
- Дефолты прав — `DEFAULT_ROLE_PERMISSIONS` в registry
- Dynamic codes — `defaultEnabledForDynamicCode`
- `prisma/seed.ts` + `SEED_DEMO_USERS=1` для demo-логинов
- `PERMISSIONS_SEED_REV = 3`; seed сбрасывает `permissionsSeedRev` перед ensure
- `.env.example` обновлён

---

## 9. Этап G6 — ✅ Admin icons

- Redirect `/admin/icons` → `/admin/nav` в `next.config.ts`
- Страница `src/app/admin/icons/page.tsx` удалена

---

## 10. Этап G7 — ✅ Legacy routes

Redirects в `next.config.ts`: `/products`, `/nomenclature`, `/locations`, `/types`, `/movements`.  
Тонкие `page.tsx` удалены. `/nsi/[...slug]` оставлен (полезный alias).

---

## 11. Этап G8 — ⬜ Git / CI

В окружении агента нет `git` и `npm` в PATH. При наличии инструментов:

```bash
git init
# убедиться .gitignore: .env, *.db, node_modules, src/generated/prisma
git add -A
git commit -m "Initial commit: WMS after gaps G0-G7"
```

CI: `.github/workflows/ci.yml` уже настроен (lint + test + build).

---

## 12. Порядок работ (факт)

```
G0 ✅ → G1 ✅ → G3 ✅ → G4 ✅ → G5 ✅ → G6 ✅ → G7 ✅
G2 / G8 — локально у разработчика
```

---

## 13. Чеклист регрессии (этот план)

- [x] `npm test` / `npm run lint` / `npm run build`
- [ ] Custom doc: add / edit / delete line (UI)
- [ ] System inbound/outbound lines без регрессии (UI)
- [ ] Login `en` + sidebar EN (UI)
- [x] `/catalog/receiving_docks` и transport (redirects в config + build routes)
- [x] Роли viewer/operator из seed (`SEED_DEMO_USERS=1`)
- [x] `/admin/icons` → `/admin/nav`
- [x] Legacy `/products` и др. → redirects в `next.config`
- [ ] Полный UI-чеклист [switch-plan.md §10](./switch-plan.md)

---

## 14. Откат

| Этап | Действие |
|------|----------|
| G1 | Revert actions/UI; схема БД без миграций |
| G3 | Вернуть static manifest |
| G5 | Роли system можно оставить |
| G6–G7 | Revert redirects / восстановить page stubs |

---

## 15. Зафиксированные решения

1. **Мультисклад / tenants** — не в этом плане.
2. **Custom lines edit/delete** — только generic/custom documents.
3. **Коды каталогов:** `receiving_docks` / `transport_units` (не singular).
4. **Git init** — оставлен владельцу (G8 blocked в агенте).
5. **Demo users** — только при `SEED_DEMO_USERS=1`.

---

## 16. Findings log

| Дата | Находка | Severity | Статус |
|------|---------|----------|--------|
| 2026-09-12 | Agent shell: нет system `npm`/`git` — использован portable Node 20 в `.tools/` | medium | mitigated |
| 2026-09-12 | Seed мог пропускать `ensureRolePermissions` при сохранённом rev — исправлено сбросом ключа | medium | fixed |
| 2026-09-12 | Битый `enhanced-resolve` Resolver.js (байт 0x19) ломал `next build` | high | fixed (reinstall) |
| 2026-09-12 | Git for Windows не установлен — G8 init не выполнен | low | open |
