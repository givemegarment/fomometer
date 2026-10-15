# Journal — BACKEND (workers, D1, Cloudflare)

## ТЕКУЩЕЕ СОСТОЯНИЕ
- Engine `a3f43473` и labeler `e6dfc918` в проде с 2026-10-14. Запуски движка заканчиваются `ok` (CPU 15–57 ms, 9 из 9 запусков
  на бесплатном лимите; Workers Paid владелец не подключает). Скор пишется для всех токенов каждую минуту.
- `fomometer-recheck` удалён (Cloudflare и репозиторий). Секреты Pages: только `PUBLIC_APP_URL`.
- Открыто: Telegram webhook бота (токен в `.env` отозван, 401); KV `SESSIONS` и `CACHE` в аккаунте не используются.
- Веса из `last_run.weights` выведены на Strategy (JOURNAL-DESIGN, деплой сайта `43a8cc2e`).

---

## 2026-10-14 [DEBUG] Проход 3: деплой и уборка (команда владельца «1 делай, 2–4 удали, 5 нет»)
- Деплой: engine `a3f43473-1d7a-49d8-9d25-21020c68a8e1`, labeler `e6dfc918-5e74-4f47-9be0-d78f84a24bf2`.
- `wrangler tail`: 3 из 3 запусков `ok`, CPU 57/41/30 ms (до: `exceededCpu` в каждом). D1: `signals` и
  `token_snapshots` с одним и тем же `MAX(time)`, 26 токенов со скором за 5 мин, `last_run.weights` записан.
  `/api/status`: `snapshot_at == scored_at`.
- Workers Paid: владелец отказался. 57 ms выше номинальных 50: первый запуск после деплоя (холодный, с пересчётом
  порога FOMO). Второй tail 5 мин: 6 из 6 `ok`, CPU 28/48/15/20/1/31 ms; один запуск «empty universe»
  (DexScreener вернул пустой список, движок штатно пропустил минуту). Итого 9 из 9 `ok`, ни одного `exceededCpu`.
- Воркер `fomometer-recheck` удалён (`wrangler delete`), крон `*/15` снят. Код сохранён в scratchpad сессии, из
  репозитория удалены `workers/recheck`, скрипт `deploy:recheck`, строка README, абзац в `infra/cloudflare-setup.md`;
  `pnpm install` обновил lockfile; `pnpm typecheck` по workspace 0.
- Секреты Pages `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TG_WEBHOOK_SECRET` удалены; код сайта их не читает (grep 0).
- Webhook НЕ снят: `getWebhookInfo` с токеном из `.env` отвечает 401 Unauthorized (токен перевыпущен или
  отозван). Значение секрета из Pages прочитать нельзя. Нужен действующий токен из @BotFather или удаление бота.

## 2026-10-14 [DEBUG] Проход 3: CPU движка, логотипы, labeler
- Диагноз: `wrangler tail` → `outcome: exceededCpu, cpuTime: 50` в 3 из 3 запусков. Снимки (шаг 3) успевают,
  сигналы (шаг 5) нет. Главный потребитель CPU: адаптивный порог FOMO тянул `factors_json` всех сигналов
  за 6 ч (до ~9000 строк / 3.3 MB при здоровой работе) и делал `JSON.parse` каждой в воркере. Плюс ~80
  последовательных D1-запросов за запуск. D1: 17.9 M rows read за 24 ч.
- `workers/engine/src/index.ts`:
  - окна снимков всех токенов одним запросом (`json_each`), вместо 25;
  - предыдущие скоры одним запросом (коррелированный подзапрос по индексу), вместо 25;
  - FOMO-троттлинг одним запросом; все записи (signals + события) одним `DB.batch`;
  - порог FOMO в SQL (`json_type`/`json_extract`, `ORDER BY … OFFSET`), кэш в `engine_state.fomo_th` на 30 мин.
    Единственное поведенческое отличие: порог обновляется раз в 30 мин, а не каждую минуту;
  - `image_url = COALESCE(excluded, tokens.image_url)`: пустой `info` от DexScreener больше не затирает логотип;
  - убран запрос к серверному `watchlist` (избранное теперь в браузере, таблица пуста);
  - `last_run.weights`: базовые веса скора (для страницы Strategy).
- `workers/engine/wrangler.toml`: убрана неиспользуемая привязка KV `CACHE`.
- `workers/labeler/src/index.ts`: цена горизонта (15m/1h/4h) только из снимка не позже горизонта + 10 мин;
  раньше могла браться цена через часы, если токен выпадал из списка. Действует для новых меток.
- `package.json` `deploy:workers` и `.github/workflows/deploy-workers.yml` без recheck.
- Проверено: tsc engine и labeler 0. Локальный прогон engine (`wrangler dev --test-scheduled`, локальная D1 из
  выгрузки прода за 2–6 ч, внешний DexScreener живой): 26 токенов, строки signals записаны, `last_run` и
  `fomo_th` записаны, ошибок нет, 157 ms wall. Порог FOMO через SQL = старому JS-методу на тех же данных
  до последнего знака (2.409071805429202). CPU локально не измерить: подтвердится только `wrangler tail` после деплоя.
- Найдено, не исправлено (решение по стратегии, не баг кода): FOMO-спайк сравнивает СЫРОЙ `fomo` с 95-м
  перцентилем СОХРАНЁННОГО (нормированного z-score) `fomo` — две разные шкалы.
- Открыто: деплой engine + labeler; удаление воркера recheck; снятие Telegram webhook; секреты Pages
  (`JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TG_WEBHOOK_SECRET`); показ `last_run.weights` на странице Strategy (DESIGN).
