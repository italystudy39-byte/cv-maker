import { z } from "zod";
import { ToneSchema } from "@/lib/schema";
import { errorResponse, rateLimit, structuredCall, systemPrompt } from "@/lib/server/ai";

export const maxDuration = 30;

const Body = z.object({
  targetTitle: z.string().max(200),
  company: z.string().max(200),
  position: z.string().max(200),
  rawNotes: z.string().max(5000),
  tone: ToneSchema,
  /** Extension: current (possibly edited) bullets to improve instead of rewriting from scratch. */
  currentBullets: z.array(z.string().max(800)).max(20).optional(),
});

const Out = z.object({ bullets: z.array(z.string()) });

/** POST /api/v1/ai/enhance-experience — improve one job (spec 4.2). */
export async function POST(request: Request) {
  const rl = rateLimit(request, "enhance-experience", 20);
  if (!rl.ok) return Response.json({ error: `Слишком много запросов. Попробуйте через ${rl.retry} с` }, { status: 429, headers: { "Retry-After": String(rl.retry) } });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 400 });
  const b = parsed.data;
  try {
    const out = await structuredCall(
      Out,
      systemPrompt(b.tone, b.targetTitle),
      `Перепиши и усили опыт на одном месте работы: верни только буллиты (3-6).${b.currentBullets?.length ? " Есть текущие буллиты — улучши их, сохранив факты." : ""}\n\n${JSON.stringify(b, null, 2)}`,
    );
    return Response.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}
