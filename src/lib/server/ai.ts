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
/** Tried in order when the previous model is overloaded (503/429) or too slow, within the same time budget. Empty string disables them. */
export const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
/**
 * Total time budget per request. SPEC 4.1 asks for 10 s, but Gemini Flash under load often needs more,
 * so the default is 25 s: each model except the last gets up to half of what is left, the last one the rest.
 * The UI offers «Продолжить без обработки» after 12 s anyway.
 */
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 25_000;
const MODEL_SHARE = 0.5;

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
- Не упоминай пол, возраст и личные данные в текстах.
- Грамматический род глаголов бери из заметок кандидата (например, «запустила» → «Запустила») и держи его одинаковым во всех текстах: в summary, сильных сторонах и буллитах. Если род по заметкам не понятен, используй мужской род.
- Буллиты пиши без точки в конце.`;
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
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<
    string,
    unknown
  >;
  void _drop;
  return rest;
}

let client: GoogleGenAI | null = null;

/** One structured-output call; returns the validated object or throws AiError with a user-facing message. */
export async function structuredCall<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  maxTokens = 8000,
): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new AiError("На сервере не задан GEMINI_API_KEY", 503);
  // Our own timeout and fallback replace the SDK's default 5 retries with backoff.
  client ??= new GoogleGenAI({
    apiKey,
    httpOptions: { retryOptions: { attempts: 1 } },
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  const models = [MODEL, ...FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i);
  try {
    for (let i = 0; ; i++) {
      try {
        // Every model but the last gets part of the remaining budget; the last one gets what is left.
        const last = i === models.length - 1;
        const signal = last ? ctrl.signal : AbortSignal.any([ctrl.signal, AbortSignal.timeout(Math.max(1000, (TIMEOUT_MS - (Date.now() - started)) * MODEL_SHARE))]);
        return await callModel(models[i], schema, system, user, maxTokens, signal);
      } catch (e) {
        const slow = !ctrl.signal.aborted && (e as Error)?.name !== "SyntaxError" && !(e instanceof ApiError) && !(e instanceof AiError);
        const busy = slow || (e instanceof ApiError && (e.status === 503 || e.status === 429 || e.status === 500));
        if (!busy || i === models.length - 1 || ctrl.signal.aborted) throw e;
        console.warn(`Gemini ${models[i]} ${e instanceof ApiError ? `returned ${e.status}` : "was too slow"}, trying ${models[i + 1]}`);
      }
    }
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (ctrl.signal.aborted)
      throw new AiError("Сервис не ответил за отведённое время", 504);
    if (e instanceof SyntaxError)
      throw new AiError("Не удалось разобрать ответ сервиса", 502);
    if (e instanceof ApiError) {
      if (e.status === 429 || e.status === 503)
        throw new AiError("Сервис перегружен, попробуйте через минуту", 503);
      if (e.status === 400 && /api key/i.test(e.message))
        throw new AiError("Неверный ключ GEMINI_API_KEY", 500);
      if (e.status === 401 || e.status === 403)
        throw new AiError("Неверный ключ GEMINI_API_KEY", 500);
      throw new AiError(`Ошибка сервиса обработки текста (${e.status})`, 502);
    }
    console.error(e);
    throw new AiError("Не удалось связаться с сервисом обработки текста", 502);
  } finally {
    clearTimeout(timer);
  }
}

async function callModel<T extends z.ZodType>(
  model: string,
  schema: T,
  system: string,
  user: string,
  maxTokens: number,
  signal: AbortSignal,
): Promise<z.infer<T>> {
  {
    const res = await client!.models.generateContent({
      model,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        // Gemini 3.x docs: keep sampling parameters at their defaults; low thinking keeps the 10 s budget.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema(schema),
        abortSignal: signal,
      },
    });
    if (res.promptFeedback?.blockReason)
      throw new AiError("Сервис отказался обрабатывать эти данные", 422);
    const text = res.text;
    if (!text) throw new AiError("Сервис вернул пустой ответ", 502);
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success)
      throw new AiError("Не удалось разобрать ответ сервиса", 502);
    return parsed.data;
  }
}

/* In-memory sliding-window rate limiter (per server instance). Spec 4.1: 5 requests/minute per IP. */
const hits = new Map<string, number[]>();
export function rateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs = 60_000,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
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
  const err =
    e instanceof AiError ? e : new AiError("Внутренняя ошибка сервера", 500);
  return Response.json({ error: err.message }, { status: err.status });
}
