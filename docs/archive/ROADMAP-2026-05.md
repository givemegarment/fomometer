> **Archived 2026-10-14.** Original planning document from May 2026. It describes the Telegram-gated version of the site, which no longer exists. For the current system see `README.md` and `docs/METHODOLOGY.md`.

# FOMOMETER.XYZ — ROADMAP

> Web-dashboard на базе движка AlphaGPT (без execution), с Telegram-gate доступом, на Cloudflare.

---

## 0. TL;DR

Берём аналитический «мозг» AlphaGPT (data pipeline + 12 факторов + StackVM-формула), выкидываем Solana-execution, и поверх собираем современный публичный сайт **fomometer.xyz** с дашбордом meme-токенов. Доступ к дашборду — только после **подтверждения подписки** на TG-канал/чат через существующего бота. Хостинг — **Cloudflare Pages + Workers + D1 + KV + Cron**. Стиль — **70/30 Phantom/Robinhood** — тёмный крипто-вайб с фиолетовыми градиентами и glass-morphism, плюс чистая Robinhood-иерархия с крупными числами и красно-зелёной семантикой.

## 0.1 Финальные решения (после уточнений)

| Пункт | Решение |
|---|---|
| Источник данных | **DexScreener (free, без ключа)**, лимит 60 req/min/эндпоинт |
| OHLCV | DexScreener **не отдаёт OHLCV** → строим **собственный time-series** в D1 (snapshot каждую 1 мин) |
| Топ токенов | **Top-50 по Solana** |
| Частота refresh | **1 минута** (3 req/min vs лимит 60 — комфортный запас 20×) |
| TG-recheck | каждые 15 минут |
| Языки UI | **EN + RU** с переключателем, default — EN |
| Watchlist | **да**, в v1 |
| Live Signals feed | **да**, в v1 |
| DM-уведомление при потере доступа | `TELEGRAM_NOTIFY_ON_LOST_ACCESS=true` (default) |
| TG-канал | `-1002142530460` → https://t.me/chasetrustchannel |
| TG-чат | `-1002023542791` → https://t.me/chasetrustchatt |
| Логика гейта | `AND` — подписка на **оба** ресурса обязательна (по умолчанию; меняется через `TELEGRAM_GATE_LOGIC`) |
| Тренировка формулы | оффлайн на Mac (Python), коммитим `best_meme_strategy.json` |
| Fallback без формулы | **weighted_sum** (рулбейс на факторах с упором на FOMO) |
| Стиль | **70/30 Phantom/Robinhood** |
| Лого | пользователь добавит позже (placeholder wordmark до этого) |
| Дисклеймер | sticky-баннер «Not financial advice» (без отдельных /terms /privacy на v1) |
| Cloudflare setup | **полностью на стороне Claude** через `wrangler` + API token |
| GitHub репо | `github.com/givemegarment/fomometer` — clean rewrite в самом конце (старый код **не смотрим**) |

---

## 1. Что мы строим

### 1.1 Публичная часть (без авторизации)
- **Лендинг** — hero, demo-скрин дашборда (заблюрен), описание «AI-движок ищет FOMO раньше толпы», CTA «Login with Telegram».
- **Login with Telegram** — официальный Telegram Login Widget.

### 1.2 Дашборд (за TG-gate)
- **Overview** — топ-метрики рынка: активных сигналов, средний FOMO-score, лидеры дня, последние BUY-триггеры.
- **Token Scanner** — таблица из Top-N мемкоинов, отсортированных по AlphaGPT-скору. Колонки: symbol, score, цена, 24h%, ликвидность, FDV, FOMO-фактор, mini-spark-line.
- **Token Detail** — страница `/token/[address]`: OHLCV-график, 12 факторов в радар-чарте, история скора, «когда движок дал BUY-сигнал», ссылки на Birdeye/Solscan/DexScreener.
- **Live Signals Feed** — реал-тайм лента «movments»: токен X пробил BUY threshold, токен Y потерял импульс. Полезно для FOMO-аудитории.
- **Strategy Info** — текущая формула (`best_meme_strategy.json`), когда тренировалась, какие факторы используются. Прозрачность ≈ доверие.
- **Watchlist** *(опц.)* — пользователь сохраняет токены, привязка к его TG-id.
- **Settings** — TG-аватар + ник, кнопка «Logout», статус подписки.

### 1.3 Что **не** делаем
- Ничего, что приближается к торговле (нет кнопок Buy/Sell, нет кошельков, нет приватных ключей).
- Никаких финансовых рекомендаций — везде дисклеймер «Not financial advice».

---

## 2. Архитектура

### 2.1 High-level
```
                 ┌───────────────────────┐
                 │   DexScreener API     │
                 │   (free, snapshot)    │
                 └──────────┬────────────┘
                            │
                            ▼
            ┌────────────────────────────────┐
            │   Engine Worker (Cloudflare)   │
            │   — fetch Top-50 trending      │
            │   — write snapshot row to D1   │
            │   — compute 12 factors (TS)    │
            │     on rolling window from D1  │
            │   — run StackVM on formula     │
            │     (or fallback weighted-sum) │
            │   — emit signal_events         │
            │   triggered by Cron (1 min)    │
            └──────────────┬─────────────────┘
                           │
                           ▼
            ┌────────────────────────────────┐
            │   Cloudflare D1 (SQLite)       │
            │   tokens, ohlcv_recent,        │
            │   signals, users, sessions     │
            └──────────┬─────────────────────┘
                       │
                       ▼
   ┌──────────────────────────────────────────────────┐
   │   Next.js (app/) on Cloudflare Pages             │
   │   ─ /                  landing + TG login        │
   │   ─ /dashboard/*       gated UI                  │
   │   ─ /api/auth/telegram verify HMAC + getChatMember│
   │   ─ /api/signals       D1 reads                  │
   │   ─ /api/tokens/[a]    D1 reads                  │
   └──────────────────────────────────────────────────┘
                       │
                       ▼
            ┌────────────────────────────────┐
            │   Recheck Cron Worker          │
            │   каждые 15 мин: для каждой    │
            │   активной сессии проверяет    │
            │   getChatMember; снимает       │
            │   доступ если status="left"    │
            └────────────────────────────────┘
```

### 2.2 Стек
| Слой | Технология | Почему |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript** | стандарт, отличная поддержка CF Pages через `@cloudflare/next-on-pages` |
| Стилизация | **Tailwind CSS** | де-факто стандарт; быстро под Phantom/Robinhood |
| UI-kit | **shadcn/ui** + Lucide icons | максимально кастомизируемый, не "буткамповый" вид |
| Графики | **Recharts** (или **Tremor** для финансовых дашбордов) | Robinhood-стиль из коробки |
| Анимация | **Framer Motion** | плавные переходы Phantom-стиля |
| i18n | **next-intl** | App Router-friendly, EN/RU |
| Data fetching | **SWR** + native `fetch` | poll каждые 30 сек на дашборде |
| Шрифт | **Inter** / **Geist** | резкость, премиальность |
| Backend / API | **Cloudflare Workers** (Hono) или Next.js Route Handlers через `next-on-pages` | edge-native, дешёво, рядом с D1 |
| БД | **Cloudflare D1** (SQLite) | бесплатный лимит, простая схема |
| Кеш / сессии | **Cloudflare KV** | hot lookup сессий |
| Расписания | **Cloudflare Cron Triggers** | refresh + recheck без отдельной инфры |
| Auth | **Telegram Login Widget** + кастомный JWT в HttpOnly cookie | стандарт TG, никаких email/паролей |
| Хостинг | **Cloudflare Pages** + Workers | домен fomometer.xyz уже на CF |
| CI/CD | **GitHub Actions** → `wrangler deploy` / Pages auto-deploy | приватный репо у вас уже есть |

### 2.3 Engine: адаптация под DexScreener (важно!)

**Проблема №1 — нет PyTorch на Cloudflare.** AlphaGPT использует PyTorch для генерации/обучения формулы и StackVM для исполнения. **Cloudflare Workers не запускает Python/PyTorch.**

**Проблема №2 — DexScreener не отдаёт OHLCV.** Только текущий snapshot + готовые агрегаты по таймфреймам:
- `priceUsd`, `priceNative`, `marketCap`, `fdv`
- `priceChange.{m5, h1, h6, h24}`
- `volume.{m5, h1, h6, h24}`
- `txns.{m5, h1, h6, h24}.{buys, sells}`
- `liquidity.{usd, base, quote}`

**Решение (Path A++): pure-TS engine + собственный time-series.**

1. **Snapshot loop в Engine Worker (cron каждую 1 мин):**
   - `GET /metas/trending/v1?chainIds=solana` → топ-50 mint-адресов.
   - `GET /tokens/v1/solana/{addr1,addr2,…}` (батчи по 30) → snapshot всех 50.
   - Записываем в D1: `token_snapshots(address, time, price, volume_h1, vol_change_m5, liq, fdv, buys_h1, sells_h1, ...)`.

2. **Адаптированные факторы (12 → 12, переосмысление под DexScreener-данные):**
   | Старое имя (AlphaGPT) | Новая реализация на DexScreener-snapshot |
   |---|---|
   | `ret` (log-return) | `log(price_now / price_prev_minute)` — из time-series |
   | `liq_score` | `clamp((liquidity_usd / fdv) × 4, 0, 1)` — без изменений |
   | `pressure` (buy/sell imbalance) | `(buys_h1 − sells_h1) / (buys_h1 + sells_h1)` — из txns |
   | `fomo` (volume acceleration) | `(volume_m5 × 12 − volume_h1) / volume_h1` — относительный всплеск |
   | `dev` (deviation from MA) | MA-20 строим на 20-минутном окне snapshot'ов |
   | `log_vol` | `log(1 + volume_h1)` — без изменений |
   | `vol_cluster` | rolling std return на 10-мин окне snapshot'ов |
   | `momentum_rev` | знаковый разворот суммы returns на 5-мин окне |
   | `rel_strength` | RSI-14 на 1-мин returns из time-series |
   | `hl_range` | `\|priceChange.h1\|` — прокси за неимением H/L |
   | `close_pos` | `(price_now − min_h1) / (max_h1 − min_h1)` из time-series |
   | `vol_trend` | `(volume_h1 − volume_h6/6) / (volume_h6/6)` |

3. **StackVM** (`vm.py` + `ops.py` → `vm.ts`) — стек-машина с 12 операторами (ADD, SUB, MUL, DIV, NEG, ABS, SIGN, GATE, JUMP, DECAY, DELAY1, MAX3) — ≈100 строк TS, читает `best_meme_strategy.json`.

4. **Тренировка формулы (Python, оффлайн на Mac):**
   - В Python-инструменте `alphagpt/` адаптируем `data_loader.py` → читать наши же D1-snapshots (через REST или экспорт CSV).
   - Тренируем формулу на нашем формате данных, чтобы Python-обучение и TS-исполнение совпадали бит-в-бит.
   - Сохраняем `best_meme_strategy.json` → коммитим в `infra/`.

5. **Warm-up:** факторам с окном >20 точек (RSI-14, MA-20) нужно ≥20 минут истории. До этого — `fallback_weighted_sum()`. Также fallback применяется когда `STRATEGY_FORMULA_PATH` отсутствует.

6. **Fallback weighted-sum (когда формулы ещё нет):**
   ```
   score = sigmoid(
     0.30 × fomo                   // главный сигнал — бренду соответствует
   + 0.20 × pressure
   + 0.15 × momentum_rev
   + 0.10 × liq_score
   + 0.10 × vol_trend
   + 0.10 × rel_strength
   + 0.05 × dev
   )
   ```

> **Итог:** всё крутится на Cloudflare, $0 инфры, время инициализации первой релевантной выдачи — ~20 минут после первого запуска воркера (warm-up time-series).

### 2.4 Telegram Subscription Gate

**Flow:**
1. Пользователь жмёт `<script>` Telegram Login Widget на лендинге → вводит код → TG отдаёт payload `{id, first_name, last_name, username, photo_url, auth_date, hash}`.
2. Виджет шлёт payload на `/api/auth/telegram/callback`.
3. Edge-функция:
   - **Verify HMAC**: пересчитываем `data_check_string` с `BOT_TOKEN`, сравниваем с `hash`. Отклоняем если не совпадает или `auth_date` старше 24h.
   - **Check subscription**: Bot API `getChatMember?chat_id=<CHANNEL_ID>&user_id=<TG_ID>`. Принимаем `creator | administrator | member | restricted`. Отклоняем `left | kicked`.
   - **Issue session**: создаём JWT (15 мин TTL) + refresh-токен (7 дней) в KV; ставим HttpOnly Secure SameSite=Lax cookie.
   - Сохраняем в D1: `users(tg_id, username, photo_url, last_check_at, is_subscribed)`.
4. Каждый запрос к `/dashboard/*` и `/api/*` проходит middleware: валидирует JWT, если истёк — пробует refresh; если в KV нет recheck за 5 мин — фоном вызывает `getChatMember`.
5. **Cron Recheck Worker** каждые 15 мин:
   - Идёт по активным sessions в KV.
   - Пакетно дёргает `getChatMember` (с rate-limit: 30/sec).
   - Если status=`left`/`kicked` → инвалидирует сессию, ставит `is_subscribed=false` в D1.
   - На фронте при следующем pageview редирект на `/` с тостом «Подписка на канал больше не активна».
6. *(опц.)* Бот пушит уведомление пользователю «Вы вышли из канала, доступ закрыт».

**Хранилище:**
```sql
-- D1
CREATE TABLE users (
  tg_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  photo_url TEXT,
  is_subscribed INTEGER DEFAULT 1,
  last_check_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE TABLE sessions (
  jti TEXT PRIMARY KEY,
  tg_id BIGINT,
  expires_at INTEGER,
  refresh_token_hash TEXT,
  user_agent TEXT,
  ip_hash TEXT
);
CREATE TABLE tokens (
  address TEXT PRIMARY KEY,
  symbol TEXT, name TEXT,
  chain TEXT DEFAULT 'solana',
  pair_address TEXT,
  dex_id TEXT,
  image_url TEXT,
  socials_json TEXT,
  first_seen INTEGER,
  last_updated INTEGER
);
-- Time-series snapshots (наш собственный OHLCV-эрзац из 1-мин точек)
CREATE TABLE token_snapshots (
  address TEXT, time INTEGER,
  price_usd REAL, price_native REAL,
  market_cap REAL, fdv REAL,
  liquidity_usd REAL,
  volume_m5 REAL, volume_h1 REAL, volume_h6 REAL, volume_h24 REAL,
  price_change_m5 REAL, price_change_h1 REAL, price_change_h6 REAL, price_change_h24 REAL,
  buys_h1 INTEGER, sells_h1 INTEGER,
  PRIMARY KEY (address, time)
);
CREATE INDEX idx_snapshots_time ON token_snapshots(time);
-- Computed signals & factors (one row per refresh per token)
CREATE TABLE signals (
  address TEXT, time INTEGER,
  score REAL,                     -- 0..1, output of StackVM или fallback
  factors_json TEXT,              -- 12-вектор для радар-чарта
  is_buy INTEGER DEFAULT 0,       -- score >= BUY_THRESHOLD И раньше не было
  is_sell INTEGER DEFAULT 0,      -- score <= SELL_THRESHOLD И раньше было BUY
  PRIMARY KEY (address, time)
);
CREATE INDEX idx_signals_time ON signals(time);
CREATE INDEX idx_signals_score ON signals(score DESC);
-- Live signals feed (только переходы через threshold, для UI-ленты)
CREATE TABLE signal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT, time INTEGER,
  event_type TEXT,                -- 'buy_trigger' | 'sell_trigger' | 'fomo_spike'
  score REAL, prev_score REAL,
  metadata_json TEXT
);
CREATE INDEX idx_events_time ON signal_events(time DESC);
CREATE TABLE watchlist (
  tg_id INTEGER, address TEXT, added_at INTEGER,
  PRIMARY KEY (tg_id, address)
);
CREATE INDEX idx_watchlist_user ON watchlist(tg_id);
```

### 2.5 Performance, Cost & Quotas (расчёт по факту)

**DexScreener (бесплатный, без ключа, лимит 60 req/min/эндпоинт):**
- Один цикл refresh: 1× `/metas/trending/v1` + 2× `/tokens/v1` (батчи по 30) = **3 запроса**.
- Cron каждую 1 минуту → **3 req/min** на эндпоинт. Лимит — 60. Запас **20×**.
- Watchlist пользователей: lazy-load on demand (или пиггибэкаем на основной refresh, если адрес уже в Top-50).

**Cloudflare D1 (free tier):**
- Storage: 5 GB
- Reads: 5M rows/day
- Writes: 100k rows/day
- Расход writes: 50 токенов × 60 циклов/час × 24 ч = **72,000 writes/day** → влезаем (28% от лимита).
- Storage: ~120 байт/строка × 72k = ~8.5 MB/day; при retention 72h ≈ 25 MB ≪ 5 GB.

**Cloudflare Workers (free tier):**
- 100,000 requests/day, 10ms CPU/request.
- Engine cron: 1440 invocations/day (1 в минуту) — мизер.
- API requests от пользователей: при 10k MAU × 50 actions ≈ комфортно влезаем.
- **Ограничение Cron Triggers: минимум 1 минута** — это и есть наш floor.

**Cloudflare KV:**
- 100k reads/day, 1k writes/day на free tier.
- Sessions: на каждый authenticated request — 1 KV read. При 10k MAU × 30 requests/day = 300k reads/day → **может упереться**.
- **Mitigation:** короткий in-memory cache в Worker per-isolate (≈1 мин TTL) → reads уменьшатся ×30.

**Cloudflare Pages: unlimited (бесплатно).**

**Итог: при <10k MAU всё в free tier. Cold start API < 50ms (edge SQLite).**

---

## 3. Дизайн (Phantom × Robinhood)

### 3.1 Палитра
```
--bg-base      #0E0F12     (Phantom-deep)
--bg-card      #15161A     (chip)
--bg-elev      #1B1D22     (modal/elevated)
--border       #26282E
--text-primary #F4F4F5
--text-muted   #8A8D94
--accent       #AB9FF2     (Phantom violet)
--accent-2     #6E54CC     (deep violet)
--success      #1FC16B     (Robinhood green)
--danger       #FF4D4F
--warning      #F2C94C
--gradient-hero linear-gradient(135deg,#AB9FF2 0%,#6E54CC 50%,#221C4E 100%)
```

### 3.2 UI-принципы
- **Тёмная тема по умолчанию**, optional светлая (later).
- **Glass-morphism** на ключевых карточках: `backdrop-blur-xl bg-white/5 border-white/10`.
- **Числа крупные, лейблы мелкие** (Robinhood). Tabular-nums везде, где цифры.
- **Зелёный/красный** строго для % изменений.
- **Анимации**: 300ms ease-out, число-counter на загрузку, плавный transition между страницами через Framer Motion.
- **Радиусы**: 12px карточки, 16px модалки, 999px кнопки.
- **Шрифт**: Inter Variable / Geist; tabular-nums для цифр.
- **Иконки**: Lucide.

### 3.3 Ключевые экраны
- `/` — full-screen hero, размытый дашборд за стеклом, кнопка «Login with Telegram» с фиолетовым свечением. Subtitle: «AI catches the FOMO before the crowd does.»
- `/dashboard` — sidebar 240px (Overview, Scanner, Signals, Strategy, Watchlist, Settings) + main + правый sticky-aside с user-card.
- `/dashboard/scanner` — sticky-header таблица, virtualized rows, filter chips (`Score>0.7`, `Liq>$50k`, `FOMO>2σ`). Per-row: spark-line из последних 60 snapshots.
- `/dashboard/token/[a]` — двух-колоночная: слева price-chart (line+area, gradient fill — Robinhood-style) + score history; справа радар 12 факторов + last signal events + кнопка «★ Watch».
- `/dashboard/signals` — реверс-хронологическая лента событий, group by 5-мин bucket, иконки `↑ BUY` / `↓ SELL` / `🔥 FOMO`.
- `/dashboard/strategy` — JSON-виджет формулы, hover-glossary 12 факторов и 12 операторов, дата последней тренировки.
- `/dashboard/watchlist` — те же колонки что в Scanner, но только сохранённые токены; пустое состояние с CTA «Звезданите токен в Scanner».
- `/dashboard/settings` — TG-аватар + ник, текущий статус подписки, переключатель EN/RU, Logout.

### 3.4 i18n (EN + RU)
- **Библиотека**: `next-intl` — лучший вариант для App Router в 2026, server-component-friendly.
- Default: `en`. Cookie `LOCALE` — приоритет, иначе `Accept-Language`.
- Тоггл в `Settings` + быстрый переключатель в шапке.
- Все строки в `messages/{en,ru}.json`. Числа/даты через `Intl.NumberFormat` (USD, %, относительное время «2 мин назад» / «2 min ago»).
- Технические лейблы (тикеры, адреса, названия факторов как `FOMO`, `RSI`) — без перевода.

### 3.5 Watchlist (детали)
- Лимит: **50 токенов на пользователя** (защита от DoS на D1).
- API:
  - `POST /api/watchlist` `{address}` — добавить
  - `DELETE /api/watchlist/{address}` — удалить
  - `GET /api/watchlist` — список, JOIN с последними signals
- UI: ★-toggle на каждой строке Scanner и на Token-Detail.
- При добавлении токена не из Top-50 — Engine при следующем cron-цикле подтянет его в snapshot-loop (union из Top-50 ∪ адреса всех watchlist'ов; cap 80 общий).

### 3.6 Live Signals Feed (детали)
- В Engine Worker после расчёта score:
  ```
  if score >= BUY_THRESHOLD and prev_score < BUY_THRESHOLD:
      INSERT signal_events(buy_trigger)
  if score <= SELL_THRESHOLD and prev_score >= BUY_THRESHOLD:
      INSERT signal_events(sell_trigger)
  if fomo_factor > 2.5:  # zscore-style
      INSERT signal_events(fomo_spike) -- но throttled: 1 per token per 30 min
  ```
- UI:
  - `/dashboard/signals` страница — full feed.
  - Compact-виджет на Overview — последние 5 событий.
  - Live-обновление: poll `GET /api/signals/recent?since={lastId}` каждые 30 сек (SWR). WebSocket — на v2.

---

## 4. Структура репозитория

```
fomometer-xyz/                        # GitHub приватный репо
├── apps/
│   └── web/                          # Next.js → CF Pages
│       ├── app/
│       │   ├── (public)/page.tsx     # landing
│       │   ├── api/
│       │   │   ├── auth/telegram/route.ts
│       │   │   └── signals/route.ts
│       │   ├── dashboard/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx          # overview
│       │   │   ├── scanner/page.tsx
│       │   │   ├── token/[address]/page.tsx
│       │   │   ├── signals/page.tsx
│       │   │   ├── strategy/page.tsx
│       │   │   └── watchlist/page.tsx
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/                      # auth, db, hooks
│       ├── public/
│       ├── tailwind.config.ts
│       └── next.config.mjs
├── workers/
│   ├── engine/                       # cron — refresh tokens & signals
│   │   ├── src/index.ts
│   │   ├── src/birdeye.ts
│   │   ├── src/factors.ts            # TS-port AlphaGPT factors
│   │   ├── src/ops.ts                # TS-port operators
│   │   ├── src/vm.ts                 # TS-port StackVM
│   │   └── wrangler.toml
│   └── recheck/                      # cron — re-verify TG subs
│       ├── src/index.ts
│       └── wrangler.toml
├── packages/
│   └── shared/                       # типы D1, helpers
├── alphagpt/                         # ОРИГИНАЛЬНЫЙ Python (offline-only)
│   └── ...                           # тренировка формулы, не деплоится
├── infra/
│   ├── d1-schema.sql
│   └── cloudflare-setup.md
├── .github/workflows/
│   ├── deploy-pages.yml
│   └── deploy-workers.yml
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 5. Этапы (≈10–14 рабочих дней)

| # | Этап | Дни | Выход |
|---|---|---|---|
| 1 | **Setup**: pnpm-монорепо, Next.js 14, Tailwind, shadcn/ui, next-intl (EN+RU), Phantom-палитра, базовый layout | 0.5 | пустой Next.js деплоится на CF Pages, превью на `*.pages.dev` |
| 2 | **CF infra**: D1 база + миграции, KV, secrets, привязка домена `fomometer.xyz` | 0.5 | `wrangler d1 migrations apply` зелёный, домен резолвится |
| 3 | **TG Auth**: Login Widget на лендинге, `/api/auth/telegram` (HMAC + getChatMember), JWT-сессия, middleware-gate | 1.5 | можно зайти/выйти; не-подписчик блочится |
| 4 | **Engine port**: TS-факторы (12 шт) + StackVM + DexScreener client; unit-тесты на 1 сэмпле | 1.5 | `pnpm test` зелёный, mock-snapshot → ожидаемый score |
| 5 | **Engine cron worker**: 1-мин refresh Top-50 (+ watchlist union), запись snapshots → D1, расчёт signals + signal_events | 1 | через 20 мин после деплоя в D1 живые данные с warm-up |
| 6 | **Recheck cron worker**: re-verify TG subs каждые 15 мин, опц. DM-уведомление | 0.5 | отписавшийся теряет доступ ≤15 мин |
| 7 | **Dashboard UI — Overview & Scanner**: таблица сигналов, фильтры, sort, sparkline | 1.5 | реальные данные крутятся в UI |
| 8 | **Dashboard UI — Token Detail**: price/score chart, радар 12 факторов, signal events | 1 | страница токена готова |
| 9 | **Dashboard UI — Signals feed, Strategy, Watchlist, Settings** + i18n-перевод всех экранов | 1.5 | все экраны кликабельны на EN и RU |
| 10 | **Лендинг + дисклеймер**: hero, blur-preview, CTA, footer, sticky-баннер «Not financial advice», SEO/OG-теги | 0.5 | публичная страница готова |
| 11 | **Polish**: Framer-анимации, loading-states, error-boundaries, mobile-responsive, иконка/favicon | 1 | прохождение по чек-листу |
| 12 | **Offline training** (вы): тренируете формулу AlphaGPT локально на наших snapshot-данных → коммитите `infra/best_meme_strategy.json` | 0.5 | реальный AlphaGPT-скор вместо fallback |
| 13 | **GH Actions**: автодеплой Pages + Workers; preview deployments на PR; миграции D1 в pipeline | 0.5 | `git push main` → продакшн |
| 14 | **Финал**: снос старого репо, push нового, smoke-тесты на проде, ручная проверка auth-сценариев | 0.5 | live на fomometer.xyz |

---

## 6. Безопасность & Приватность

- `BOT_TOKEN` — только в CF Workers Secret, никогда в коде/фронте.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, домен `.fomometer.xyz`.
- HMAC-проверка TG payload с защитой от replay (24h `auth_date` window).
- Rate-limit `/api/auth/telegram` через CF KV (5 попыток / 5 мин / IP).
- Логи: в D1 храним хэш IP (sha256), не сам IP.
- CSP: `default-src 'self'; script-src 'self' https://telegram.org`.
- Никакого user-input → eval. Никакого приёма приватных ключей. Никаких финансовых рекомендаций — баннер на каждой странице дашборда.

---

## 7. Что Claude делает сам, что от пользователя

### 7.1 Делаю сам (через wrangler + CF API token)
- Создаю D1 базу, KV namespaces, Pages-проект, Cron Triggers.
- Привязываю кастомный домен `fomometer.xyz` к Pages-проекту (DNS уже настроен).
- Публикую секреты в CF Workers через `wrangler secret put`.
- Настраиваю GitHub Actions: при push в `main` → deploy Pages + Workers.
- В самом конце: чищу старый приватный репо и пушу новую кодбазу.

### 7.2 Нужно от пользователя (один раз, заполнить `.env`)
1. **Telegram:**
   - `TELEGRAM_BOT_TOKEN` (от @BotFather).
   - `TELEGRAM_BOT_USERNAME` (без @).
   - `TELEGRAM_REQUIRED_CHATS` — `@username` канала или числовой `chat_id`.
   - В @BotFather → `/setdomain` → `fomometer.xyz` (для Login Widget).
   - **Бот должен быть админом** канала/чата (иначе `getChatMember` не работает на каналах).
2. **Cloudflare:**
   - `CLOUDFLARE_ACCOUNT_ID`.
   - `CLOUDFLARE_API_TOKEN` (template «Edit Cloudflare Workers» — даёт права на Pages+Workers+D1+KV).
3. **GitHub:**
   - URL приватного репо.
   - Personal Access Token для GH Actions (на пуш в репо), либо deploy key.
4. **Логотип**: SVG/PNG в `apps/web/public/logo/` — пользователь добавит позже, до этого — wordmark «FOMOMETER» в Inter ExtraBold.

---

## 8. Out of Scope (на потом, не для v1)

- Push-уведомления через TG-бота (новый сигнал → DM пользователю).
- Light theme.
- Альтернативные сети (Ethereum, Base).
- Public API.
- Премиум-тиры.
- Бэктестер на фронте.
- Real-time WebSocket (для v1 хватит SWR/poll каждые 30 сек).
