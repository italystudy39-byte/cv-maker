"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultSettings, emptyResume, type Draft, type Resume, type Settings } from "./types";

const KEY = "ai-resume-draft-v1";

function load(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (d?.version !== 1) return null;
    // Merge with defaults so new fields never come back undefined.
    return {
      version: 1,
      step: d.step ?? 0,
      resume: { ...emptyResume(), ...d.resume, contacts: { ...emptyResume().contacts, ...d.resume?.contacts } },
      settings: { ...defaultSettings(), ...d.settings },
    };
  } catch {
    return null;
  }
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useDraft() {
  const [draft, setDraft] = useState<Draft>(() => ({ version: 1, step: 0, resume: emptyResume(), settings: defaultSettings() }));
  const [hydrated, setHydrated] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const d = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    if (d) setDraft(d);
    setHasSaved(!!d);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(draft));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, hydrated]);

  const setResume = useCallback((fn: (r: Resume) => Resume) => setDraft((d) => ({ ...d, resume: fn(d.resume) })), []);
  const setSettings = useCallback((patch: Partial<Settings>) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } })), []);
  const setStep = useCallback((step: number) => setDraft((d) => ({ ...d, step })), []);
  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setDraft({ version: 1, step: 0, resume: emptyResume(), settings: defaultSettings() });
  }, []);

  return { draft, hydrated, hasSaved, saveState, setResume, setSettings, setStep, reset };
}
