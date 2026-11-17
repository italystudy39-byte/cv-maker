import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { ToneOfVoice } from "../types";

/**
 * Spec names OpenAI; this build uses Google Gemini with the same structured-output contract.
 * `gemini-3.5-flash` is deprecated by Google and its requests are routed to `gemini-3.6-flash`,
 * so the replacement is the default. Override with GEMINI_MODEL.
 */
export const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
/** Spec 4.1: 10 s timeout. Configurable in case a larger model needs longer for a full resume. */
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 10_000;

export const TONE_TEXT: Record<ToneOfVoice, string> = {
  corporate: "corporate — строгий деловой",
  modern: "modern — динамичный и ориентированный на метрики",
  creative: "creative — смелый и выразительный",
};

/** Spec 3.2 system prompt, plus guards against invented facts and the "no experience" edge case (spec 8.3). */
export function systemPrompt(tone: ToneOfVoice, targetTitle: string) {
  return `Ты — профессиональный IT- и бизнес-рекрутер, карьерный консультант и редактор резюме.
Твоя задача — проанализировать сырые данные кандидата и упаковать их в продающее, структурированное резюме, ориентированное на желаемую должность (targetTitle).

ПРАВИЛА:
1. Язык ответа: Русский.
2. Тональность (Tone of Voice): ${TONE_TEXT[tone]}.
3. В блоке summary напиши 3-4 емких предложения, позиционирующих кандидата как готового специалиста на должность ${targetTitle || "из анкеты"}.
4. Выдели от 3 до 5 ключевых сильных сторон (keyStrengths) кандидата на основе пересечения его опыта и целевой должности.
5. Для каждого места работы преобразуй сырые заметки (rawNotes) в 3-6 профессиональных буллитов (aiBullets). Начинай буллиты с сильных глаголов совершенного вида в прошедшем времени (Разработал, Внедрил, Сократил, Увеличил, Оптимизировал). Не выдумывай несуществующих фактов, но структурируй имеющиеся с фокусом на бизнес-результат.
6. Классифицируй переданный список навыков на hard и soft skills.

ДОПОЛНИТЕЛЬНО:
- Цифры, проценты, суммы и названия используй только если они есть во входных данных.
- Если заметки к месту работы пустые, напиши 2-3 сдержанных буллита по типичным задачам этой должности, без цифр.
- Если опыта работы нет (студент или свитчер), сделай упор на образование, курсы, учебные проекты и навыки.
- Навыки возвращай в исходном написании, каждый ровно в одной категории.
- Не упоминай пол, возраст и личные данные в текстах.`;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** JSON Schema for Gemini's responseJsonSchema (the "$schema" key is dropped). */
function jsonSchema(schema: z.ZodType) {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _drop;
  return rest;
}

let client: GoogleGenAI | null = null;

/** One structured-output call; returns the validated object or throws AiError with a user-facing message. */
export async function structuredCall<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens = 8000): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new AiError("На сервере не задан GEMINI_API_KEY", 503);
  client ??= new GoogleGenAI({ apiKey });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        // Gemini 3.x docs: keep sampling parameters at their defaults; low thinking keeps the 10 s budget.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema(schema),
        abortSignal: ctrl.signal,
      },
    });
    if (res.promptFeedback?.blockReason) throw new AiError("Сервис отказался обрабатывать эти данные", 422);
    const text = res.text;
    if (!text) throw new AiError("Сервис вернул пустой ответ", 502);
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AiError("Не удалось разобрать ответ сервиса", 502);
    return parsed.data;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (ctrl.signal.aborted) throw new AiError("Сервис не ответил за отведённое время", 504);
    if (e instanceof SyntaxError) throw new AiError("Не удалось разобрать ответ сервиса", 502);
    if (e instanceof ApiError) {
      if (e.status === 429) throw new AiError("Сервис перегружен, попробуйте через минуту", 429);
      if (e.status === 400 && /api key/i.test(e.message)) throw new AiError("Неверный ключ GEMINI_API_KEY", 500);
      if (e.status === 401 || e.status === 403) throw new AiError("Неверный ключ GEMINI_API_KEY", 500);
      throw new AiError(`Ошибка сервиса обработки текста (${e.status})`, 502);
    }
    console.error(e);
    throw new AiError("Не удалось связаться с сервисом обработки текста", 502);
  } finally {
    clearTimeout(timer);
  }
}

/* In-memory sliding-window rate limiter (per server instance). Spec 4.1: 5 requests/minute per IP. */
const hits = new Map<string, number[]>();
export function rateLimit(request: Request, bucket: string, limit: number, windowMs = 60_000) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    const retry = Math.ceil((windowMs - (now - list[0])) / 1000);
    return { ok: false as const, retry };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) hits.clear();
  return { ok: true as const };
}

export function errorResponse(e: unknown) {
  const err = e instanceof AiError ? e : new AiError("Внутренняя ошибка сервера", 500);
  return Response.json({ error: err.message }, { status: err.status });
}
