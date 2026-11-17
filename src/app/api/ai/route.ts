import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const ToneSchema = z.enum(["corporate", "modern", "creative"]);

const JobIn = z.object({
  id: z.string(),
  company: z.string().max(200),
  position: z.string().max(200),
  start: z.string().max(20),
  end: z.string().max(20),
  current: z.boolean(),
  notes: z.string().max(4000),
  bullets: z.array(z.string().max(600)).max(20),
});

const ResumeIn = z.object({
  fullName: z.string().max(100),
  title: z.string().max(200),
  birthDate: z.string().max(20).optional(),
  contacts: z.object({ city: z.string().max(100) }).partial().optional(),
  jobs: z.array(JobIn).max(15),
  education: z
    .array(z.object({ institution: z.string(), faculty: z.string(), degree: z.string(), year: z.string() }).partial())
    .max(10),
  courses: z.array(z.object({ name: z.string(), issuer: z.string(), year: z.string() }).partial()).max(20),
  skills: z.array(z.object({ name: z.string().max(80) })).max(60),
});

const RequestIn = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all"), tone: ToneSchema, resume: ResumeIn }),
  z.object({ scope: z.literal("job"), tone: ToneSchema, resume: ResumeIn, jobId: z.string() }),
]);

const FullOut = z.object({
  summary: z.string().describe("Блок «О себе»: 3–4 предложения"),
  strengths: z
    .array(z.object({ title: z.string().describe("Короткое название, 2–5 слов"), description: z.string().describe("Одно предложение-пояснение") }))
    .describe("3–5 ключевых сильных сторон"),
  jobs: z.array(z.object({ id: z.string(), bullets: z.array(z.string()) })).describe("Переписанный опыт, по id каждого места работы"),
  skills: z.array(z.object({ name: z.string(), kind: z.enum(["hard", "soft"]) })).describe("Все навыки пользователя с классификацией"),
});

const JobOut = z.object({ bullets: z.array(z.string()) });

const TONES: Record<z.infer<typeof ToneSchema>, string> = {
  corporate: "Строгий, корпоративный: сдержанная деловая лексика, без эмоциональных эпитетов, акцент на ответственности, масштабе и результатах.",
  modern: "Современный, динамичный: энергичные формулировки, короткие предложения, акцент на результатах, скорости и влиянии на бизнес.",
  creative: "Креативный: живой, образный, но профессиональный язык; можно чуть больше индивидуальности и личного голоса.",
};

const SYSTEM = `Ты — опытный карьерный консультант и редактор резюме. Ты превращаешь сырые заметки кандидата в сильное, честное резюме.

Правила:
- Пиши на языке, на котором заполнены данные (по умолчанию — русский).
- Главный ориентир — желаемая должность: расставляй акценты под неё.
- Буллиты опыта: 3–6 на место работы, каждый начинается с глагола действия в прошедшем времени (разработал, внедрил, оптимизировал, увеличил, запустил…), фокус на результатах, а не на процессах. Одна строка — одна мысль, до ~25 слов, без точки в конце.
- Используй только факты из заметок. Цифры и метрики — только если они есть во входных данных; не выдумывай проценты, суммы, названия, сроки. Если результата нет в заметках, сформулируй ценность качественно.
- Если заметки к месту работы пустые, напиши 2–3 сдержанных буллита по типичным задачам этой должности, без цифр.
- Блок «О себе»: 3–4 предложения, позиционирует кандидата как профильного специалиста под желаемую должность. Без клише вроде «стрессоустойчивый, коммуникабельный».
- Сильные стороны: 3–5 пунктов на пересечении опыта кандидата и требований к желаемой должности, у каждого короткий заголовок и одно предложение-пояснение со ссылкой на опыт.
- Навыки: верни все навыки кандидата без изменения написания и классифицируй каждый как hard или soft.
- Не добавляй пол, возраст и личные данные в тексты.`;

function compact(resume: z.infer<typeof ResumeIn>) {
  return {
    desiredPosition: resume.title,
    name: resume.fullName,
    city: resume.contacts?.city || undefined,
    experience: resume.jobs.map((j) => ({
      id: j.id,
      company: j.company,
      position: j.position,
      period: `${j.start || "?"} — ${j.current ? "по настоящее время" : j.end || "?"}`,
      notes: j.notes,
      currentBullets: j.bullets.length ? j.bullets : undefined,
    })),
    education: resume.education.filter((e) => e.institution),
    courses: resume.courses.filter((c) => c.name),
    skills: resume.skills.map((s) => s.name),
  };
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "На сервере не задан ANTHROPIC_API_KEY. Добавьте ключ в .env.local и перезапустите приложение." }, { status: 503 });
  }

  let input: z.infer<typeof RequestIn>;
  try {
    input = RequestIn.parse(await request.json());
  } catch {
    return Response.json({ error: "Некорректные данные запроса" }, { status: 400 });
  }

  const client = new Anthropic();
  const data = compact(input.resume);
  const tone = TONES[input.tone];

  try {
    if (input.scope === "all") {
      const msg = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(FullOut) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Тональность текста: ${tone}\n\nСобери резюме по данным анкеты (JSON):\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      });
      if (msg.stop_reason === "refusal") return Response.json({ error: "ИИ отказался обрабатывать эти данные. Проверьте текст анкеты." }, { status: 422 });
      if (!msg.parsed_output) return Response.json({ error: "Не удалось разобрать ответ ИИ, попробуйте ещё раз" }, { status: 502 });
      return Response.json(msg.parsed_output);
    }

    const job = data.experience.find((j) => j.id === input.jobId);
    if (!job) return Response.json({ error: "Место работы не найдено" }, { status: 404 });
    const msg = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(JobOut) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Тональность текста: ${tone}\nЖелаемая должность: ${data.desiredPosition}\n\n` +
            `Перепиши и усили опыт на одном месте работы. Если есть currentBullets — улучши их, сохранив факты.\n${JSON.stringify(job, null, 2)}`,
        },
      ],
    });
    if (msg.stop_reason === "refusal") return Response.json({ error: "ИИ отказался обрабатывать эти данные." }, { status: 422 });
    if (!msg.parsed_output) return Response.json({ error: "Не удалось разобрать ответ ИИ, попробуйте ещё раз" }, { status: 502 });
    return Response.json(msg.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Слишком много запросов к ИИ, подождите минуту" }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "Неверный ключ ANTHROPIC_API_KEY" }, { status: 500 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: `Ошибка ИИ-сервиса (${e.status ?? "сеть"})` }, { status: 502 });
    console.error(e);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
