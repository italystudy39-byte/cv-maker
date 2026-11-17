"use client";
import { useState } from "react";
import type { Skill, SkillKind } from "@/lib/types";

const POPULAR = [
  "Excel", "SQL", "Python", "JavaScript", "TypeScript", "React", "Figma", "Power BI", "1С", "Jira", "Git", "Docker",
  "Google Analytics", "SEO", "Agile / Scrum", "Управление проектами", "Переговоры", "Продажи B2B", "CRM", "Английский B2",
  "Коммуникация", "Лидерство", "Работа в команде", "Тайм-менеджмент", "Критическое мышление", "Презентации", "Наставничество",
];

const NEXT: Record<string, SkillKind> = { null: "hard", hard: "soft", soft: null };
const KIND_STYLE: Record<string, string> = {
  null: "bg-slate-100 text-slate-700",
  hard: "bg-blue-100 text-blue-800",
  soft: "bg-amber-100 text-amber-900",
};

export function SkillsField({ skills, onChange }: { skills: Skill[]; onChange: (s: Skill[]) => void }) {
  const [value, setValue] = useState("");

  const add = (raw: string) => {
    const names = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    const have = new Set(skills.map((s) => s.name.toLowerCase()));
    const next = [...skills];
    for (const n of names) {
      if (!have.has(n.toLowerCase()) && n.length <= 80) {
        next.push({ name: n, kind: null });
        have.add(n.toLowerCase());
      }
    }
    onChange(next);
    setValue("");
  };

  const suggestions = POPULAR.filter((p) => !skills.some((s) => s.name.toLowerCase() === p.toLowerCase())).slice(0, 14);

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          list="popular-skills"
          placeholder="Например: SQL, Figma, переговоры"
          value={value}
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
        <button type="button" className="btn-secondary" onClick={() => add(value)}>
          Добавить
        </button>
        <datalist id="popular-skills">
          {POPULAR.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <p className="hint mt-2">Вводите через запятую или Enter. Нажмите на навык, чтобы отметить его как Hard или Soft (ИИ сделает это сам при сборке).</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {skills.map((s, i) => (
          <span key={s.name} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${KIND_STYLE[String(s.kind)]}`}>
            <button
              type="button"
              title="Сменить тип: без типа → Hard → Soft"
              onClick={() => onChange(skills.map((x, j) => (j === i ? { ...x, kind: NEXT[String(x.kind)] } : x)))}
            >
              {s.name}
              {s.kind ? <span className="ml-1 text-[10px] uppercase opacity-70">{s.kind}</span> : null}
            </button>
            <button type="button" aria-label={`Удалить ${s.name}`} className="ml-1 opacity-60 hover:opacity-100" onClick={() => onChange(skills.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <p className={`mt-2 text-sm ${skills.length >= 3 ? "text-emerald-700" : "text-slate-500"}`}>Добавлено: {skills.length} (минимум 3)</p>

      {suggestions.length ? (
        <div className="mt-4">
          <div className="label">Популярные навыки</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((p) => (
              <button key={p} type="button" className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-600 hover:border-slate-500" onClick={() => add(p)}>
                + {p}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
