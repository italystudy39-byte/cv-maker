import type { Contacts, Job, Resume } from "./types";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function fmtMonth(ym: string) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const mi = parseInt(m, 10) - 1;
  return mi >= 0 && mi < 12 ? `${MONTHS[mi]} ${y}` : y;
}

export function fmtPeriod(j: Pick<Job, "start" | "end" | "current">) {
  const s = fmtMonth(j.start);
  const e = j.current ? "по наст. время" : fmtMonth(j.end);
  if (!s && !e) return "";
  return [s, e].filter(Boolean).join(" — ");
}

function plural(n: number, one: string, few: string, many: string) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

export function ageFrom(birth: string, now = new Date()) {
  if (!birth) return null;
  const d = new Date(birth + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return `${age} ${plural(age, "год", "года", "лет")}`;
}

export function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Phone mask: Russian numbers as +7 (XXX) XXX-XX-XX, others as +digits. */
export function maskPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (!d) return raw.trim().startsWith("+") ? "+" : "";
  if (d[0] === "8") d = "7" + d.slice(1);
  if (d[0] === "9") d = "7" + d;
  if (d[0] === "7") {
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = "+7";
    if (p[0]) out += ` (${p[0]}${p[0].length === 3 ? ")" : ""}`;
    if (p[1]) out += ` ${p[1]}`;
    if (p[2]) out += `-${p[2]}`;
    if (p[3]) out += `-${p[3]}`;
    return out;
  }
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
  href?: string;
}

export function contactItems(c: Contacts): ContactItem[] {
  const out: ContactItem[] = [];
  if (c.phone.trim()) out.push({ kind: "phone", label: c.phone.trim(), href: "tel:" + c.phone.replace(/[^\d+]/g, "") });
  if (c.email.trim()) out.push({ kind: "email", label: c.email.trim(), href: "mailto:" + c.email.trim() });
  if (c.telegram.trim()) out.push({ kind: "telegram", label: telegramLabel(c.telegram), href: telegramUrl(c.telegram) });
  if (c.linkedin.trim()) out.push({ kind: "linkedin", label: prettyUrl(c.linkedin), href: normalizeUrl(c.linkedin) });
  if (c.portfolio.trim()) out.push({ kind: "portfolio", label: prettyUrl(c.portfolio), href: normalizeUrl(c.portfolio) });
  if (c.city.trim()) out.push({ kind: "city", label: c.city.trim() });
  return out;
}

/** Bullets to show for a job: AI/edited bullets, else the user's raw notes split by line. */
export function jobBullets(j: Job) {
  if (j.bullets.length) return j.bullets.filter((b) => b.trim());
  return j.notes
    .split(/\n+/)
    .map((s) => s.replace(/^[\s•\-–—*]+/, "").trim())
    .filter(Boolean);
}

export interface Issue {
  step: number;
  text: string;
}

export function validate(r: Resume): Issue[] {
  const issues: Issue[] = [];
  const n = r.fullName.trim().length;
  if (n < 2 || n > 100) issues.push({ step: 0, text: "Имя и фамилия: от 2 до 100 символов" });
  if (!r.title.trim()) issues.push({ step: 0, text: "Укажите желаемую должность" });
  const c = r.contacts;
  const filled = [c.phone, c.email, c.telegram, c.linkedin, c.portfolio].some((v) => v.trim());
  if (!filled) issues.push({ step: 1, text: "Нужен хотя бы один контакт" });
  if (c.email.trim() && !isEmail(c.email)) issues.push({ step: 1, text: "Email указан в неверном формате" });
  if (c.phone.trim() && !isPhone(c.phone)) issues.push({ step: 1, text: "Телефон слишком короткий" });
  if (c.linkedin.trim() && !isUrl(c.linkedin)) issues.push({ step: 1, text: "LinkedIn: неверная ссылка" });
  if (c.portfolio.trim() && !isUrl(c.portfolio)) issues.push({ step: 1, text: "Портфолио: неверная ссылка" });
  if (r.skills.length < 3) issues.push({ step: 4, text: "Добавьте минимум 3 навыка" });
  return issues;
}

export function fileBase(r: Resume) {
  const s = r.fullName.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "");
  return s || "resume";
}
