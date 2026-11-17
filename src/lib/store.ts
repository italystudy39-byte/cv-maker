"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { emptyResume, uid, type ResumeDocument, type ThemePaletteId } from "./types";

interface State {
  doc: ResumeDocument;
  step: number;
  /** Replace the document through an updater; stamps meta.updatedAt. */
  update: (fn: (d: ResumeDocument) => ResumeDocument) => void;
  setStep: (n: number) => void;
  reset: () => void;
}

const STORAGE_KEY = "resume-document";
const LEGACY_KEY = "ai-resume-draft-v1";

const THEME_FROM_LEGACY: Record<string, ThemePaletteId> = {
  navy: "deep_navy",
  emerald: "emerald_green",
  graphite: "graphite_dark",
  burgundy: "burgundy_wine",
  slate: "slate_blue",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/** One-time migration of drafts saved by the first MVP build. */
function migrateLegacy(): { doc: ResumeDocument; step: number } | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as any;
    const r = d.resume ?? {};
    const doc: ResumeDocument = {
      meta: {
        id: uid(),
        updatedAt: new Date().toISOString(),
        template: d.settings?.template ?? "modern",
        theme: THEME_FROM_LEGACY[d.settings?.palette] ?? "deep_navy",
        tone: d.settings?.tone ?? "modern",
      },
      personal: {
        photoUrl: r.photo ?? undefined,
        photoRatio: r.photoRatio ?? "1:1",
        fullName: r.fullName ?? "",
        targetTitle: r.title ?? "",
        birthDate: r.birthDate || undefined,
        showAge: r.showAge ?? true,
        location: r.contacts?.city || undefined,
      },
      contacts: {
        phone: r.contacts?.phone || undefined,
        email: r.contacts?.email || undefined,
        telegram: r.contacts?.telegram || undefined,
        linkedin: r.contacts?.linkedin || undefined,
        portfolioUrl: r.contacts?.portfolio || undefined,
      },
      aiGenerated: { summary: r.summary ?? "", keyStrengths: r.strengths ?? [] },
      experience: (r.jobs ?? []).map((j: any) => ({
        id: j.id,
        company: j.company,
        position: j.position,
        startDate: j.start,
        endDate: j.end,
        isCurrent: j.current,
        rawNotes: j.notes,
        aiBullets: j.bullets ?? [],
      })),
      education: [
        ...(r.education ?? []).map((e: any) => ({
          id: e.id,
          institution: e.institution,
          specialty: e.faculty,
          degree: e.degree,
          graduationYear: parseInt(e.year, 10) || null,
          isCourse: false,
        })),
        ...(r.courses ?? []).map((c: any) => ({
          id: c.id,
          institution: c.name,
          specialty: c.issuer,
          degree: "",
          graduationYear: parseInt(c.year, 10) || null,
          isCourse: true,
        })),
      ],
      skills: {
        hard: (r.skills ?? []).filter((s: any) => s.kind !== "soft").map((s: any) => s.name),
        soft: (r.skills ?? []).filter((s: any) => s.kind === "soft").map((s: any) => s.name),
      },
    };
    localStorage.removeItem(LEGACY_KEY);
    return { doc, step: d.step ?? 0 };
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const useResume = create<State>()(
  persist(
    (set) => ({
      doc: emptyResume(),
      step: 0,
      update: (fn) =>
        set((s) => {
          const d = fn(s.doc);
          return { doc: { ...d, meta: { ...d.meta, updatedAt: new Date().toISOString() } } };
        }),
      setStep: (step) => set({ step }),
      reset: () => {
        const doc = emptyResume();
        doc.meta.id = uid();
        set({ doc, step: 0 });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ doc: s.doc, step: s.step }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        if (!p?.doc) return current;
        const base = emptyResume();
        return {
          ...current,
          step: p.step ?? 0,
          doc: {
            ...base,
            ...p.doc,
            meta: { ...base.meta, ...p.doc.meta },
            personal: { ...base.personal, ...p.doc.personal },
            aiGenerated: { ...base.aiGenerated, ...p.doc.aiGenerated },
            skills: { ...base.skills, ...p.doc.skills },
          },
        };
      },
    },
  ),
);

/** Load the draft from localStorage once on the client. Returns whether a draft existed. */
export async function hydrateResume(): Promise<boolean> {
  let had = false;
  try {
    had = !!localStorage.getItem(STORAGE_KEY);
  } catch {}
  await useResume.persist.rehydrate();
  if (!had) {
    const legacy = migrateLegacy();
    if (legacy) {
      useResume.setState(legacy);
      return true;
    }
  }
  return had;
}
