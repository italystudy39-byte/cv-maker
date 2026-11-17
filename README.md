# ИИ-конструктор резюме (MVP)

Веб-приложение по PRD: пошаговая анкета с автосохранением, ИИ-редактор на Claude, 3 шаблона × 5 палитр, живое превью «ПК / телефон» и экспорт в два PDF (A4 и мобильный) с текстовым слоем и кликабельными ссылками.

## Запуск

```bash
npm install
cp .env.example .env.local   # вставьте ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Без ключа всё работает, кроме ИИ-кнопок (они покажут понятную ошибку).

## Как устроено

- `src/components/Builder.tsx` — визард из 6 шагов, вызовы ИИ, кнопки экспорта.
- `src/lib/useDraft.ts` — черновик в `localStorage` (автосохранение с задержкой 400 мс).
- `src/app/api/ai/route.ts` — серверный роут к Claude (`claude-opus-5-5`, effort `low` ради скорости, structured outputs через Zod, server-side fallbacks при отказе). Фото и контакты (кроме города) в модель не отправляются.
- `src/components/templates/ResumeDoc.tsx` — шаблоны написаны **один раз** поверх примитивов (`View/Text/Link/Image/Icon/Page`) и рендерятся дважды: в HTML для превью (`prims.tsx`) и в `@react-pdf/renderer` для PDF (`pdfPrims.tsx`). Поэтому превью и PDF совпадают.
- `src/lib/palettes.ts` — палитры и автоматический контроль контраста WCAG (акцент ≥ 4.5:1 на белом, цвет текста на сайдбаре выбирается автоматически).
- Шрифты Roboto, PT Serif, Montserrat (с кириллицей) лежат в `public/fonts` и встраиваются в PDF.

Мобильный PDF — одна страница шириной 360 pt и переменной высоты (без разрывов), шрифт 14–16 pt.

## Проверка PDF без браузера

```bash
npx esbuild scripts/render-pdf.tsx --bundle --platform=node --format=esm --packages=external --jsx=automatic --outfile=scripts/.render.mjs
node scripts/.render.mjs draft.json out.pdf a4 modern   # draft.json — содержимое localStorage["ai-resume-draft-v1"]
```

## Что не входит в MVP

Регистрация и облачное хранение, аналитика KPI, лимиты запросов к ИИ (перед публичным запуском стоит добавить rate limiting на `/api/ai`).
