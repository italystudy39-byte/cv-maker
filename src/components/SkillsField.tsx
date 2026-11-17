"use client";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import type { ResumeDocument } from "@/lib/types";
import { SortableList } from "./Sortable";

type Skills = ResumeDocument["skills"];
type Kind = keyof Skills;

const POPULAR: { n: string; k: Kind }[] = [
  { n: "Excel", k: "hard" },
  { n: "SQL", k: "hard" },
  { n: "Коммуникация", k: "soft" },
  { n: "Python", k: "hard" },
  { n: "Работа в команде", k: "soft" },
  { n: "Figma", k: "hard" },
  { n: "Переговоры", k: "soft" },
  { n: "1С", k: "hard" },
  { n: "Power BI", k: "hard" },
  { n: "Тайм-менеджмент", k: "soft" },
  { n: "JavaScript", k: "hard" },
  { n: "Jira", k: "hard" },
  { n: "Лидерство", k: "soft" },
  { n: "Git", k: "hard" },
  { n: "Презентации", k: "soft" },
  { n: "Google Analytics", k: "hard" },
  { n: "Agile / Scrum", k: "hard" },
  { n: "Наставничество", k: "soft" },
  { n: "CRM", k: "hard" },
  { n: "Английский B2", k: "hard" },
  { n: "Критическое мышление", k: "soft" },
];

const MIN = 3;

/**
 * DESIGN 6.5: neutral tags in one field. Hard/Soft groups appear only once the text is built,
 * because that split is made during the build.
 */
export function SkillsField({ skills, onChange, grouped, error, inputId }: { skills: Skills; onChange: (s: Skills) => void; grouped: boolean; error?: string; inputId?: string }) {
  const [value, setValue] = useState("");
  const [more, setMore] = useState(false);
  const auto = useId();
  const id = inputId ?? auto;
  const all = [...skills.hard, ...skills.soft];
  const has = (n: string) => all.some((s) => s.toLowerCase() === n.toLowerCase());
  const kindOf = (n: string): Kind => (skills.soft.includes(n) ? "soft" : "hard");

  const add = (raw: string, to: Kind = "hard") => {
    const fresh: string[] = [];
    for (const n of raw.split(/[,;\n]/).map((s) => s.trim()).filter((s) => s && s.length <= 80))
      if (!has(n) && !fresh.some((f) => f.toLowerCase() === n.toLowerCase())) fresh.push(n);
    if (fresh.length) onChange({ ...skills, [to]: [...skills[to], ...fresh] });
    setValue("");
  };
  const remove = (name: string) => onChange({ hard: skills.hard.filter((s) => s !== name), soft: skills.soft.filter((s) => s !== name) });
  const move = (name: string) => {
    const k = kindOf(name);
    const other: Kind = k === "hard" ? "soft" : "hard";
    onChange({ ...skills, [k]: skills[k].filter((s) => s !== name), [other]: [...skills[other], name] });
  };
  /** Reorder the combined list while each skill keeps its group. */
  const reorderAll = (items: string[]) => onChange({ hard: items.filter((s) => kindOf(s) === "hard"), soft: items.filter((s) => kindOf(s) === "soft") });

  const suggestions = POPULAR.filter((x) => !has(x.n));
  const shown = more ? suggestions : suggestions.slice(0, 8);

  const tag = (s: string, handle: Record<string, unknown>) => (
    <span className="anim-rise inline-flex items-center gap-0.5 rounded-full bg-sunken py-1 pr-1 pl-3 text-[13px] leading-[18px] text-fg select-none">
      <span {...handle} className="cursor-grab touch-none active:cursor-grabbing">
        {s}
      </span>
      {grouped ? (
        <button
          type="button"
          title={kindOf(s) === "hard" ? "Перенести в Soft skills" : "Перенести в Hard skills"}
          aria-label={`Перенести «${s}» в другую группу`}
          className="grid size-6 place-items-center rounded-full text-muted hover:text-fg"
          onClick={() => move(s)}
        >
          <ArrowLeftRight size={12} strokeWidth={1.5} />
        </button>
      ) : null}
      <button type="button" title="Удалить" aria-label={`Удалить «${s}»`} className="grid size-6 place-items-center rounded-full text-muted hover:text-fg" onClick={() => remove(s)}>
        <X size={12} strokeWidth={1.5} />
      </button>
    </span>
  );

  return (
    <div>
      <label htmlFor={id} className="label">
        Навыки
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="input min-w-0 flex-1"
          placeholder="Например: SQL, Figma, переговоры"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;]/.test(v)) add(v);
            else setValue(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(value);
            }
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={!value.trim()} onClick={() => add(value)}>
          Добавить
        </button>
      </div>
      <p id={`${id}-hint`} className="hint mt-1.5">
        Вводите через запятую или Enter. Порядок меняется перетаскиванием.
      </p>

      {grouped ? (
        (["hard", "soft"] as const).map((k) => (
          <div key={k} className="mt-5">
            <div className="t-caps mb-2">{k === "hard" ? "Hard skills" : "Soft skills"}</div>
            {skills[k].length ? (
              <SortableList items={skills[k]} getId={(s) => s} layout="wrap" className="flex flex-wrap gap-2" onReorder={(items) => onChange({ ...skills, [k]: items })} render={(s, h) => tag(s, h)} />
            ) : (
              <p className="hint">Пока пусто</p>
            )}
          </div>
        ))
      ) : all.length ? (
        <div className="mt-4">
          <SortableList items={all} getId={(s) => s} layout="wrap" className="flex flex-wrap gap-2" onReorder={reorderAll} render={(s, h) => tag(s, h)} />
        </div>
      ) : null}

      <p className={`tnum mt-3 text-[13px] leading-[18px] ${all.length >= MIN ? "text-success" : error ? "text-danger" : "text-muted"}`}>
        {all.length} из минимум {MIN}
      </p>

      {shown.length ? (
        <div className="mt-6">
          <div className="t-caps mb-2">Часто добавляют</div>
          <div className="flex flex-wrap gap-1">
            {shown.map(({ n, k }) => (
              <button key={n} type="button" className="btn btn-ghost btn-s gap-1 px-2" onClick={() => add(n, k)}>
                <Plus size={14} strokeWidth={1.5} aria-hidden />
                {n}
              </button>
            ))}
            {suggestions.length > 8 ? (
              <button type="button" className="btn btn-ghost btn-s px-2 text-accent" onClick={() => setMore((v) => !v)}>
                {more ? "Свернуть" : "Показать ещё"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
