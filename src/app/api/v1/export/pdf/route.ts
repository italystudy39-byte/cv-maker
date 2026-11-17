import path from "node:path";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { ResumePdfDocument } from "@/components/templates/pdfDocument";
import { registerPdfFonts } from "@/lib/fonts";
import { pdfFileName } from "@/lib/format";
import { ResumeDocumentSchema } from "@/lib/schema";
import { rateLimit } from "@/lib/server/ai";
import type { ResumeDocument } from "@/lib/types";

const Body = z.object({ resume: ResumeDocumentSchema, format: z.enum(["desktop", "mobile"]) });

let fontsReady = false;

/** POST /api/v1/export/pdf — vector PDF with a text layer and clickable links (spec 4.3). */
export async function POST(request: Request) {
  const rl = rateLimit(request, "export-pdf", 30);
  if (!rl.ok) return Response.json({ error: "Слишком много запросов" }, { status: 429 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Некорректные данные резюме" }, { status: 400 });
  const { resume, format } = parsed.data;

  if (!fontsReady) {
    registerPdfFonts(Font, path.join(process.cwd(), "public", "fonts") + path.sep);
    fontsReady = true;
  }
  try {
    const el = createElement(ResumePdfDocument, { doc: resume as ResumeDocument, variant: format === "desktop" ? "a4" : "mobile" }) as unknown as ReactElement<DocumentProps>;
    const buf = await renderToBuffer(el);
    const name = pdfFileName(resume as ResumeDocument, format);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Не удалось сгенерировать PDF" }, { status: 500 });
  }
}
