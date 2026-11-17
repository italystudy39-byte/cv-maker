"use client";
import { useMemo, useState, type ReactNode } from "react";
import { fileBase, maskPhone, validate } from "@/lib/format";
import { PALETTES, themeFor } from "@/lib/palettes";
import { emptyCourse, emptyEducation, emptyJob, type Job, type Resume, type TemplateId, type Tone } from "@/lib/types";
import type { useDraft } from "@/lib/useDraft";
import { PhotoField } from "./PhotoField";
import { Preview } from "./Preview";
import { SkillsField } from "./SkillsField";
import type { Variant } from "./templates/ResumeDoc";

const STEPS = ["Основное", "Контакты", "Опыт", "Образование", "Навыки", "ИИ и экспорт"];

const TEMPLATES: { id: TemplateId; name: string; hint: string }[] = [
  { id: "classic", name: "Классический", hint: "Финансы, право, госсектор" },
  { id: "modern", name: "Современный", hint: "IT, маркетинг, продажи" },
  { id: "minimal", name: "Минимализм", hint: "Дизайн, PR, медиа" },
];

const TONES: { id: Tone; name: string }[] = [
  { id: "corporate", name: "Строгий / корпоративный" },
  { id: "modern", name: "Современный / динамичный" },
  { id: "creative", name: "Креативный" },
];

type Draft = ReturnType<typeof useDraft>;

function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-600">{error}</span> : hint ? <span className="hint mt-1 block">{hint}</span> : null}
    </label>
  );
}

function forAi(r: Resume) {
  // Never send the photo or direct contacts to the model.
  return {
    fullName: r.fullName,
    title: r.title,
    contacts: { city: r.contacts.city },
    jobs: r.jobs.filter((j) => j.company || j.position || j.notes),
    education: r.education,
    courses: r.courses,
    skills: r.skills.map((s) => ({ name: s.name })),
  };
}

async function callAi(body: unknown) {
  const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`);
  return json;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Builder({ d }: { d: Draft }) {
  const { draft, setResume, setSettings, setStep, reset, saveState } = d;
  const { resume: r, settings: s, step } = draft;
  const [view, setView] = useState<Variant>("a4");
  const [showPreview, setShowPreview] = useState(false);
  const [aiBusy, setAiBusy] = useState<null | "all" | string>(null);
  const [aiError, setAiError] = useState("");
  const [exporting, setExporting] = useState<null | "a4" | "mobile" | "zip">(null);
  const [exportInfo, setExportInfo] = useState("");
  const [touched, setTouched] = useState(false);
  const issues = useMemo(() => validate(r), [r]);
  const stepIssues = (n: number) => (touched ? issues.filter((i) => i.step === n) : []);

  const patch = (p: Partial<Resume>) => setResume((x) => ({ ...x, ...p }));
  const patchContacts = (p: Partial<Resume["contacts"]>) => setResume((x) => ({ ...x, contacts: { ...x.contacts, ...p } }));
  const patchJob = (id: string, p: Partial<Job>) => setResume((x) => ({ ...x, jobs: x.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) }));

  const buildAll = async () => {
    setTouched(true);
    const blocking = issues.filter((i) => i.step <= 1 || i.step === 4);
    if (blocking.length) {
      setAiError("Перед сборкой заполните: " + blocking.map((i) => i.text.toLowerCase()).join("; "));
      return;
    }
    setAiError("");
    setAiBusy("all");
    try {
      const out = (await callAi({ scope: "all", tone: s.tone, resume: forAi(r) })) as {
        summary: string;
        strengths: { title: string; description: string }[];
        jobs: { id: string; bullets: string[] }[];
        skills: { name: string; kind: "hard" | "soft" }[];
      };
      setResume((x) => ({
        ...x,
        summary: out.summary,
        strengths: out.strengths.slice(0, 5),
        jobs: x.jobs.map((j) => {
          const g = out.jobs.find((o) => o.id === j.id);
          return g && g.bullets.length ? { ...j, bullets: g.bullets } : j;
        }),
        skills: x.skills.map((sk) => {
          const g = out.skills.find((o) => o.name.toLowerCase() === sk.name.toLowerCase());
          return g ? { ...sk, kind: g.kind } : sk;
        }),
      }));
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  };

  const improveJob = async (id: string) => {
    setAiError("");
    setAiBusy(id);
    try {
      const out = (await callAi({ scope: "job", tone: s.tone, jobId: id, resume: forAi(r) })) as { bullets: string[] };
      patchJob(id, { bullets: out.bullets });
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  };

  const doExport = async (kind: "a4" | "mobile" | "zip") => {
    setExporting(kind);
    setExportInfo("");
    const t0 = performance.now();
    try {
      const { renderPdf } = await import("./templates/pdf");
      const base = fileBase(r);
      if (kind === "zip") {
        const [a4, mob] = await Promise.all([renderPdf(r, s, "a4"), renderPdf(r, s, "mobile")]);
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        zip.file(`${base}_A4.pdf`, a4);
        zip.file(`${base}_mobile.pdf`, mob);
        download(await zip.generateAsync({ type: "blob" }), `${base}_resume.zip`);
      } else {
        download(await renderPdf(r, s, kind), `${base}_${kind === "a4" ? "A4" : "mobile"}.pdf`);
      }
      setExportInfo(`Готово за ${((performance.now() - t0) / 1000).toFixed(1)} с`);
    } catch (e) {
      console.error(e);
      setExportInfo("Не удалось создать PDF: " + (e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const theme = themeFor(s.palette);

  /* --------------------------------- steps -------------------------------- */
  const steps: ReactNode[] = [
    <div key="0" className="space-y-5">
      <PhotoField photo={r.photo} ratio={r.photoRatio} onChange={(photo, photoRatio) => patch({ photo, photoRatio })} />
      <Field label="Имя и фамилия *" error={stepIssues(0).find((i) => i.text.startsWith("Имя"))?.text}>
        <input className="input" maxLength={100} value={r.fullName} onChange={(e) => patch({ fullName: e.target.value })} placeholder="Анна Смирнова" autoComplete="name" />
      </Field>
      <Field label="Желаемая должность *" hint="ИИ расставит акценты именно под эту роль" error={stepIssues(0).find((i) => i.text.includes("должность"))?.text}>
        <input className="input" value={r.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Продуктовый аналитик" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Дата рождения" hint="Возраст посчитается автоматически">
          <input type="date" className="input" value={r.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => patch({ birthDate: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 self-center pt-5 text-sm">
          <input type="checkbox" checked={r.showAge} onChange={(e) => patch({ showAge: e.target.checked })} />
          Показывать возраст в резюме
        </label>
      </div>
    </div>,

    <div key="1" className="space-y-4">
      <p className="hint">Нужен хотя бы один способ связи. Ссылки в PDF будут кликабельными.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Телефон" error={stepIssues(1).find((i) => i.text.startsWith("Телефон"))?.text}>
          <input className="input" inputMode="tel" autoComplete="tel" value={r.contacts.phone} onChange={(e) => patchContacts({ phone: maskPhone(e.target.value) })} placeholder="+7 (900) 123-45-67" />
        </Field>
        <Field label="Email" error={stepIssues(1).find((i) => i.text.startsWith("Email"))?.text}>
          <input className="input" type="email" autoComplete="email" value={r.contacts.email} onChange={(e) => patchContacts({ email: e.target.value })} placeholder="anna@mail.ru" />
        </Field>
        <Field label="Telegram">
          <input className="input" value={r.contacts.telegram} onChange={(e) => patchContacts({ telegram: e.target.value })} placeholder="@username или t.me/username" />
        </Field>
        <Field label="LinkedIn" error={stepIssues(1).find((i) => i.text.startsWith("LinkedIn"))?.text}>
          <input className="input" inputMode="url" value={r.contacts.linkedin} onChange={(e) => patchContacts({ linkedin: e.target.value })} placeholder="linkedin.com/in/username" />
        </Field>
        <Field label="Портфолио / сайт" error={stepIssues(1).find((i) => i.text.startsWith("Портфолио"))?.text}>
          <input className="input" inputMode="url" value={r.contacts.portfolio} onChange={(e) => patchContacts({ portfolio: e.target.value })} placeholder="behance.net/username" />
        </Field>
        <Field label="Город проживания">
          <input className="input" value={r.contacts.city} onChange={(e) => patchContacts({ city: e.target.value })} placeholder="Москва" />
        </Field>
      </div>
      {stepIssues(1).some((i) => i.text.startsWith("Нужен")) ? <p className="text-sm text-red-600">Нужен хотя бы один контакт</p> : null}
    </div>,

    <div key="2" className="space-y-5">
      <p className="hint">Пишите как есть, своими словами: что делали, чего добились, цифры если помните. ИИ превратит заметки в профессиональные пункты.</p>
      {r.jobs.map((j, idx) => (
        <div key={j.id} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Место работы {idx + 1}</span>
            <div className="flex gap-3 text-sm">
              {idx > 0 ? (
                <button type="button" className="text-slate-500 hover:text-slate-900" onClick={() => setResume((x) => { const jobs = [...x.jobs]; [jobs[idx - 1], jobs[idx]] = [jobs[idx], jobs[idx - 1]]; return { ...x, jobs }; })}>
                  ↑ Выше
                </button>
              ) : null}
              <button type="button" className="text-red-600 hover:underline" onClick={() => setResume((x) => ({ ...x, jobs: x.jobs.filter((y) => y.id !== j.id) }))}>
                Удалить
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Компания">
              <input className="input" value={j.company} onChange={(e) => patchJob(j.id, { company: e.target.value })} />
            </Field>
            <Field label="Должность">
              <input className="input" value={j.position} onChange={(e) => patchJob(j.id, { position: e.target.value })} />
            </Field>
            <Field label="Начало">
              <input type="month" className="input" value={j.start} onChange={(e) => patchJob(j.id, { start: e.target.value })} />
            </Field>
            <Field label="Окончание">
              <input type="month" className="input disabled:opacity-50" disabled={j.current} value={j.current ? "" : j.end} onChange={(e) => patchJob(j.id, { end: e.target.value })} />
            </Field>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={j.current} onChange={(e) => patchJob(j.id, { current: e.target.checked })} /> По настоящее время
          </label>
          <Field label="Обязанности и достижения (заметки)">
            <textarea className="input mt-1 min-h-24" value={j.notes} onChange={(e) => patchJob(j.id, { notes: e.target.value })} placeholder="вёл отчётность по продажам, сделал дашборд в Power BI, сократил время подготовки отчёта с 2 дней до 2 часов" />
          </Field>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ai" disabled={!!aiBusy || !(j.notes.trim() || j.position.trim())} onClick={() => improveJob(j.id)}>
              {aiBusy === j.id ? "Улучшаю…" : "✨ Улучшить с помощью ИИ"}
            </button>
            {j.bullets.length ? (
              <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => patchJob(j.id, { bullets: [] })}>
                Вернуть мои заметки
              </button>
            ) : null}
          </div>
          {j.bullets.length ? (
            <Field label="Текст в резюме (каждая строка — отдельный пункт, можно править)">
              <textarea
                className="input mt-1 min-h-32"
                value={j.bullets.join("\n")}
                onChange={(e) => patchJob(j.id, { bullets: e.target.value.split("\n") })}
              />
            </Field>
          ) : null}
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => setResume((x) => ({ ...x, jobs: [...x.jobs, emptyJob()] }))}>
        + Добавить место работы
      </button>
    </div>,

    <div key="3" className="space-y-5">
      {r.education.map((e, idx) => (
        <div key={e.id} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Образование {idx + 1}</span>
            <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setResume((x) => ({ ...x, education: x.education.filter((y) => y.id !== e.id) }))}>
              Удалить
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["institution", "Учебное заведение", "НИУ ВШЭ"],
                ["faculty", "Факультет / специальность", "Экономика"],
                ["degree", "Степень / квалификация", "Бакалавр"],
                ["year", "Год окончания", "2020"],
              ] as const
            ).map(([k, label, ph]) => (
              <Field key={k} label={label}>
                <input
                  className="input"
                  inputMode={k === "year" ? "numeric" : undefined}
                  maxLength={k === "year" ? 4 : undefined}
                  placeholder={ph}
                  value={e[k]}
                  onChange={(ev) => {
                    const v = k === "year" ? ev.target.value.replace(/\D/g, "") : ev.target.value;
                    setResume((x) => ({ ...x, education: x.education.map((y) => (y.id === e.id ? { ...y, [k]: v } : y)) }));
                  }}
                />
              </Field>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => setResume((x) => ({ ...x, education: [...x.education, emptyEducation()] }))}>
        + Добавить образование
      </button>

      <h3 className="pt-2 font-semibold">Курсы и сертификаты</h3>
      {r.courses.map((c) => (
        <div key={c.id} className="grid items-end gap-3 sm:grid-cols-[2fr_1.5fr_0.8fr_auto]">
          {(
            [
              ["name", "Название", "Data Analyst"],
              ["issuer", "Организация", "Яндекс Практикум"],
              ["year", "Год", "2023"],
            ] as const
          ).map(([k, label, ph]) => (
            <Field key={k} label={label}>
              <input
                className="input"
                placeholder={ph}
                value={c[k]}
                onChange={(ev) => setResume((x) => ({ ...x, courses: x.courses.map((y) => (y.id === c.id ? { ...y, [k]: ev.target.value } : y)) }))}
              />
            </Field>
          ))}
          <button type="button" aria-label="Удалить курс" className="mb-2 text-red-600" onClick={() => setResume((x) => ({ ...x, courses: x.courses.filter((y) => y.id !== c.id) }))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => setResume((x) => ({ ...x, courses: [...x.courses, emptyCourse()] }))}>
        + Добавить курс
      </button>
    </div>,

    <div key="4">
      <SkillsField skills={r.skills} onChange={(skills) => patch({ skills })} />
      {stepIssues(4).length ? <p className="mt-2 text-sm text-red-600">{stepIssues(4)[0].text}</p> : null}
    </div>,

    <div key="5" className="space-y-6">
      <div>
        <div className="label">Тональность текста</div>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button key={t.id} type="button" onClick={() => setSettings({ tone: t.id })} className={`chip ${s.tone === t.id ? "chip-on" : ""}`}>
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <button type="button" className="btn-ai w-full py-3 text-base" disabled={!!aiBusy} onClick={buildAll}>
          {aiBusy === "all" ? "ИИ собирает резюме…" : r.summary ? "✨ Улучшить всё резюме с ИИ" : "✨ Собрать резюме с ИИ"}
        </button>
        <p className="hint mt-2">ИИ напишет блок «О себе», перепишет опыт в пункты с глаголами действия, выделит сильные стороны и разделит навыки на Hard и Soft. Фото и контакты в ИИ не отправляются.</p>
      </div>

      {r.summary || r.strengths.length ? (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Проверьте и поправьте тексты</h3>
          <Field label="О себе">
            <textarea className="input mt-1 min-h-28" value={r.summary} onChange={(e) => patch({ summary: e.target.value })} />
          </Field>
          <div>
            <div className="label">Сильные стороны</div>
            {r.strengths.map((st, i) => (
              <div key={i} className="mb-3 flex gap-2">
                <div className="flex-1 space-y-1">
                  <input className="input font-medium" value={st.title} onChange={(e) => patch({ strengths: r.strengths.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  <textarea className="input min-h-16" value={st.description} onChange={(e) => patch({ strengths: r.strengths.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                </div>
                <button type="button" aria-label="Удалить" className="self-start text-red-600" onClick={() => patch({ strengths: r.strengths.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </div>
            ))}
            {r.strengths.length < 5 ? (
              <button type="button" className="text-sm text-slate-600 hover:underline" onClick={() => patch({ strengths: [...r.strengths, { title: "", description: "" }] })}>
                + Добавить
              </button>
            ) : null}
          </div>
          <p className="hint">Пункты опыта работы можно править на шаге «Опыт».</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="label">Скачать</div>
        <button type="button" className="btn-primary w-full" disabled={!!exporting} onClick={() => doExport("a4")}>
          {exporting === "a4" ? "Готовлю PDF…" : "Скачать для ПК и печати (A4 PDF)"}
        </button>
        <button type="button" className="btn-primary w-full" disabled={!!exporting} onClick={() => doExport("mobile")}>
          {exporting === "mobile" ? "Готовлю PDF…" : "Скачать для смартфона и мессенджеров (Mobile PDF)"}
        </button>
        <button type="button" className="btn-secondary w-full" disabled={!!exporting} onClick={() => doExport("zip")}>
          {exporting === "zip" ? "Собираю архив…" : "Скачать оба варианта (ZIP)"}
        </button>
        {exportInfo ? <p className="text-center text-sm text-slate-500">{exportInfo}</p> : null}
        {issues.length ? (
          <p className="text-sm text-amber-700">Не заполнено: {issues.map((i) => i.text.toLowerCase()).join("; ")}. Скачать можно, но резюме будет неполным.</p>
        ) : null}
      </div>
    </div>,
  ];

  const designBar = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1 text-sm" role="tablist" aria-label="Режим превью">
          {(
            [
              ["a4", "Вид на ПК"],
              ["mobile", "Вид на телефоне"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 ${view === v ? "bg-white font-medium shadow" : "text-slate-600"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" aria-label="Цветовая тема">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.name}
              aria-label={p.name}
              aria-pressed={s.palette === p.id}
              onClick={() => setSettings({ palette: p.id })}
              className={`h-7 w-7 rounded-full ring-offset-2 transition ${s.palette === p.id ? "ring-2 ring-slate-900" : "hover:scale-110"}`}
              style={{ background: p.base }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSettings({ template: t.id })}
            className={`rounded-lg border px-2 py-2 text-left text-sm transition ${s.template === t.id ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:border-slate-400"}`}
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-slate-500">{t.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const preview = <Preview resume={r} settings={s} variant={view} loading={aiBusy === "all"} />;

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-6">
      {/* Form */}
      <section className="min-w-0 pb-24 lg:pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Конструктор резюме</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{saveState === "error" ? "Не удалось сохранить черновик" : saveState === "saved" ? "Черновик сохранён в браузере" : ""}</span>
            <button
              type="button"
              className="hover:text-red-600"
              onClick={() => {
                if (window.confirm("Удалить черновик и начать заново?")) reset();
              }}
            >
              Начать заново
            </button>
          </div>
        </div>

        <nav className="mb-5 flex gap-1 overflow-x-auto pb-1" aria-label="Шаги">
          {STEPS.map((name, i) => {
            const bad = touched && issues.some((x) => x.step === i);
            return (
              <button
                key={name}
                type="button"
                onClick={() => setStep(i)}
                aria-current={step === i ? "step" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${step === i ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"} ${bad ? "ring-1 ring-red-400" : ""}`}
              >
                {i + 1}. {name}
              </button>
            );
          })}
        </nav>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="mb-4 text-lg font-semibold">{STEPS[step]}</h2>
          {steps[step]}
          {aiError ? (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {aiError}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-between">
          <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Назад
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (issues.some((x) => x.step === step)) setTouched(true);
                setStep(step + 1);
              }}
            >
              Далее →
            </button>
          ) : null}
        </div>
      </section>

      {/* Desktop preview */}
      <aside className="hidden min-w-0 lg:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-4 overflow-y-auto rounded-2xl bg-slate-100 p-4">
          {designBar}
          {preview}
        </div>
      </aside>

      {/* Mobile floating preview */}
      <button
        type="button"
        className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full px-6 py-3 font-medium shadow-lg lg:hidden"
        style={{ background: theme.sidebar, color: theme.onSidebar }}
        onClick={() => setShowPreview(true)}
      >
        Предпросмотр
      </button>
      {showPreview ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-100 p-4 lg:hidden" role="dialog" aria-modal="true" aria-label="Предпросмотр">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Предпросмотр</h2>
            <button type="button" className="btn-secondary" onClick={() => setShowPreview(false)}>
              Закрыть
            </button>
          </div>
          {designBar}
          <div className="mt-4">{preview}</div>
        </div>
      ) : null}
    </div>
  );
}
