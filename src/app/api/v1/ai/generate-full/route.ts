import { z } from "zod";
import { ResumeDocumentSchema } from "@/lib/schema";
import { errorResponse, rateLimit, structuredCall, systemPrompt } from "@/lib/server/ai";

export const maxDuration = 30;

/** Spec 3.3: resume_ai_enhancement response schema. */
const ResumeAiEnhancement = z.object({
  summary: z.string(),
  keyStrengths: z.array(z.object({ title: z.string(), description: z.string() })),
  enhancedExperience: z.array(z.object({ experienceId: z.string(), bullets: z.array(z.string()) })),
  categorizedSkills: z.object({ hard: z.array(z.string()), soft: z.array(z.string()) }),
});

/**
 * POST /api/v1/ai/generate-full — full resume build (spec 4.1).
 * Body: ResumeDocument. Optional `?mode=condense` shortens existing texts by ~15% (spec 8.1).
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, "generate-full", 5);
  if (!rl.ok) return Response.json({ error: `Слишком много запросов. Попробуйте через ${rl.retry} с` }, { status: 429, headers: { "Retry-After": String(rl.retry) } });

  const parsed = ResumeDocumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Некорректные данные резюме", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const doc = parsed.data;
  const condense = new URL(request.url).searchParams.get("mode") === "condense";

  // Photo and direct contacts are never sent to the model.
  const input = {
    targetTitle: doc.personal.targetTitle,
    location: doc.personal.location,
    experience: doc.experience
      .filter((e) => e.company || e.position || e.rawNotes)
      .map((e) => ({
        experienceId: e.id,
        company: e.company,
        position: e.position,
        period: `${e.startDate || "?"} — ${e.isCurrent ? "по настоящее время" : e.endDate || "?"}`,
        rawNotes: e.rawNotes,
        ...(condense || e.aiBullets.length ? { currentBullets: e.aiBullets } : null),
      })),
    education: doc.education.filter((e) => e.institution),
    skills: [...doc.skills.hard, ...doc.skills.soft],
    ...(condense ? { currentSummary: doc.aiGenerated.summary, currentKeyStrengths: doc.aiGenerated.keyStrengths } : null),
  };

  const task = condense
    ? "Резюме немного не помещается на одну страницу A4. Сократи все тексты (summary, keyStrengths, буллиты) примерно на 15%, сохранив факты, цифры и смысл. Количество буллитов на место работы можно уменьшить, но не меньше 2."
    : "Собери резюме по данным анкеты.";

  try {
    const out = await structuredCall(ResumeAiEnhancement, systemPrompt(doc.meta.tone, doc.personal.targetTitle), `${task}\n\nДанные (JSON):\n${JSON.stringify(input, null, 2)}`, 12000);
    return Response.json({ ...out, keyStrengths: out.keyStrengths.slice(0, 5) });
  } catch (e) {
    return errorResponse(e);
  }
}
