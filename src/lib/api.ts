"use client";
import { pdfFileName } from "./format";
import type { ResumeDocument, ToneOfVoice } from "./types";

export interface FullResult {
  summary: string;
  keyStrengths: { title: string; description: string }[];
  enhancedExperience: { experienceId: string; bullets: string[] }[];
  categorizedSkills: { hard: string[]; soft: string[] };
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Нет связи с сервером");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`);
  return json as T;
}

/** The model never needs the photo. */
const withoutPhoto = (d: ResumeDocument): ResumeDocument => ({ ...d, personal: { ...d.personal, photoUrl: undefined } });

export const generateFull = (doc: ResumeDocument, condense = false, signal?: AbortSignal) =>
  post<FullResult>(`/api/v1/ai/generate-full${condense ? "?mode=condense" : ""}`, withoutPhoto(doc), signal);

export const enhanceExperience = (b: { targetTitle: string; company: string; position: string; rawNotes: string; tone: ToneOfVoice; currentBullets?: string[] }) =>
  post<{ bullets: string[] }>("/api/v1/ai/enhance-experience", b);

/** Server-side export (spec 4.3); falls back to rendering in the browser if the API is unreachable. */
export async function exportPdf(doc: ResumeDocument, format: "desktop" | "mobile"): Promise<{ blob: Blob; name: string; via: "server" | "browser" }> {
  const name = pdfFileName(doc, format);
  try {
    const res = await fetch("/api/v1/export/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: doc, format }) });
    if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) return { blob: await res.blob(), name, via: "server" };
  } catch {}
  const { renderPdfInBrowser } = await import("@/components/templates/pdf");
  return { blob: await renderPdfInBrowser(doc, format === "desktop" ? "a4" : "mobile"), name, via: "browser" };
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
