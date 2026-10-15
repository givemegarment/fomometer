# Journal — DESIGN (apps/web)

## ТЕКУЩЕЕ СОСТОЯНИЕ
- Сайт открыт для всех, без входа и без Telegram. Позиционирование честное: скоринг-формула, не «AI».
- Язык: только английский (решение владельца 15.10). RU-локаль, переключатель и `messages/ru.json` удалены.
- Страницы: лендинг (hero + живой топ-5), `/how-it-works` (методология), дашборд: обзор, сканер, сигналы,
  стратегия, избранное (localStorage). Settings удалена (308 → /dashboard).
- Хостинг: Cloudflare Pages `fomometer-web`, домены `fomometer.xyz` и `www` привязаны 2026-10-14.
- Прод: деплой `8fdf5718` (2026-10-15: только английский, прокси логотипов). Lighthouse mobile: главная и сканер 100/100/100/100.
- Логотипы через `/api/logo`, сторонних cookie нет.

---

## 2026-10-15 [BUILD] Редизайн, фаза 1: система, оболочка, лендинг, доска (не задеплоено)
Повод: владелец назвал сайт ИИ-слопом (скриншоты лендинга, «How it works», 01/02/03, «What X is not») и указал, что
скиллы и MCP не использовались. Загружен скилл `designer`. Аудит своими глазами (Chrome DevTools, 1440 и 390, все
страницы): лавандовый акцент Phantom, пилюли и радиусы 12–20, маркетинговый hero, шаги 01/02/03, KPI-карточки с одним
числом и пустой половиной, сайдбар обрывается, «Average score» без смысла, радар 12 осей, градиенты под линиями.
Референсы: DexScreener, GMGN (живые, Chrome DevTools); затем владелец назвал эталон https://1wintoken.com: снят DOM
(Inter 600, −2px при 96px, фон #141415, зелёный #00B24B, вторичный текст #787C83, кольцо rgba(255,255,255,.08),
градиенты карточек, `transform/opacity/filter 0.4s cubic-bezier(0.5,0,0,1)`, marquee, progress-bar, sticky-CTA).
Их KH Teka не загружается, страница рендерится в Inter. Mobbin выпал из сессии (нужен `/mcp`).

Сделано:
- Токены (`tailwind.config.ts`, `globals.css`): фон #141415, поверхности #1B1B1D/#222225, белый текст, вторичный
  #9A9EA5/#8A8E95, зелёный #00B24B для текста и `accent.button` #00853A для заливки кнопок (белый 4.76:1, AA);
  радиусы 12/16/24/28/40; display-шкала 600 с плотным трекингом; easing `snap`/`out`; marquee, nudge; `.reveal`,
  `.ring-hair`, `.num`, `.label`. Иконка и вордмарк: «метр» из трёх столбиков, последний зелёный. OG-картинка заново
  (`design/og.html` → `public/og.png`).
- Лендинг `/` по структуре эталона, с живыми данными вместо 3D: hero 96px «FOMO, measured.» с отсчётом до следующего
  прогона и полосой минуты (STALE при молчании движка > 3 мин), фон из столбиков = скоры токенов; marquee тикеров;
  бенто фактов (токены, сигналы 7 дней, 1,440 прогонов, 12 факторов, белая карточка BUY против любого токена);
  градиентная сцена с живым топ-5; четыре цветные карточки «как работает»; белая панель Track record с кольцом;
  FAQ на details/summary; многоколоночный футер; плавающая мини-CTA. Reveal, count-up, reduced-motion.
- `/dashboard` = доска (обзор и сканер объединены, `/dashboard/scanner` → 308): полоса фактов, чипы-фильтры, таблица
  с ценой в нотации DexScreener (`$0.0₄8128`), скор числом с полосой (зелёная от порога BUY), «Pace» из
  `signals.fomo_raw` (×-темп 5 мин к часу), токены ниже фильтра ликвидности приглушены и подписаны.
- Оболочка `components/shell`: верхняя панель 48px с разделами и статусом, мобильные вкладки, нижняя строка статуса.
  Удалены сайдбар, мобильная нижняя навигация, topbar, disclaimer-ribbon, overview, scanner-client, site-header,
  старый hero/steps/limits. API: `scanner` отдаёт `fomo_raw`, `strategy.settings.min_liquidity_usd`.
- `buttonVariants` вынесен в `ui/button-variants.ts` (server-компонент вызывал функцию из `'use client'` → 500).

Проверено (превью на prod D1): маршруты 200, `/dashboard/scanner` 308, 404 на несуществующем; typecheck 0, lint 0.
Lighthouse mobile: `/` 100/100/100/99 (CLS 0.97 при подгрузке данных), `/dashboard` 100/100/100/100 после правки
разметки полосы фактов (ссылки внутри `<dl>`) и подчёркивания ссылок в строке статуса. Сирые i18n-ключи удалены
(`overview`, `nav.overview`, `site.dashboard`, `site.how_it_works`, `scanner.filters`, `common.disclaimer`).

Осталось по плану: фаза 2 страница токена (радар → полосы факторов, график без градиента), фаза 3 сигналы, стратегия,
избранное, фаза 4 документация (`/how-it-works` всё ещё со старым «On this page»). 3D-рендеры как у эталона: Higgsfield,
по команде владельца (кредиты).


## 2026-10-15 [BUILD] Деплой `8fdf5718` (команда владельца «деплой»)
- fomometer.xyz с `Accept-Language: ru` и cookie `LOCALE=ru`: 9 страниц 200 и 404, `lang="en"`, кириллицы 0.
- `/api/logo/<id>?s=64`: 200 webp 1.7 КБ, `set-cookie` нет, `cache-control: public, max-age=604800, immutable`.
- Lighthouse mobile: главная и /dashboard/scanner: Accessibility 100, Best Practices 100 (было 77), SEO 100, Agentic 100.


## 2026-10-15 [BUILD] Сайт только на английском (владелец: «чтобы нигде не было русского языка», задеплоено `8fdf5718`)
- `i18n.ts`: одна локаль `en`, без cookie `LOCALE` и `Accept-Language`. next-intl оставлен как хранилище копирайта
  (`messages/en.json`); импорт по шаблонному пути, чтобы тип сообщений с массивами (`t.raw`) не ломал `RequestConfig`.
- Удалены `messages/ru.json`, `components/locale-toggle.tsx` (шапка и topbar), ключ `common.language`.
  `fmtTimeAgo` без RU-ветки и параметра локали; неиспользуемые `useLocale` убраны в status-badge, signals, overview.
  README: «next-intl (English…)». Копии удалённого в scratchpad `ru-removed/`.
- Проверено (превью на prod D1) с `Accept-Language: ru` и cookie `LOCALE=ru`: 9 страниц + 404, все `lang="en"`,
  кириллицы в HTML 0. В собранных бандлах кириллица только в полифиллах Next (core-js), не текст UI.
  Исходники `apps/web` без node_modules/сборки: 0 файлов с кириллицей. Мобильный topbar без переключателя, LIVE,
  таблица «Стратегии» на английском, без горизонтального скролла. typecheck 0, lint 0.
- Ключ `strategy.horizon` (из прошлого DEBUG) теперь только EN: 15m / 1h / 4h.


## 2026-10-15 [BUILD] Прокси логотипов (решение владельца «делаем», задеплоено `8fdf5718`)
- `app/api/logo/[id]/route.ts`: принимает только id CMS-картинки DexScreener (`[A-Za-z0-9_-]{6,64}`) и размер 64/128/256
  (CDN другие отдаёт 422), берёт `cdn.dexscreener.com/cms/images/<id>?format=webp`, отбрасывает заголовки апстрима
  (в том числе `set-cookie: __cf_bm`), кэш `caches.default` и `Cache-Control: public, max-age=604800, immutable`.
  Не открытый прокси: хост зашит, id по регулярке.
- `token-avatar.tsx`: `logoSrc` переводит `cdn.dexscreener.com/cms/images/<id>` на `/api/logo/<id>?s=…`; прочие URL как есть.
- Все 10,688 логотипов в `tokens` с этого хоста. Вес: 64 px webp 0.9 КБ, 128 px 1.9 КБ (было avif 800 px ≈ 7 КБ).
- Проверено (превью на prod D1): s=64/128 200 webp без set-cookie, s=999 404, кривой id 404, несуществующий 404;
  /dashboard/scanner: 28 из 28 картинок загружены через `/api/logo`, запросов к dexscreener 0. typecheck 0, lint 0.
- Цена: каждый логотип = запрос к Pages Functions (бесплатно 100 тыс./сутки) до кэша браузера. Записано в OPERATIONS.
- Ожидаю Lighthouse Best Practices 77 → 100 (cookie DexScreener был единственной причиной); замер после деплоя.

## 2026-10-15 [DEBUG] Подписи горизонтов на «Стратегии» в RU
- «Через 15m / 1h» → «Через 15м / 1ч / 4ч», «Медиана 1ч / 4ч» (как «24ч» в остальном RU-интерфейсе). Ключ `strategy.horizon`.
  Проверено в превью: заголовки таблицы на RU.
- Дорожная карта: бот удалён владельцем (15.10), логотипы через сайт; все 8 пунктов этапа 2 отмечены, статус этапа остаётся
  «Следующий» (условие завершения: 30 дней факторов).


## 2026-10-15 [BUILD] Этап 2, проход C: «Стратегия» с базой, потерянными и очищенной статистикой (задеплоено 2026-10-15)
- `/api/strategy`: один запрос к `engine_state` (`last_run`, `track_record`) вместо выборки исходов на каждый запрос;
  параметр `days` убран (интерфейс его не передавал).
- `strategy-client.tsx`: `RecordCard` + `RecordRow`. Колонки: сигналов, через 15m / 1h / 4h, медиана 1h и 4h, нет цены
  через 4h (доля и x/y). Строка базы «Любой отслеживаемый токен» внизу, отделена. Примечания: дата начала базы,
  число исключённых (ICU plural, RU one/few/many), оговорки. Пустое состояние «пересчитывается раз в час».
  Числа по локали (`Intl.NumberFormat`).
- Тексты: `strategy.*` (col_median, col_lost, record_updated, record_empty, baseline_label, baseline_note, flagged_note,
  favorable.baseline, caveats), удалён `col_median_1h`. `method.limits.body` EN/RU и `docs/METHODOLOGY.md`: слежение
  после выхода из списка, флаг, сравнение с базой.
- Проверено: локальный `pages dev` на тестовой D1 с синтетической сводкой (только для вёрстки): 1440 EN и 390 RU,
  таблица скроллится внутри карточки, страница без горизонтального скролла, «11 800», «56 исходов». typecheck 0, lint 0.
- Не сделано в этапе 2: прокси логотипов (решение владельца: каждый логотип = запрос к Functions, бесплатный лимит
  100 тыс./сутки).
- [DEBUG] «Через 15m / 1h» в RU: единицы горизонта латиницей (было до этого прохода).
- Порядок деплоя: сайт с этим проходом только после воркеров, иначе «ещё не готова» до первого запуска нового labeler.


## 2026-10-15 [DEBUG] Чтения D1: API сайта сканировал таблицы целиком (задеплоено 2026-10-15)
- Симптом: D1 rows read 4.5–5.0 млн/сутки до 13.10, 294 млн 14.10, 161 млн за первые 9 ч 15.10 (GraphQL
  `d1AnalyticsAdaptiveGroups`). Бесплатный лимит 5 млн/сутки; ошибок D1 пока нет, но запас превышен в 30–60 раз.
- Причина (`d1QueriesAdaptiveGroups`, 6 ч): CTE свежести `lib/freshness.ts` (сканер, обзор) 201 тыс. строк за вызов,
  163 вызова = 33 млн. Планировщик для `GROUP BY address` обходил весь индекс (address, time), а не диапазон по времени;
  `ls` вдобавок брал MAX по всем сигналам за 72 ч. Опрос дашборда каждые 30 с: одна открытая вкладка ≈ 290 млн/сутки.
  Мои вкладки DevTools закрыты, нагрузка от посетителей.
- Фикс: оба CTE ограничены окном 10 мин по своей таблице и `GROUP BY +address` (диапазонное чтение по индексу времени).
  `ls` теперь по свежим сигналам: токены, за которыми движок следит только ради цены прошлого события (этап 2),
  не попадут в рейтинги со старым скором. `/api/tokens/[address]` и `/api/watchlist`: группировка всей
  `token_snapshots` заменена на `MAX(time)` по адресу.
- Замер на prod D1 (чтение, тот же результат): сканер 210,112 → 902 строки, средний скор 379, токен 127,689 → 3.
  Превью (`wrangler pages dev`, prod D1): /api/scanner 29 строк, /api/overview, /api/tokens, /api/watchlist,
  /dashboard, /dashboard/scanner 200. typecheck 0, lint 0.
- Остаётся: одна вкладка сканера ≈ 2.6 млн/сутки (902 × 2880) плюс спарклайны ≈ 4 млн; движок сам ≈ 6 млн/сутки
  (окна 90 мин). При строгом лимите 5 млн это всё ещё выше; нужен замер после деплоя.


## 2026-10-14 [BUILD] Страницы /whitepaper и /roadmap (задеплоено 2026-10-15, `56d44711`)
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
