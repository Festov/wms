# План мультиязычности (i18n)

Обновлено: 2026-09-12

## Текущее состояние

| Компонент | Статус |
|-----------|--------|
| Библиотека | `next-intl` (cookie `wms.locale`, без префикса в URL) |
| Локали | `ru` (по умолчанию), `en` |
| Переключатель | Настройки → Интерфейс |
| Файлы сообщений | `messages/ru.json`, `messages/en.json` (~1200 ключей) |
| Переведено | login, settings, sidebar, shell, страницы app, компоненты TSD/форм, реестры lib |
| API ошибки TSD | `errors.api.*` + `Accept-Language` / cookie |
| DB labels статусов | `Status.labelsJson` (`{ ru, en }`) |

## Архитектура

```
messages/{locale}.json       — статические строки UI
src/i18n/config.ts           — локали, cookie
src/i18n/request.ts          — загрузка сообщений (next-intl plugin)
src/lib/i18n/labels.ts        — маппинг module/sidebar/navGroup → ключи
src/lib/i18n/actions.ts       — setLocaleAction (cookie + revalidate)
src/lib/i18n/sync.ts          — translateSync для server/lib без React
src/lib/i18n/resolve-label.ts — resolveStatusLabel, labelsJson
src/lib/i18n/api.ts           — resolveApiLocale, apiErrorMessage
```

**Принцип:** коды (`inbound`, `DRAFT`, entity codes) не меняются; переводятся только display-строки.

**DB-данные:** статусы — `labelsJson`; MetaEntity.name, NavItem.label, workflow trigger labels — на языке создания (см. ограничения).

## Как добавить перевод

### Server Component

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("mySection");
  return <h1>{t("title")}</h1>;
}
```

### Client Component

```tsx
"use client";
import { useTranslations } from "next-intl";

export function MyButton() {
  const t = useTranslations("common");
  return <button>{t("save")}</button>;
}
```

### Новый ключ

1. Добавить в `messages/ru.json` и `messages/en.json`
2. Использовать `t("section.key")` вместо литерала

## Фазы миграции

| Фаза | Область | Статус |
|------|---------|--------|
| **1** | Инфраструктура, login, settings, sidebar | ✅ |
| **2** | Реестры: permissions, NSI nav, status labels, format enums | ✅ |
| **3** | Страницы: inbound/outbound, inventory, admin | ✅ |
| **4** | TSD wizards, API error messages (auth/handler) | ✅ |
| **5** | DB labels статусов (`labelsJson`) | ✅ |

## Ограничения

- URL без `/en/` префикса — deep links на дефолтном пути, язык из cookie
- Custom meta entities — названия из конструктора (без `labelsJson` на MetaEntity)
- Бизнес-ошибки TSD API (throw в сервисах) — могут оставаться на языке источника
- Подтверждение очистки БД: `ОЧИСТИТЬ` или `CLEAR`
- PWA manifest: `lang` follows `wms.locale` cookie via `src/app/manifest.ts` (was hardcoded `ru` in `public/manifest.webmanifest`)

## Регрессия

- [x] Переключить язык в Settings → sidebar на English
- [x] `npm test` / `npm run build` / `npm run lint`
- [x] Login page на `/login` с cookie `en` (ручная проверка — строки из `messages/en.json`)
- [x] ТСД PWA manifest `lang` из cookie (`src/app/manifest.ts`)
