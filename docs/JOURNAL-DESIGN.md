# Journal — DESIGN (apps/web)

## ТЕКУЩЕЕ СОСТОЯНИЕ
- Сайт открыт для всех, без входа и без Telegram. Позиционирование честное: скоринг-формула, не «AI».
- Страницы: лендинг (hero + живой топ-5), `/how-it-works` (методология), дашборд: обзор, сканер, сигналы,
  стратегия, избранное (localStorage). Settings удалена (308 → /dashboard).
- Хостинг: Cloudflare Pages `fomometer-web`, домены `fomometer.xyz` и `www` привязаны 2026-10-14.
- Прод: деплой `43a8cc2e` (2026-10-14, веса скора на Strategy). Предыдущий `9539d530` (проходы 1 и 2).
- Открыто по сайту: логотипы с CDN DexScreener ставят сторонний cookie (Best Practices 77), прокси по решению владельца.

---

## 2026-10-14 [BUILD] Страницы /whitepaper и /roadmap (не задеплоено)
- Новые: `app/whitepaper/page.tsx` (10 разделов, таблицы статистики и базы, бизнес-модель и токен с меткой «В планах»),
  `app/roadmap/page.tsx` (5 этапов со статусами Готово / Следующий / В планах, чек-листы, условия завершения),
  `components/doc-section.tsx` (`DocSection` с бейджем, `DocTable`). Тексты: `whitepaper.*`, `roadmap.*`,
  `site.whitepaper|roadmap` в en/ru; структура en и ru совпадает, «—» и «…» нет. RU: «Дорожная карта».
- Навигация: шапка (Whitepaper от md), футер (обе страницы, перенос на мобиле), sitemap.
- Цифры на странице статичные, сняты 14.10.2026 (см. запись про документацию), подписаны датой.
- Проверено: tsc 0, lint 0, `next build` ок, превью: 200 на обеих, 1440 и 390 без горизонтального скролла,
  таблицы помещаются в контейнер.
- [DEBUG] на потом: `app/how-it-works/page.tsx` держит свою копию `Section`; перевести на `DocSection`.
- Гейт: деплой сайта, публичная публикация планов токена до юр. проверки (решение владельца).

## 2026-10-14 [BUILD] Документация: whitepaper, токеномика, roadmap, архитектура, эксплуатация
- Новые файлы: `docs/WHITEPAPER.md`, `docs/TOKENOMICS.md` (предложение, требует решений владельца и юр. проверки),
  `docs/ROADMAP.md` (фазы 1 готова, 2–5), `docs/ARCHITECTURE.md` (цикл, данные, API, конфиг), `docs/OPERATIONS.md`
  (деплой, здоровье, инциденты, переобучение). README: таблица документации.
- Факты сняты с прода (только SELECT): 45 618 исходов с 2026-05-06. BUY 26 200: 1 ч выше 41.6%, медиана −0.92%;
  4 ч 37.4%, −4.37%; худшая точка за 4 ч медиана −11.1%, 16.2% падали на 50%+. Всплеск 19 401: 1 ч 39.2%, −0.66%.
  SELL 17 за всё время. База за 72 ч (все токены, шаг 10 мин): 1 ч выше 33.1%, медиана 0.00%; 4 ч 36.3%, −1.15%.
  BUY за те же 72 ч: 4 ч выше 29.7%, медиана −8.97%, то есть хуже базы. Вывод в whitepaper: доказанного преимущества нет.
- Найдено (в roadmap, фаза 2): факторы хранятся только в `signals` (72 ч), тренер видит 3 дня; в `users` 3 Telegram-
  записи; `README_walk_forward.md` устарел; средние по исходам ломают цены-выбросы (+182 284%).
- Проверено: ссылки в 6 документах живые; утверждения о конфиге сверены с `wrangler.toml`, labeler, API.

## 2026-10-14 [BUILD] Веса скора на странице Strategy
- `app/api/strategy/route.ts`: `settings.weights` из `engine_state.last_run.weights` (только конечные числа, `pickWeights`).
- `components/dashboard/strategy-client.tsx`: карточка «Веса скора» между настройками и статистикой: подписи из
  `factors.{key}.label`, подсказка `hint` в title, полосы относительно максимального веса, проценты, сортировка по модулю.
  Состояния: загрузка, ошибка, нет весов. Подписи переносятся (без обрезки «…»).
- Проверено, что веса реально участвуют в скоре: в секрете `tokens` пустой, движок идёт по взвешенной сумме
  (`computeScore` → `fallbackScore`); веса в D1 совпадают с `meta.fallback_weights` в `infra/best_meme_strategy.json`.
- i18n: `strategy.weights_title|weights_subtitle|weights_regime|weights_empty` en/ru, паритет ключей 0 расхождений;
  в `method.score.body` и `docs/METHODOLOGY.md` ссылка «текущие веса на странице Strategy».
- Проверено: tsc 0, lint 0, `next build` ок; превью на прод-D1 1440 EN и 390 RU (без горизонтального скролла);
  деплой `43a8cc2e`, fomometer.xyz/dashboard/strategy показывает 7 весов.

## 2026-10-14 [BUILD] Проход 2: публичный продукт
Решения владельца: честно без «AI», сдержанный тон, методология на сайте + доки репо, бэкенд отдельно.
- Telegram удалён полностью: hero/footer, `lib/env.ts` (файл удалён), vars и KV `CACHE` в `apps/web/wrangler.toml`,
  `t.me` в `next.config`, ключи i18n, OG-описание.
- Лендинг заново (`components/landing/*`, `site-header`, `site-footer`): hero слева + живой топ-5 из `/api/scanner`
  справа (вместо фейкового размытого превью), 3 шага, блок «Чем не является». Удалены dashboard-preview, stats,
  features, footer, framer-motion, glow, gradient-текст, glass, Sparkles, «SECTION 02», капслок.
- `/how-it-works`: данные, 12 факторов (таблица, по коду), формула скора (7 из 12), режимы, правила сигналов,
  фильтр качества, статистика и ограничения. `docs/METHODOLOGY.md` генерируется из того же en.json.
- Дашборд: `StatusBadge` LIVE/STALE по `/api/status` (снимок цен ≤ 3 мин) с «цены N / скор N назад»;
  Settings удалена, «Как это работает» в сайдбаре и топбаре; заголовки вкладок.
- Strategy: настройки из `engine_state.last_run` (вместо KV, в которую никто не писал); статистика с учётом
  направления (SELL = падение), медианы, n, «мало данных» при n < 20, оговорки. `/api/strategy/accuracy` удалён.
- Signals: фильтр по типу (API `?type=`), у всплеска объёма нет ложной дельты скора, аватарки.
- Копия en/ru переписана целиком; подписи и пояснения 12 факторов (`factors.*`), радар на человеческих метках.
- SEO: локализованные metadata, `public/og.png` 1200×630, `robots.ts`, `sitemap.ts`, корневой `error.tsx`, `<main>` на страницах.
- Дизайн-система: убраны gradient-hero/glow/card shadows/pulse/fade-up/glass/tag; `display-lg` спокойнее;
  `tabular-nums` только на числах (на body расширял дефисы).
- Зависимости: −framer-motion, zod, 5 пакетов Radix; −`fmtCompact`, `fmtScore`.
- Доки: README (EN) заново, `infra/cloudflare-setup.md`, `.env.example`, ROADMAP → `docs/archive/ROADMAP-2026-05.md`.
- Проверено: tsc 0, lint чисто, next build и next-on-pages ок; превью с remote D1: все маршруты 200, 308, 404;
  grep-сторожа (Telegram/AI/GPT/LUDOMAN/—/…/мат) 0 в UI; i18n-ключи en/ru полные (скрипт); скриншоты
  1440 и 390, en и ru.

### Пост-оценка (прогноз → факт)
| Критерий | До | Прогноз | Факт |
|---|---|---|---|
| Telegram в UI/конфиге | 14 | 0 | 0 |
| Нечестные claims | ~8 | 0 | 0 |
| Data-дефекты аудита | 9 | 0 | 0 в вебе (данные зависят от движка, проход 3) |
| Захардкоженный EN | ~35 | 0 | 0 |
| «—», «…» в UI | 4 | 0 | 0 |
| Lighthouse a11y лендинг / сканер / методология | 93 / 94 / нет | ≥95 | 100 / 100 / 100 |
| Lighthouse SEO | 100 | ≥95 | 100 |
| Lighthouse Best Practices лендинг/сканер | 100 | 100 | 77 |
Расхождение: Best Practices 77 из-за cookie `__cf_bm`, которую CDN DexScreener ставит на логотипах (раньше
логотипов не было вовсе). CORS у CDN нет, `crossorigin` ломает картинки; убрать можно только проксированием
через свою функцию (лишние вызовы). Оставлено осознанно, решение владельца.

## 2026-10-14 [DEBUG] Проход 1: починка дашборда перед публичным запуском
План: `~/.claude/plans/luminous-skipping-pony.md`. Не задеплоено.
- Выборка: «отслеживаемые» токены = снимок цены за последние 10 мин от последнего снимка (`lib/freshness.ts`,
  `TRACKED_CTE`). Цена из свежего снимка, скор из последнего сигнала. Причина: движок пишет снимки каждую минуту,
  а скоринг почти всегда падает по `exceededCpu` (сигналы раз в 15–45 мин, `engine_state.last_run` старше 2 ч).
  До фикса в сканере висели токены, выпавшие из выборки до 72 ч назад. Сканер: 3 → 23 строки, спарклайны у всех.
- Аватарки: `components/dashboard/token-avatar.tsx` (логотип DexScreener, размер 64/128/256 — CDN принимает
  только их; буква символа как фолбэк). Подключено в scanner, overview, token, watchlist; `image_url` в SELECT.
- Токен: ось Y по min/max, тики 3 знач. цифры; пустое состояние вместо вечного skeleton; баг `e.type` →
  `event_type` (все события были FOMO); радар не режет метки, z-score зажаты в ±3.
- Спарклайн: уникальный gradient id (`#` в id ломал заливку), пустое состояние без shimmer, колонка «30m».
- Обзор: фейковая карточка «Engine 1m» убрана; «Active signals 0» → «BUY за час» из того же источника,
  что список. «Avg FOMO score» → «Средний скор».
- A11y: убран `maximumScale`, глобальный `:focus-visible`, `prefers-reduced-motion`, `aria-pressed`/`type`
  на тумблерах и звёздах, `aria-current` в навигации, `text-dim` #5A5D64 → #82858D (AA на всех фонах).
- Дисклеймер больше не sticky: в конце контента дашборда, не перекрывает мобильную навигацию. Переведён.
- i18n: захардкоженные строки overview, token, scanner, watchlist, error, 404 вынесены в en/ru; время по локали.
- Проверено: tsc 0, lint чисто, next build и next-on-pages ок; превью `wrangler pages dev` с remote D1
  (все API только SELECT): скриншоты desktop 1440 и mobile 390 сканера, токена, обзора.
- Отложено в проход 2 (там переписывается целиком): i18n и копия Strategy, футер сайдбара, framer-анимации
  лендинга без reduced-motion, капслок на лендинге.

## 2026-10-14 [BUILD] Убран Telegram-вход, сайт открыт для всех
Решение владельца: «убрать полностью — сайт открыт для всех».
- Удалено: `middleware.ts`, `app/api/auth/*` (telegram, magic, logout), `app/api/me`, `app/api/tg-webhook`,
  `components/auth/telegram-login-button.tsx`, `lib/auth.ts`, `lib/jwt.ts`, `lib/telegram.ts`, зависимость `jose`.
  Вместе с magic-роутом ушла дыра `skip_gate` (флаг не входил в подпись).
- Избранное: новый `lib/watchlist.ts` (localStorage + useSyncExternalStore, лимит 50).
  `/api/watchlist` теперь только `GET ?addresses=a,b` — рыночные данные по списку из браузера; POST/DELETE удалены.
  `/api/scanner` и `/api/tokens/[address]` больше не отдают `is_watched` — звезда считается на клиенте.
  Серверная таблица `watchlist` на момент правки пустая (0 строк) — данные не потеряны.
- Лендинг: CTA «Open dashboard / Открыть дашборд» вместо Telegram-логина; убрано «both required».
- Дашборд: из шапки убраны аватар и «Выйти»; в настройках оставлен только язык.
- Конфиг: `lib/env.ts`, `lib/cf.ts` (без SESSIONS и секретов), `apps/web/wrangler.toml` (без SESSIONS KV и
  Telegram/cookie vars), i18n en/ru (удалены `auth.*`, `nav.logout`, `landing.cta_login`, `settings.*` подписки;
  добавлен `landing.cta_open`), README, `infra/cloudflare-setup.md`.
- Проверено: `tsc --noEmit` 0, `next lint` чисто, `next build` ок; next dev — `/`, `/dashboard/*` 200 без редиректа,
  `/api/me`, `/api/auth/telegram` 404; SQL нового `/api/watchlist` прогнан SELECT-ом на prod D1.
- Бэкап до правки: scratchpad сессии `backup-web-20261014` (git в проекте нет).
- Вне прохода (гейты владельца): деплой сайта; снять Telegram-webhook бота; судьба воркера `fomometer-recheck`;
  секреты Pages (`JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TG_WEBHOOK_SECRET`) теперь не используются.
- [DEBUG]-задача отдельно: `fomometer-engine` падает по `exceededCpu` (cpuTime 50 ms) почти на каждом запуске.
