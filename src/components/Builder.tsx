"use client";
import { Check, ChevronDown, ChevronLeft, Download, Eye, FileText, GripVertical, Minus, Plus, Smartphone, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { download, enhanceExperience, exportPdf, generateFull, type FullResult } from "@/lib/api";
import { ageFrom, fmtPeriod, jobBullets, maskPhone, notesToBullets, validate, type Issue } from "@/lib/format";
import { PALETTES } from "@/lib/palettes";
import { useResume } from "@/lib/store";
import { emptyEducation, emptyExperience, type EducationItem, type Experience, type ResumeDocument, type TemplateId, type ToneOfVoice } from "@/lib/types";
import { typograph } from "@/lib/typograph";
import { PhotoField } from "./PhotoField";
import { Preview, type Zoom } from "./Preview";
import { SkillsField } from "./SkillsField";
import { SortableList } from "./Sortable";
import type { Editor, Variant } from "./templates/ResumeDoc";
import { Button, Field, fmtTime, Logo, Segmented, ThemeToggle, useToast } from "./ui";

const STEPS = ["Основное", "Контакты", "Опыт работы", "Образование", "Навыки", "Сборка и экспорт"];
const STEP_SHORT = ["Основное", "Контакты", "Опыт", "Образование", "Навыки", "Сборка и экспорт"];

const TEMPLATES: { id: TemplateId; name: string }[] = [
  { id: "classic", name: "Классика" },
  { id: "modern", name: "Модерн" },
  { id: "minimal", name: "Минимал" },
];

// DESIGN 2: «Строгий», «Современный», «Свободный».
const TONES: { id: ToneOfVoice; name: string }[] = [
  { id: "corporate", name: "Строгий" },
  { id: "modern", name: "Современный" },
  { id: "creative", name: "Свободный" },
];

const BUILD_LINES = ["Читаем ваш опыт", "Формулируем пункты", "Выбираем сильные стороны", "Почти готово"];
const SLOW_MS = 12000;

type ExportKind = "desktop" | "mobile" | "zip";
const EXPORTS: { id: ExportKind; title: string; desc: string }[] = [
  { id: "desktop", title: "A4 для печати и сайтов", desc: "PDF, 1–2 страницы, для HH, LinkedIn и почты" },
  { id: "mobile", title: "Для телефона", desc: "PDF одной длинной страницей, для Telegram и WhatsApp" },
  { id: "zip", title: "Оба файла", desc: "ZIP-архив" },
];

const ic = { size: 16, strokeWidth: 1.5, "aria-hidden": true } as const;

/** Apply the build result, passing generated text through the typographer. */
function applyFull(d: ResumeDocument, out: FullResult): ResumeDocument {
  const known = new Map([...d.skills.hard, ...d.skills.soft].map((s) => [s.toLowerCase(), s]));
  const pick = (list: string[]) => list.map((s) => known.get(s.toLowerCase())).filter((s): s is string => !!s);
  const hard = pick(out.categorizedSkills.hard);
  const soft = pick(out.categorizedSkills.soft).filter((s) => !hard.includes(s));
  // Skills the model dropped stay where they were.
  const missing = [...known.values()].filter((s) => !hard.includes(s) && !soft.includes(s));
  return {
    ...d,
    aiGenerated: {
      summary: typograph(out.summary),
      keyStrengths: out.keyStrengths.slice(0, 5).map((s) => ({ title: typograph(s.title), description: typograph(s.description) })),
    },
    experience: d.experience.map((e) => {
      const g = out.enhancedExperience.find((x) => x.experienceId === e.id);
      return g && g.bullets.length ? { ...e, aiBullets: g.bullets.map(typograph) } : e;
    }),
    skills: {
      hard: [...hard, ...missing.filter((s) => d.skills.hard.includes(s))],
      soft: [...soft, ...missing.filter((s) => d.skills.soft.includes(s))],
    },
  };
}

/** SPEC 8.2: when processing fails, raw notes become bullets so the user can still download. */
function fallbackToNotes(d: ResumeDocument): ResumeDocument {
  return { ...d, experience: d.experience.map((e) => (e.aiBullets.length ? e : { ...e, aiBullets: notesToBullets(e.rawNotes) })) };
}

const fieldId = (f: string) => `f-${f}`;

export function Builder({ onHome }: { onHome: () => void }) {
  const doc = useResume((s) => s.doc);
  const step = useResume((s) => s.step);
  const update = useResume((s) => s.update);
  const setStepRaw = useResume((s) => s.setStep);
  const { personal: p, contacts: c, meta } = doc;
  const toast = useToast();

  const [dir, setDir] = useState<"next" | "prev">("next");
  const [visited, setVisited] = useState(step);
  const [touchedSteps, setTouchedSteps] = useState<Set<number>>(() => new Set());
  const [blurred, setBlurred] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<Variant>("a4");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fitScale, setFitScale] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openJob, setOpenJob] = useState<string | null>(doc.experience[0]?.id ?? null);
  const [a4Pages, setA4Pages] = useState(1);
  const [flash, setFlash] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  // Build state (DESIGN 6.13)
  const [busy, setBusy] = useState<null | "all" | "condense">(null);
  const [jobBusy, setJobBusy] = useState<string | null>(null);
  const [line, setLine] = useState(0);
  const [slow, setSlow] = useState(false);
  const [buildFailed, setBuildFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const formScroll = useRef<HTMLDivElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  const issues = useMemo(() => validate(doc), [doc]);
  const err = (field: string) => {
    const i = issues.find((x) => x.field === field);
    if (!i) return undefined;
    return touchedSteps.has(i.step) || (!i.required && blurred.has(field)) ? i.text : undefined;
  };
  const blur = (f: string) => () => setBlurred((s) => (s.has(f) ? s : new Set(s).add(f)));

  const patchPersonal = (x: Partial<ResumeDocument["personal"]>) => update((d) => ({ ...d, personal: { ...d.personal, ...x } }));
  const patchContacts = (x: Partial<ResumeDocument["contacts"]>) => update((d) => ({ ...d, contacts: { ...d.contacts, ...x } }));
  const patchMeta = (x: Partial<ResumeDocument["meta"]>) => update((d) => ({ ...d, meta: { ...d.meta, ...x } }));
  const patchJob = (id: string, x: Partial<Experience>) => update((d) => ({ ...d, experience: d.experience.map((e) => (e.id === id ? { ...e, ...x } : e)) }));
  const patchEdu = (id: string, x: Partial<EducationItem>) => update((d) => ({ ...d, education: d.education.map((e) => (e.id === id ? { ...e, ...x } : e)) }));

  const edit: Editor = useMemo(
    () => ({
      summary: (v) => update((d) => ({ ...d, aiGenerated: { ...d.aiGenerated, summary: v } })),
      strength: (i, key, v) =>
        update((d) => ({ ...d, aiGenerated: { ...d.aiGenerated, keyStrengths: d.aiGenerated.keyStrengths.map((s, j) => (j === i ? { ...s, [key]: v } : s)) } })),
      bullet: (jobId, i, v) =>
        update((d) => ({
          ...d,
          experience: d.experience.map((e) => {
            if (e.id !== jobId) return e;
            const list = [...jobBullets(e)];
            list[i] = v;
            return { ...e, aiBullets: list.filter((x) => x.trim()) };
          }),
        })),
    }),
    [update],
  );

  /* ------------------------------------------------------------ navigation */

  const goTo = (n: number) => {
    if (n === step) return;
    setDir(n > step ? "next" : "prev");
    formScroll.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    setStepRaw(n);
    setVisited((v) => Math.max(v, n));
  };

  /** Focus and scroll to the first field with an error (DESIGN 4.4, 10). */
  const focusIssue = (i: Issue) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId(i.field));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  };

  const next = () => {
    const blocking = issues.find((i) => i.step === step && i.required);
    setTouchedSteps((s) => new Set(s).add(step));
    if (blocking) return focusIssue(blocking);
    goTo(step + 1);
  };

  /* ----------------------------------------------------------------- build */

  useEffect(() => {
    if (busy !== "all") return;
    const t = setInterval(() => setLine((l) => Math.min(l + 1, BUILD_LINES.length - 1)), 2500);
    const s = setTimeout(() => setSlow(true), SLOW_MS);
    return () => (clearInterval(t), clearTimeout(s));
  }, [busy]);

  const buildAll = async (condense = false) => {
    const required = issues.filter((i) => i.required);
    if (required.length && !condense) {
      setTouchedSteps(new Set(required.map((i) => i.step)));
      if (required[0].step !== step) goTo(required[0].step);
      setSheetOpen(false);
      toast({ text: "Заполните обязательные поля: " + required.map((i) => STEP_SHORT[i.step]).filter((v, i, a) => a.indexOf(v) === i).join(", ").toLowerCase() + "." });
      focusIssue(required[0]);
      return;
    }
    if (step !== 5 && !condense) goTo(5);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBuildFailed(false);
    setLine(0);
    setSlow(false);
    setBusy(condense ? "condense" : "all");
    try {
      const out = await generateFull(useResume.getState().doc, condense, ctrl.signal);
      update((d) => applyFull(d, out));
      setFlash((f) => f + 1);
      toast({ text: condense ? "Текст сокращён. Проверьте, что ничего важного не пропало." : "Текст собран. Проверьте факты и поправьте, если нужно." });
      previewScroll.current?.scrollTo({ top: 0 });
      if (!condense) requestAnimationFrame(() => summaryRef.current?.focus());
    } catch (e) {
      update(fallbackToNotes);
      if ((e as Error).name !== "AbortError") setBuildFailed(true);
    } finally {
      abortRef.current = null;
      setBusy(null);
    }
  };

  const improveJob = async (j: Experience) => {
    setJobBusy(j.id);
    try {
      const out = await enhanceExperience({ targetTitle: p.targetTitle, company: j.company, position: j.position, rawNotes: j.rawNotes, tone: meta.tone, currentBullets: j.aiBullets.length ? j.aiBullets : undefined });
      patchJob(j.id, { aiBullets: out.bullets.map(typograph) });
    } catch {
      if (!j.aiBullets.length) patchJob(j.id, { aiBullets: notesToBullets(j.rawNotes) });
      toast({ text: "Не удалось переписать текст. Ваши заметки подставлены как есть, их можно поправить вручную.", action: { label: "Повторить", run: () => improveJob(j) } });
    } finally {
      setJobBusy(null);
    }
  };

  /* ---------------------------------------------------------------- export */

  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const doExport = async (kind: ExportKind) => {
    setExporting(kind);
    const current = useResume.getState().doc;
    try {
      if (kind === "zip") {
        const [a, m] = await Promise.all([exportPdf(current, "desktop"), exportPdf(current, "mobile")]);
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        zip.file(a.name, a.blob);
        zip.file(m.name, m.blob);
        download(await zip.generateAsync({ type: "blob" }), a.name.replace(/_Desktop\.pdf$/, ".zip"));
      } else {
        const r = await exportPdf(current, kind);
        download(r.blob, r.name);
      }
      toast({ text: "Файл сохранён." });
      return true;
    } catch (e) {
      console.error(e);
      toast({ text: "Не удалось создать PDF. Попробуйте ещё раз.", action: { label: "Повторить", run: () => void doExport(kind) } });
      return false;
    } finally {
      setExporting(null);
    }
  };

  /* -------------------------------------------------------------- overflow */

  const onMeasure = useCallback((n: number) => setA4Pages(n), []);
  const onFitScale = useCallback((s: number) => setFitScale(s), []);
  const tail = a4Pages - 1;
  const overflowLines = Math.max(1, Math.ceil((tail * 841.89) / ((meta.compact ? 9.5 : 10.5) * 1.4)));
  const showOverflow = view === "a4" && tail > 0.01 && tail <= 0.2 && dismissedAt !== meta.updatedAt && !busy;

  const removeJob = (j: Experience) => {
    const before = useResume.getState().doc.experience;
    const idx = before.findIndex((x) => x.id === j.id);
    update((d) => ({ ...d, experience: d.experience.filter((y) => y.id !== j.id) }));
    toast({
      text: "Место работы удалено.",
      ms: 6000,
      action: {
        label: "Вернуть",
        run: () =>
          update((d) => {
            const list = [...d.experience];
            list.splice(Math.min(idx, list.length), 0, j);
            return { ...d, experience: list };
          }),
      },
    });
  };

  const addJob = () => {
    const j = emptyExperience();
    update((d) => ({ ...d, experience: [...d.experience, j] }));
    setOpenJob(j.id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`job-${j.id}-company`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  };

  /* ----------------------------------------------------------------- steps */

  const year = (v: string) => {
    const n = parseInt(v.replace(/\D/g, "").slice(0, 4), 10);
    return Number.isFinite(n) ? n : null;
  };

  const eduCard = (e: EducationItem, handle: Record<string, unknown>) => (
    <div className="anim-rise mb-3 rounded-lg border border-line bg-raised p-5">
      <div className="mb-4 flex items-center gap-2">
        <span {...handle} className="-ml-2 grid size-8 cursor-grab touch-none place-items-center rounded-sm text-faint hover:text-fg active:cursor-grabbing" title="Перетащите, чтобы поменять порядок" aria-label="Перетащить">
          <GripVertical {...ic} />
        </span>
        <span className="t-label flex-1">{e.institution.trim() || (e.isCourse ? "Новый курс" : "Новое учебное заведение")}</span>
        <button
          type="button"
          className="btn btn-danger btn-icon btn-s"
          title="Удалить"
          aria-label="Удалить"
          onClick={() => update((d) => ({ ...d, education: d.education.filter((y) => y.id !== e.id) }))}
        >
          <Trash2 {...ic} />
        </button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={e.isCourse ? "Название курса" : "Учебное заведение"}>
          {(f) => <input {...f} className="input" placeholder={e.isCourse ? "Аналитик данных" : "НИУ ВШЭ"} value={e.institution} onChange={(ev) => patchEdu(e.id, { institution: ev.target.value })} />}
        </Field>
        <Field label={e.isCourse ? "Организация" : "Факультет, специальность"}>
          {(f) => <input {...f} className="input" placeholder={e.isCourse ? "Яндекс Практикум" : "Экономика"} value={e.specialty} onChange={(ev) => patchEdu(e.id, { specialty: ev.target.value })} />}
        </Field>
        {!e.isCourse ? (
          <Field label="Степень">
            {(f) => <input {...f} className="input" placeholder="Бакалавр" value={e.degree} onChange={(ev) => patchEdu(e.id, { degree: ev.target.value })} />}
          </Field>
        ) : null}
        <Field label="Год окончания">
          {(f) => <input {...f} className="input tnum" inputMode="numeric" maxLength={4} placeholder="2020" value={e.graduationYear ?? ""} onChange={(ev) => patchEdu(e.id, { graduationYear: year(ev.target.value) })} />}
        </Field>
      </div>
    </div>
  );

  const jobCard = (j: Experience, handle: Record<string, unknown>) => {
    const open = openJob === j.id;
    const head = [j.company.trim(), j.position.trim()].filter(Boolean).join(" — ") || "Новое место работы";
    const bullets = j.aiBullets;
    const setBullets = (list: string[]) => patchJob(j.id, { aiBullets: list });
    return (
      <div className="anim-rise group mb-3 rounded-lg border border-line bg-raised">
        <div className="flex items-center gap-1 px-3 py-2.5">
          <span
            {...handle}
            className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-faint opacity-100 hover:text-fg active:cursor-grabbing lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            title="Перетащите, чтобы поменять порядок"
            aria-label="Перетащить"
          >
            <GripVertical {...ic} />
          </span>
          <button type="button" className="flex min-w-0 flex-1 flex-col items-start rounded-sm px-1 py-0.5 text-left" aria-expanded={open} onClick={() => setOpenJob(open ? null : j.id)}>
            <span className="t-label w-full truncate">{head}</span>
            {fmtPeriod(j) ? <span className="t-small tnum text-muted">{fmtPeriod(j)}</span> : null}
          </button>
          <ChevronDown {...ic} className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          <button type="button" className="btn btn-danger btn-icon btn-s ml-1" title="Удалить" aria-label={`Удалить «${head}»`} onClick={() => removeJob(j)}>
            <Trash2 {...ic} />
          </button>
        </div>
        <div className="reveal" data-open={open}>
          <div>
            <div className="space-y-5 border-t border-line px-5 pt-5 pb-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Компания" htmlFor={`job-${j.id}-company`}>
                  {(f) => <input {...f} className="input" value={j.company} onChange={(e) => patchJob(j.id, { company: e.target.value })} placeholder="Ozon" />}
                </Field>
                <Field label="Должность">
                  {(f) => <input {...f} className="input" value={j.position} onChange={(e) => patchJob(j.id, { position: e.target.value })} placeholder="Менеджер по продажам" />}
                </Field>
                <Field label="Начало">
                  {(f) => <input {...f} type="month" className="input tnum" value={j.startDate} onChange={(e) => patchJob(j.id, { startDate: e.target.value })} />}
                </Field>
                <Field label="Окончание">
                  {(f) => <input {...f} type="month" className="input tnum" disabled={j.isCurrent} value={j.isCurrent ? "" : (j.endDate ?? "")} onChange={(e) => patchJob(j.id, { endDate: e.target.value })} />}
                </Field>
              </div>
              <label className="-mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--ui-accent)]" checked={j.isCurrent} onChange={(e) => patchJob(j.id, { isCurrent: e.target.checked })} />
                По настоящее время
              </label>
              <Field label="Заметки своими словами" hint="Пишите своими словами: что делали и чего добились, с цифрами, если помните. Мы перепишем это в деловые пункты.">
                {(f) => (
                  <div className="relative">
                    <textarea
                      {...f}
                      className="input pb-6"
                      maxLength={3000}
                      value={j.rawNotes}
                      onChange={(e) => patchJob(j.id, { rawNotes: e.target.value })}
                      placeholder={"вёл отчётность по продажам\nсделал дашборд в Power BI\nсократил подготовку отчёта с 2 дней до 2 часов"}
                    />
                    <span className="tnum pointer-events-none absolute right-3 bottom-1.5 text-[12px] text-faint">{j.rawNotes.length}</span>
                  </div>
                )}
              </Field>
              <div>
                <div className="label">Пункты для резюме</div>
                {bullets.length ? (
                  <ul className="space-y-2">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-[9px] text-muted" aria-hidden>
                          —
                        </span>
                        <textarea
                          aria-label={`Пункт ${i + 1}`}
                          className="input min-h-10 flex-1"
                          style={{ minHeight: 40 }}
                          rows={1}
                          value={b}
                          onChange={(e) => setBullets(bullets.map((x, k) => (k === i ? e.target.value.replace(/\n/g, " ") : x)))}
                        />
                        <button type="button" className="btn btn-ghost btn-icon btn-s mt-1" title="Удалить пункт" aria-label={`Удалить пункт ${i + 1}`} onClick={() => setBullets(bullets.filter((_, k) => k !== i))}>
                          <X {...ic} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">Пока пунктов нет. В резюме попадут строки из заметок, или нажмите «Переписать пункты».</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="s"
                    busy={jobBusy === j.id}
                    busyText="Переписываем…"
                    disabled={!!busy || (!!jobBusy && jobBusy !== j.id) || !(j.rawNotes.trim() || j.position.trim())}
                    onClick={() => improveJob(j)}
                  >
                    Переписать пункты
                  </Button>
                  <button type="button" className="btn btn-ghost btn-s" onClick={() => setBullets([...(bullets.length ? bullets : notesToBullets(j.rawNotes)), ""])}>
                    <Plus {...ic} /> Добавить пункт
                  </button>
                  {bullets.length ? (
                    <button type="button" className="btn btn-ghost btn-s" onClick={() => setBullets([])}>
                      Вернуть заметки
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasBuilt = !!(doc.aiGenerated.summary || doc.aiGenerated.keyStrengths.length);

  const steps: ReactNode[] = [
    <div key="0" className="space-y-5">
      <PhotoField photo={p.photoUrl ?? null} ratio={p.photoRatio ?? "1:1"} onChange={(photo, photoRatio) => patchPersonal({ photoUrl: photo ?? undefined, photoRatio })} />
      <Field label="Имя и фамилия" required error={err("fullName")} htmlFor={fieldId("fullName")}>
        {(f) => <input {...f} className="input" maxLength={100} value={p.fullName} onChange={(e) => patchPersonal({ fullName: e.target.value })} placeholder="Анна Смирнова" autoComplete="name" />}
      </Field>
      <Field label="Желаемая должность" required hint="Под эту роль подбираются формулировки и сильные стороны" error={err("targetTitle")} htmlFor={fieldId("targetTitle")}>
        {(f) => <input {...f} className="input" maxLength={120} value={p.targetTitle} onChange={(e) => patchPersonal({ targetTitle: e.target.value })} placeholder="Продуктовый аналитик" />}
      </Field>
      <DobField value={p.birthDate} onChange={(birthDate) => patchPersonal({ birthDate })} showAge={p.showAge} onShowAge={(showAge) => patchPersonal({ showAge })} />
      <Field label="Город">
        {(f) => <input {...f} className="input" value={p.location ?? ""} onChange={(e) => patchPersonal({ location: e.target.value })} placeholder="Москва" autoComplete="address-level2" />}
      </Field>
    </div>,

    <div key="1" className="space-y-5">
      <p className="hint">Нужен хотя бы один способ связи. В PDF телефон, почта и ссылки будут кликабельными.</p>
      {err("contacts") ? (
        <p id={fieldId("contacts")} tabIndex={-1} className="text-[13px] text-danger">
          {err("contacts")}
        </p>
      ) : null}
      <Field label="Телефон" error={err("phone")} htmlFor={fieldId("phone")}>
        {(f) => (
          <input {...f} className="input tnum" inputMode="tel" autoComplete="tel" value={c.phone ?? ""} onBlur={blur("phone")} onChange={(e) => patchContacts({ phone: maskPhone(e.target.value) })} placeholder="+7 ___ ___-__-__" />
        )}
      </Field>
      <Field label="Email" error={err("email")} htmlFor={fieldId("email")}>
        {(f) => <input {...f} className="input" type="email" autoComplete="email" value={c.email ?? ""} onBlur={blur("email")} onChange={(e) => patchContacts({ email: e.target.value })} placeholder="name@site.ru" />}
      </Field>
      <Field label="Telegram">
        {(f) => <input {...f} className="input" value={c.telegram ?? ""} onChange={(e) => patchContacts({ telegram: e.target.value })} placeholder="@username" />}
      </Field>
      <Field label="LinkedIn" error={err("linkedin")} htmlFor={fieldId("linkedin")}>
        {(f) => <input {...f} className="input" inputMode="url" value={c.linkedin ?? ""} onBlur={blur("linkedin")} onChange={(e) => patchContacts({ linkedin: e.target.value })} placeholder="linkedin.com/in/username" />}
      </Field>
      <Field label="Портфолио или сайт" error={err("portfolioUrl")} htmlFor={fieldId("portfolioUrl")}>
        {(f) => <input {...f} className="input" inputMode="url" value={c.portfolioUrl ?? ""} onBlur={blur("portfolioUrl")} onChange={(e) => patchContacts({ portfolioUrl: e.target.value })} placeholder="behance.net/username" />}
      </Field>
    </div>,

    <div key="2">
      {doc.experience.length ? (
        <>
          <SortableList items={doc.experience} getId={(j) => j.id} onReorder={(experience) => update((d) => ({ ...d, experience }))} render={(j, handle) => jobCard(j, handle)} />
          <button type="button" className="btn btn-secondary mt-1" onClick={addJob}>
            <Plus {...ic} /> Добавить место работы
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-line-strong p-5">
          <p className="max-w-[64ch]">Опыт работы можно пропустить. Тогда в резюме акцент будет на образовании, проектах и навыках.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={addJob}>
              <Plus {...ic} /> Добавить место работы
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => goTo(3)}>
              Пропустить шаг
            </button>
          </div>
        </div>
      )}
    </div>,

    <div key="3">
      <SortableList
        items={doc.education.filter((e) => !e.isCourse)}
        getId={(e) => e.id}
        onReorder={(items) => update((d) => ({ ...d, education: [...items, ...d.education.filter((e) => e.isCourse)] }))}
        render={(e, handle) => eduCard(e, handle)}
      />
      <button type="button" className="btn btn-secondary" onClick={() => update((d) => ({ ...d, education: [...d.education, emptyEducation(false)] }))}>
        <Plus {...ic} /> Добавить учебное заведение
      </button>
      <h2 className="t-h2 mt-8 mb-4">Курсы и сертификаты</h2>
      <SortableList
        items={doc.education.filter((e) => e.isCourse)}
        getId={(e) => e.id}
        onReorder={(items) => update((d) => ({ ...d, education: [...d.education.filter((e) => !e.isCourse), ...items] }))}
        render={(e, handle) => eduCard(e, handle)}
      />
      <button type="button" className="btn btn-secondary" onClick={() => update((d) => ({ ...d, education: [...d.education, emptyEducation(true)] }))}>
        <Plus {...ic} /> Добавить курс
      </button>
    </div>,

    <div key="4">
      <SkillsField skills={doc.skills} onChange={(skills) => update((d) => ({ ...d, skills }))} grouped={hasBuilt} error={err("skills")} inputId={fieldId("skills")} />
      {err("skills") ? (
        <p className="mt-1.5 text-[13px] text-danger" role="alert">
          {err("skills")}
        </p>
      ) : null}
    </div>,

    <div key="5" className="space-y-8">
      <fieldset disabled={!!busy} className="space-y-8 disabled:opacity-100">
        <div>
          <div className="label" id="tone-label">
            Тон текста
          </div>
          <Segmented label="Тон текста" value={meta.tone} onChange={(tone) => patchMeta({ tone })} options={TONES.map((t) => ({ id: t.id, label: t.name }))} />
        </div>

        <div>
          <Button variant="primary" busy={busy === "all"} busyText="Собираем резюме…" onClick={() => buildAll()} className="max-lg:hidden">
            {hasBuilt ? "Пересобрать текст" : "Собрать резюме"}
          </Button>
          <BuildStatus busy={busy === "all"} line={line} slow={slow} onSkip={() => abortRef.current?.abort()} />
          {!busy ? (
            <p className="hint mt-2">Напишем «О себе», перепишем опыт в пункты с результатами, выделим 3–5 сильных сторон и разложим навыки на Hard и Soft. Фото и контакты не отправляются на обработку.</p>
          ) : null}
          {buildFailed ? (
            <div className="notice anim-drop mt-4" role="alert">
              Не удалось обработать текст. Мы подставили ваши заметки как есть — их можно поправить вручную и скачать резюме.
              <div className="mt-3">
                <button type="button" className="btn btn-secondary btn-s" onClick={() => buildAll()}>
                  Попробовать снова
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {hasBuilt ? (
          <div className="space-y-5">
            <h2 className="t-h2">Проверьте текст</h2>
            <p className="hint -mt-3">Проверьте факты в тексте: он написан по вашим заметкам, но цифры и названия лучше сверить.</p>
            <Field label="О себе">
              {(f) => (
                <div className="relative">
                  <textarea {...f} ref={summaryRef} className="input pb-6" maxLength={1200} value={doc.aiGenerated.summary} onChange={(e) => edit.summary(e.target.value)} />
                  <span className="tnum pointer-events-none absolute right-3 bottom-1.5 text-[12px] text-faint">{doc.aiGenerated.summary.length}</span>
                </div>
              )}
            </Field>
            <div>
              <div className="label">Сильные стороны</div>
              <div className="space-y-3">
                {doc.aiGenerated.keyStrengths.map((st, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <input aria-label={`Сильная сторона ${i + 1}, заголовок`} className="input font-medium" value={st.title} onChange={(e) => edit.strength(i, "title", e.target.value)} />
                      <textarea aria-label={`Сильная сторона ${i + 1}, пояснение`} className="input" style={{ minHeight: 62 }} value={st.description} onChange={(e) => edit.strength(i, "description", e.target.value)} />
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-icon btn-s"
                      title="Удалить"
                      aria-label={`Удалить сильную сторону ${i + 1}`}
                      onClick={() => update((d) => ({ ...d, aiGenerated: { ...d.aiGenerated, keyStrengths: d.aiGenerated.keyStrengths.filter((_, j) => j !== i) } }))}
                    >
                      <Trash2 {...ic} />
                    </button>
                  </div>
                ))}
              </div>
              {doc.aiGenerated.keyStrengths.length < 5 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-s mt-2"
                  onClick={() => update((d) => ({ ...d, aiGenerated: { ...d.aiGenerated, keyStrengths: [...d.aiGenerated.keyStrengths, { title: "", description: "" }] } }))}
                >
                  <Plus {...ic} /> Добавить сильную сторону
                </button>
              ) : null}
            </div>
            <p className="hint">Пункты опыта правятся на шаге «Опыт» или прямо на листе.</p>
          </div>
        ) : null}
      </fieldset>

      <div>
        <h2 className="t-h2 mb-3">Скачать</h2>
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-raised">
          {EXPORTS.map((x) => (
            <button key={x.id} type="button" disabled={!!exporting} onClick={() => doExport(x.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken disabled:cursor-not-allowed">
              <span className="flex-1">
                <span className="t-label block">{exporting === x.id ? "Готовим PDF…" : x.title}</span>
                <span className="t-small block text-muted">{x.desc}</span>
              </span>
              {exporting === x.id ? <span className="spinner text-muted" /> : <Download {...ic} className="text-muted" />}
            </button>
          ))}
        </div>
        {issues.length ? <p className="hint mt-3">Не заполнено: {issues.map((i) => i.text.toLowerCase()).join("; ")}. Скачать можно, но резюме будет неполным.</p> : null}
      </div>
    </div>,
  ];

  /* --------------------------------------------------------------- toolbar */

  const palette = PALETTES.find((x) => x.id === meta.theme) ?? PALETTES[0];
  const toolbar = (
    <div className="relative border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="t-caps">Шаблон</span>
          <Segmented size="s" label="Шаблон" value={meta.template} onChange={(template) => patchMeta({ template })} options={TEMPLATES.map((t) => ({ id: t.id, label: t.name }))} />
        </div>
        <div className="flex items-center gap-3">
          <span className="t-caps">Цвет</span>
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Цвет резюме">
            {PALETTES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                title={x.name}
                aria-label={x.name}
                aria-checked={meta.theme === x.id}
                onClick={() => patchMeta({ theme: x.id })}
                className="size-5 rounded-full"
                style={{ background: x.base, boxShadow: meta.theme === x.id ? "0 0 0 2px var(--ui-surface), 0 0 0 4px var(--ui-text)" : undefined }}
              />
            ))}
          </div>
          <span className="t-small text-muted">{palette.name}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-3 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="t-caps">Вид</span>
          <Segmented
            size="s"
            label="Вид"
            value={view}
            onChange={setView}
            options={[
              { id: "a4", label: "A4", icon: <FileText {...ic} /> },
              { id: "mobile", label: "Телефон", icon: <Smartphone {...ic} /> },
            ]}
          />
        </div>
        <div className="flex items-center gap-1" aria-label="Масштаб">
          <button type="button" className="btn btn-ghost btn-icon btn-s" title="Уменьшить" aria-label="Уменьшить" onClick={() => setZoom(Math.max(0.4, Math.round(((zoom === "fit" ? fitScale : zoom) - 0.1) * 10) / 10))}>
            <Minus {...ic} />
          </button>
          <span className="tnum t-small w-11 text-center text-muted">{Math.round((zoom === "fit" ? fitScale : zoom) * 100)}%</span>
          <button type="button" className="btn btn-ghost btn-icon btn-s" title="Увеличить" aria-label="Увеличить" onClick={() => setZoom(Math.min(2, Math.round(((zoom === "fit" ? fitScale : zoom) + 0.1) * 10) / 10))}>
            <Plus {...ic} />
          </button>
          <button type="button" className={`btn btn-ghost btn-s ${zoom === "fit" ? "text-fg" : ""}`} aria-pressed={zoom === "fit"} onClick={() => setZoom("fit")}>
            По ширине
          </button>
        </div>
        <div className="ml-auto">
          <DownloadMenu exporting={exporting} onPick={doExport} />
        </div>
      </div>
      {busy ? (
        <div className="progress-track absolute inset-x-0 top-0" aria-hidden>
          <div className="progress-run" />
        </div>
      ) : null}
    </div>
  );

  const notices = (
    <>
      {showOverflow ? (
        <div className="notice anim-drop mb-6 flex items-start gap-3" role="status">
          <div className="flex-1">
            <span className="tnum">
              Резюме выходит на вторую страницу на {overflowLines} {overflowLines % 10 === 1 && overflowLines % 100 !== 11 ? "строку" : overflowLines % 10 >= 2 && overflowLines % 10 <= 4 && (overflowLines % 100 < 10 || overflowLines % 100 >= 20) ? "строки" : "строк"}. Можно уместить на одну.
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {!meta.compact ? (
                <button type="button" className="btn btn-secondary btn-s" onClick={() => patchMeta({ compact: true })}>
                  Уместить на 1 страницу
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-s" disabled={!!busy || !hasBuilt} title={hasBuilt ? undefined : "Сначала соберите текст на шаге «Сборка и экспорт»"} onClick={() => buildAll(true)}>
                Сократить текст
              </button>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-s -mt-1 -mr-2" title="Закрыть" aria-label="Закрыть предупреждение" onClick={() => setDismissedAt(meta.updatedAt)}>
            <X {...ic} />
          </button>
        </div>
      ) : null}
      {busy === "condense" ? (
        <p className="t-small mb-4 flex items-center gap-2 text-muted" role="status">
          <span className="spinner" aria-hidden /> Сокращаем текст…
        </p>
      ) : null}
      {meta.compact && view === "a4" ? (
        <p className="t-small mb-4 text-muted">
          Компактный режим: шрифт 9,5 pt, отступы меньше на 20%.{" "}
          <button type="button" className="text-accent underline underline-offset-2" onClick={() => patchMeta({ compact: false })}>
            Вернуть обычный
          </button>
        </p>
      ) : null}
    </>
  );

  const preview = <Preview doc={doc} variant={view} loading={busy === "all"} edit={edit} onMeasure={onMeasure} zoom={zoom} onFitScale={onFitScale} flash={flash} />;

  const saved = meta.updatedAt ? `Сохранено ${fmtTime(meta.updatedAt)}` : "";
  const progress = (step + 1) / STEPS.length;

  /* ---------------------------------------------------------------- layout */

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* Header: 56 px desktop, 52 px mobile */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="flex h-[52px] items-center gap-3 px-2 lg:h-14 lg:px-6">
          <button type="button" className="btn btn-ghost btn-icon lg:hidden" aria-label={step ? "Предыдущий шаг" : "На главную"} onClick={() => (step ? goTo(step - 1) : onHome())}>
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
          <div className="hidden lg:block">
            <Logo onClick={onHome} />
          </div>
          <p className="t-label tnum flex-1 lg:text-center">
            Шаг {step + 1} из {STEPS.length}
            <span className="hidden text-muted lg:inline"> · {STEPS[step]}</span>
          </p>
          <span key={saved} className="anim-fade t-small tnum pr-2 text-muted lg:pr-0" aria-live="off">
            {saved}
          </span>
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        </div>
        <div className="h-0.5 bg-transparent lg:hidden" aria-hidden>
          <div className="h-full origin-left bg-accent transition-transform duration-[250ms] ease-[var(--ease-move)]" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Form: 44% */}
        <section className="flex min-w-0 flex-col bg-surface lg:w-[44%] lg:border-r lg:border-line">
          <div ref={formScroll} className="flex-1 lg:overflow-y-auto">
            <div className="mx-auto w-full max-w-[560px] px-4 pt-6 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
              <Stepper step={step} visited={visited} issues={issues} touched={touchedSteps} onGo={goTo} />
              <div key={step} className={dir === "next" ? "anim-step-next" : "anim-step-prev"}>
                <h1 className="t-h1 mb-6">{STEPS[step]}</h1>
                {steps[step]}
              </div>
            </div>
          </div>
          {/* Desktop: Назад / Далее pinned to the bottom of the panel */}
          <div className="hidden border-t border-line bg-surface lg:block">
            <div className="mx-auto flex max-w-[560px] justify-between px-8 py-3">
              <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => goTo(step - 1)}>
                Назад
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={next}>
                  Далее
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Preview: 56%, sunken, scrolls on its own */}
        <aside className="hidden min-w-0 flex-1 flex-col bg-sunken lg:flex">
          {toolbar}
          <div ref={previewScroll} className="flex-1 overflow-y-auto p-10">
            {notices}
            {preview}
          </div>
        </aside>
      </div>

      {/* Mobile bottom panel (DESIGN 4.3) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <button type="button" className="btn btn-secondary flex-1" onClick={() => setSheetOpen(true)}>
            <Eye size={20} strokeWidth={1.5} aria-hidden /> Превью
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary flex-1" onClick={next}>
              Далее
            </button>
          ) : (
            <Button variant="primary" className="flex-1" busy={busy === "all"} busyText="Собираем…" onClick={() => buildAll()}>
              {hasBuilt ? "Пересобрать" : "Собрать резюме"}
            </Button>
          )}
        </div>
      </div>

      {sheetOpen ? <PreviewSheet onClose={() => setSheetOpen(false)} toolbar={toolbar} body={<>{notices}{preview}</>} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** DESIGN 6.7: vertical list on desktop; on mobile the header shows the progress line instead. */
function Stepper({ step, visited, issues, touched, onGo }: { step: number; visited: number; issues: Issue[]; touched: Set<number>; onGo: (n: number) => void }) {
  return (
    <nav aria-label="Шаги" className="mb-10 hidden lg:block">
      <ol>
        {STEP_SHORT.map((name, i) => {
          const current = i === step;
          const bad = touched.has(i) && issues.some((x) => x.step === i);
          const done = !current && i < visited && !issues.some((x) => x.step === i && x.required);
          const reachable = i <= visited;
          return (
            <li key={name} className="relative">
              {i < STEP_SHORT.length - 1 ? <span aria-hidden className="absolute top-7 bottom-[-4px] left-[13px] w-px bg-line" /> : null}
              <button
                type="button"
                disabled={!reachable}
                aria-current={current ? "step" : undefined}
                onClick={() => onGo(i)}
                className="relative flex w-full items-center gap-3 rounded-sm py-1 pr-2 pl-1 text-left disabled:cursor-default"
              >
                <span
                  className={`tnum grid size-5 shrink-0 place-items-center rounded-full border text-[11px] leading-none font-medium transition-colors duration-150 ${
                    current ? "border-accent bg-accent text-surface" : done ? "border-success text-success" : "border-line text-muted"
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={2} className="anim-check" aria-hidden /> : i + 1}
                </span>
                <span className={`text-sm ${current ? "font-medium text-fg" : done ? "text-fg" : "text-muted"}`}>{name}</span>
                {bad ? <span className="size-1.5 rounded-full bg-danger" aria-label="Есть ошибки" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** DESIGN 6.13: rotating status lines, then the «longer than usual» offer after 12 s. */
function BuildStatus({ busy, line, slow, onSkip }: { busy: boolean; line: number; slow: boolean; onSkip: () => void }) {
  if (!busy) return null;
  return (
    <div className="mt-3" role="status" aria-live="polite">
      {slow ? (
        <div className="anim-fade">
          <p className="t-small text-muted">Дольше обычного. Можно подождать или продолжить без обработки текста.</p>
          <button type="button" className="btn btn-ghost btn-s -ml-3 mt-1" onClick={onSkip}>
            Продолжить без обработки
          </button>
        </div>
      ) : (
        <p key={line} className="anim-fade t-small text-muted">
          {/* Screen readers hear only the first and the last line (DESIGN 10). */}
          <span aria-hidden={line > 0 && line < BUILD_LINES.length - 1}>{BUILD_LINES[line]}</span>
        </p>
      )}
    </div>
  );
}

/** DESIGN 6.12: «Скачать» with titled items; the item shows a spinner while its PDF is prepared. */
function DownloadMenu({ exporting, onPick }: { exporting: ExportKind | null; onPick: (k: ExportKind) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => (document.removeEventListener("mousedown", onDown), document.removeEventListener("keydown", onKey));
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn btn-secondary btn-s" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Download {...ic} /> Скачать <ChevronDown {...ic} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div role="menu" className="pop anim-drop absolute right-0 z-40 mt-1 w-[300px] overflow-hidden py-1">
          {EXPORTS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="menuitem"
              disabled={!!exporting}
              aria-busy={exporting === x.id || undefined}
              onClick={async () => {
                if (await onPick(x.id)) setOpen(false);
              }}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-sunken disabled:cursor-not-allowed"
            >
              <span className="flex-1">
                <span className="t-label block">{exporting === x.id ? "Готовим PDF…" : x.title}</span>
                <span className="t-small block text-muted">{x.desc}</span>
              </span>
              {exporting === x.id ? <span className="spinner mt-1 text-muted" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Mobile full-screen preview (DESIGN 4.3, 7.2): slides up, closes by button, Esc or a swipe down from the top. */
function PreviewSheet({ onClose, toolbar, body }: { onClose: () => void; toolbar: ReactNode; body: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div
      className="anim-sheet fixed inset-0 z-40 flex flex-col bg-sunken lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Превью"
      onTouchStart={(e) => (start.current = (scroller.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null)}
      onTouchEnd={(e) => {
        if (start.current !== null && e.changedTouches[0].clientY - start.current > 90) onClose();
        start.current = null;
      }}
    >
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <h2 className="t-h2">Превью</h2>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Закрыть превью" onClick={onClose}>
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>
      {toolbar}
      <div ref={scroller} className="flex-1 overflow-y-auto px-4 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {body}
      </div>
    </div>
  );
}

/** DESIGN 6.4: three fields with auto-advance, the «Показывать возраст» switch and the computed age. */
function DobField({ value, onChange, showAge, onShowAge }: { value?: string; onChange: (v: string | undefined) => void; showAge: boolean; onShowAge: (v: boolean) => void }) {
  const [y0, m0, d0] = (value ?? "").split("-");
  const [d, setD] = useState(d0 ?? "");
  const [m, setM] = useState(m0 ?? "");
  const [y, setY] = useState(y0 ?? "");
  const mRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);

  const commit = (dd: string, mm: string, yy: string) => {
    if (!dd && !mm && !yy) return onChange(undefined);
    const [di, mi, yi] = [Number(dd), Number(mm), Number(yy)];
    const dt = new Date(yi, mi - 1, di);
    const ok = yy.length === 4 && yi > 1900 && dt.getFullYear() === yi && dt.getMonth() === mi - 1 && dt.getDate() === di && dt < new Date();
    onChange(ok ? `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` : undefined);
  };
  const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);
  const age = ageFrom(value);
  const partial = (d || m || y) && !value;

  return (
    <div>
      <div className="label" id="dob-label">
        Дата рождения
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2" role="group" aria-labelledby="dob-label">
          <input
            aria-label="День"
            className="input tnum w-14 text-center"
            inputMode="numeric"
            placeholder="ДД"
            value={d}
            onChange={(e) => {
              const v = digits(e.target.value, 2);
              setD(v);
              commit(v, m, y);
              if (v.length === 2) mRef.current?.focus();
            }}
          />
          <input
            ref={mRef}
            aria-label="Месяц"
            className="input tnum w-14 text-center"
            inputMode="numeric"
            placeholder="ММ"
            value={m}
            onChange={(e) => {
              const v = digits(e.target.value, 2);
              setM(v);
              commit(d, v, y);
              if (v.length === 2) yRef.current?.focus();
            }}
          />
          <input
            ref={yRef}
            aria-label="Год"
            className="input tnum w-20 text-center"
            inputMode="numeric"
            placeholder="ГГГГ"
            value={y}
            onChange={(e) => {
              const v = digits(e.target.value, 4);
              setY(v);
              commit(d, m, v);
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" role="switch" className="size-4 accent-[var(--ui-accent)]" checked={showAge} onChange={(e) => onShowAge(e.target.checked)} />
          Показывать возраст
          {age ? <span className="tnum text-muted">{age}</span> : null}
        </label>
      </div>
      {partial && y.length === 4 ? <p className="mt-1.5 text-[13px] text-danger">Проверьте дату: такого дня нет</p> : null}
    </div>
  );
}
