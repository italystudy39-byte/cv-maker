import type { Experience, ResumeDocument } from "./types";

/** DESIGN 9.1: dates as "03.2021 — н. в." throughout the document. */
export function fmtMonth(ym?: string) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const mi = parseInt(m, 10);
  return mi >= 1 && mi <= 12 ? `${String(mi).padStart(2, "0")}.${y}` : y;
}

export function fmtPeriod(j: Pick<Experience, "startDate" | "endDate" | "isCurrent">) {
  const s = fmtMonth(j.startDate);
  const e = j.isCurrent ? "н.\u00a0в." : fmtMonth(j.endDate);
  if (!s && !e) return "";
  return [s, e].filter(Boolean).join("\u00a0— ");
}

export function pluralYears(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "год";
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "года";
  return "лет";
}

/** Spec 2.1: Age = floor((CurrentDate − BirthDate) / 365.2425 days). */
export function ageFrom(birth?: string, now = new Date()) {
  if (!birth) return null;
  const d = new Date(birth + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const age = Math.floor((now.getTime() - d.getTime()) / (365.2425 * 86400000));
  if (age < 0 || age > 120) return null;
  return `${age} ${pluralYears(age)}`;
}

/** Phone mask: +7 (XXX) XXX-XX-XX, +998 (XX) XXX-XX-XX, other countries as +digits. */
export function maskPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (!d) return raw.trim().startsWith("+") ? "+" : "";
  if (d[0] === "8" && !raw.trim().startsWith("+")) d = "7" + d.slice(1);
  if (d[0] === "9" && !d.startsWith("998") && !raw.trim().startsWith("+")) d = "7" + d;
  const group = (cc: string, parts: number[]) => {
    let rest = d.slice(cc.length);
    let out = "+" + cc;
    parts.forEach((n, i) => {
      const chunk = rest.slice(0, n);
      rest = rest.slice(n);
      if (!chunk) return;
      if (i === 0) out += ` (${chunk}${chunk.length === n ? ")" : ""}`;
      else out += (i === 1 ? " " : "-") + chunk;
    });
    return out;
  };
  if (d.startsWith("998")) return group("998", [2, 3, 2, 2]);
  if (d[0] === "7") return group("7", [3, 3, 2, 2]);
  return "+" + d.slice(0, 15);
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const isPhone = (s: string) => s.replace(/\D/g, "").length >= 10;

export function normalizeUrl(s: string) {
  const v = s.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
export function isUrl(s: string) {
  try {
    const u = new URL(normalizeUrl(s));
    return /\./.test(u.hostname);
  } catch {
    return false;
  }
}

export function telegramUrl(s: string) {
  const v = s.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v) || /^t\.me\//i.test(v)) return normalizeUrl(v);
  return `https://t.me/${v.replace(/^@/, "")}`;
}
export function telegramLabel(s: string) {
  const v = s.trim();
  const m = v.match(/t\.me\/([^/?#]+)/i);
  if (m) return "@" + m[1];
  return v.startsWith("@") ? v : "@" + v;
}
export const prettyUrl = (s: string) => s.trim().replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/$/, "");

export type ContactKind = "age" | "phone" | "email" | "telegram" | "linkedin" | "portfolio" | "city";
export interface ContactItem {
  kind: ContactKind;
  label: string;
  /** Call-to-action label for the mobile quick buttons. */
  action?: string;
  href?: string;
}

/** Contacts with link protocols (spec 2.1): tel:, mailto:, https://t.me/. */
export function contactItems(r: ResumeDocument, withCity = true): ContactItem[] {
  const c = r.contacts;
  const out: ContactItem[] = [];
  const v = (s?: string) => (s ?? "").trim();
  if (v(c.phone)) out.push({ kind: "phone", label: v(c.phone), action: "Позвонить", href: "tel:" + v(c.phone).replace(/[^\d+]/g, "") });
  if (v(c.telegram)) out.push({ kind: "telegram", label: telegramLabel(v(c.telegram)), action: "Написать в Telegram", href: telegramUrl(v(c.telegram)) });
  if (v(c.email)) out.push({ kind: "email", label: v(c.email), action: "Написать на почту", href: "mailto:" + v(c.email) });
  if (v(c.linkedin)) out.push({ kind: "linkedin", label: prettyUrl(v(c.linkedin)), action: "Открыть LinkedIn", href: normalizeUrl(v(c.linkedin)) });
  if (v(c.portfolioUrl)) out.push({ kind: "portfolio", label: prettyUrl(v(c.portfolioUrl)), action: "Открыть портфолио", href: normalizeUrl(v(c.portfolioUrl)) });
  if (withCity && v(r.personal.location)) out.push({ kind: "city", label: v(r.personal.location) });
  return out;
}

/** Spec 8.2: raw notes split by line break, used when there are no AI bullets. */
export function notesToBullets(notes: string) {
  return notes
    .split(/\n+/)
    .map((s) => s.replace(/^[\s•\-–—*]+/, "").trim())
    .filter(Boolean);
}

export function jobBullets(j: Experience) {
  const b = j.aiBullets.filter((x) => x.trim());
  return b.length ? b : notesToBullets(j.rawNotes);
}

export const hasJob = (j: Experience) => !!(j.company.trim() || j.position.trim());

export interface Issue {
  step: number;
  field: string;
  text: string;
  /** Required-field issues block "Далее"; format issues are only shown. */
  required?: boolean;
}

export function validate(r: ResumeDocument): Issue[] {
  const issues: Issue[] = [];
  const n = r.personal.fullName.trim().length;
  if (n < 2 || n > 100) issues.push({ step: 0, field: "fullName", text: "Введите имя и фамилию, от 2 до 100 символов", required: true });
  if (!r.personal.targetTitle.trim()) issues.push({ step: 0, field: "targetTitle", text: "Укажите должность, на которую откликаетесь", required: true });
  const c = r.contacts;
  const val = (s?: string) => (s ?? "").trim();
  if (![c.phone, c.email, c.telegram, c.linkedin, c.portfolioUrl].some((x) => val(x)))
    issues.push({ step: 1, field: "contacts", text: "Добавьте хотя бы один способ связи", required: true });
  if (val(c.email) && !isEmail(val(c.email))) issues.push({ step: 1, field: "email", text: "Введите email в формате name@site.ru" });
  if (val(c.phone) && !isPhone(val(c.phone))) issues.push({ step: 1, field: "phone", text: "Введите телефон полностью, с кодом страны" });
  if (val(c.linkedin) && !isUrl(val(c.linkedin))) issues.push({ step: 1, field: "linkedin", text: "Вставьте ссылку вида linkedin.com/in/имя" });
  if (val(c.portfolioUrl) && !isUrl(val(c.portfolioUrl))) issues.push({ step: 1, field: "portfolioUrl", text: "Вставьте ссылку вида site.ru или behance.net/имя" });
  if (r.skills.hard.length + r.skills.soft.length < 3) issues.push({ step: 4, field: "skills", text: "Добавьте минимум 3 навыка", required: true });
  return issues;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Spec 4.3: Resume_Ivan_Ivanov_Desktop.pdf (ASCII, safe for messengers and ZIP). */
export function pdfFileName(r: ResumeDocument, format: "desktop" | "mobile") {
  const latin = [...r.personal.fullName.trim()]
    .map((ch) => {
      const low = ch.toLowerCase();
      const t = TRANSLIT[low];
      if (t === undefined) return ch;
      return ch === low ? t : t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join("")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `Resume_${latin || "CV"}_${format === "desktop" ? "Desktop" : "Mobile"}.pdf`;
}
