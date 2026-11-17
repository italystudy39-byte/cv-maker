# Конструктор резюме (MVP)

Веб-приложение по PRD, SPEC и DESIGN.md: пошаговая анкета из 6 шагов с автосохранением, обработка текста на Google Gemini, 3 шаблона × 5 палитр, живое превью «A4 / Телефон» и экспорт в два PDF (A4 и мобильный) с текстовым слоем и кликабельными ссылками. Светлая и тёмная тема интерфейса.

## Запуск

```bash
npm install
cp .env.example .env.local   # вставьте GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Без ключа всё работает, кроме сборки текста: при сбое резюме собирается из ваших заметок как есть (SPEC 8.2).

Переменные окружения:

| Переменная | По умолчанию | Зачем |
|---|---|---|
| `GEMINI_API_KEY` | — | Ключ Gemini API (подойдёт и `GOOGLE_API_KEY`) |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Модель. `gemini-3.5-flash` Google объявил устаревшей и перенаправляет на 3.6 |
| `AI_TIMEOUT_MS` | `10000` | Таймаут запроса к модели (SPEC 4.1) |

## API (SPEC 4)

- `POST /api/v1/ai/generate-full` — весь документ `ResumeDocument` → `summary`, `keyStrengths`, `enhancedExperience`, `categorizedSkills`. `?mode=condense` сокращает текст на ~15 %. Лимит 5 запросов в минуту с IP.
- `POST /api/v1/ai/enhance-experience` — одно место работы → `bullets`. Лимит 20 в минуту.
- `POST /api/v1/export/pdf` — `{ resume, format: "desktop" | "mobile" }` → PDF-файл `Resume_Имя_Фамилия_Desktop.pdf`. Если сервер недоступен, клиент собирает PDF в браузере тем же кодом.

Фото и контакты в модель не отправляются. Ответ модели проверяется схемой Zod (structured output через `responseJsonSchema`), сгенерированный текст проходит через типограф (ёлочки, неразрывные пробелы, тире).

## Как устроено

- `src/components/Builder.tsx` — визард, степпер, карточки опыта, индикатор сборки, меню «Скачать», мобильная нижняя панель.
- `src/components/ui.tsx` — кнопки, сегментный переключатель, поля, тосты, модалка, переключатель темы (DESIGN 6).
- `src/app/globals.css` — дизайн-токены DESIGN 3 (светлая и тёмная тема); стандартная палитра Tailwind отключена, доступны только токены.
- `src/lib/store.ts` — документ в `localStorage` (Zustand persist, ключ `resume-document`), перенос черновиков первой версии.
- `src/lib/server/ai.ts` — вызов Gemini (`@google/genai`), системный промпт SPEC 3.2, обработка ошибок, rate limit.
- `src/components/templates/ResumeDoc.tsx` — шаблоны написаны **один раз** поверх примитивов (`View/Text/Link/Image/Icon/Page`, `base.ts`) и рендерятся дважды: в HTML для превью (`prims.tsx`) и в `@react-pdf/renderer` для PDF (`pdfPrims.tsx`). Поэтому превью и PDF совпадают.
- `src/lib/palettes.ts` — приглушённые палитры DESIGN 9.3 и автоматический контроль контраста WCAG.
- Шрифты шаблонов Roboto, PT Serif, Montserrat (с кириллицей) лежат в `public/fonts` и встраиваются в PDF. Шрифты интерфейса Golos Text и Source Serif 4 подключены через `next/font`.

## Отличия от SPEC

| SPEC | Сделано | Почему |
|---|---|---|
| OpenAI | Google Gemini (`gemini-3.6-flash`, structured output) | Решение заказчика; 3.5 Flash устарела, запросы к ней Google переводит на 3.6 |
| Playwright для PDF | `@react-pdf/renderer` на сервере и в браузере (вариант B из SPEC) | Без headless-браузера на сервере, быстрее (0,2–0,7 с), один код шаблонов для превью и PDF |
| Шрифты Merriweather/Inter, Plus Jakarta Sans/Manrope | PT Serif, Roboto, Montserrat | DESIGN 9.2: у Plus Jakarta Sans нет кириллицы, Inter запрещён как штамп |
| Цвета палитр SPEC 5.1 | Приглушённые базы DESIGN 9.3 | DESIGN переопределяет SPEC |
| Тон «Креативный» | «Свободный» | DESIGN 2 |
| react-hook-form | Контролируемые поля + Zustand | Меньше зависимостей, формы простые |
| Rate limit в Redis | В памяти процесса | Для MVP; перед публичным запуском нужен общий стор |

## Проверка PDF без браузера

```bash
npx esbuild scripts/render-pdf.tsx --bundle --platform=node --format=esm --packages=external --jsx=automatic --outfile=scripts/.render.mjs
node scripts/.render.mjs doc.json out.pdf a4 modern   # doc.json — ResumeDocument, например из localStorage["resume-document"].state.doc
```

## Что не входит в MVP

Регистрация и облачное хранение, аналитика KPI, общий rate limit для нескольких серверов.
