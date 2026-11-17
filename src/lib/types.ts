export type SkillKind = "hard" | "soft" | null;

export interface Skill {
  name: string;
  kind: SkillKind;
}

export interface Job {
  id: string;
  company: string;
  position: string;
  start: string; // YYYY-MM
  end: string; // YYYY-MM
  current: boolean;
  notes: string; // raw notes from the user
  bullets: string[]; // AI-rewritten (editable) bullets
}

export interface Education {
  id: string;
  institution: string;
  faculty: string;
  degree: string;
  year: string;
}

export interface Course {
  id: string;
  name: string;
  issuer: string;
  year: string;
}

export interface Strength {
  title: string;
  description: string;
}

export interface Contacts {
  phone: string;
  email: string;
  telegram: string;
  linkedin: string;
  portfolio: string;
  city: string;
}

export type Tone = "corporate" | "modern" | "creative";
export type TemplateId = "classic" | "modern" | "minimal";
export type PaletteId = "navy" | "emerald" | "graphite" | "burgundy" | "slate";

export interface Resume {
  photo: string | null; // cropped data URL
  photoRatio: "1:1" | "3:4";
  fullName: string;
  title: string;
  birthDate: string; // YYYY-MM-DD
  showAge: boolean;
  contacts: Contacts;
  jobs: Job[];
  education: Education[];
  courses: Course[];
  skills: Skill[];
  summary: string;
  strengths: Strength[];
}

export interface Settings {
  template: TemplateId;
  palette: PaletteId;
  tone: Tone;
}

export interface Draft {
  version: 1;
  resume: Resume;
  settings: Settings;
  step: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyJob = (): Job => ({
  id: uid(),
  company: "",
  position: "",
  start: "",
  end: "",
  current: false,
  notes: "",
  bullets: [],
});

export const emptyEducation = (): Education => ({
  id: uid(),
  institution: "",
  faculty: "",
  degree: "",
  year: "",
});

export const emptyCourse = (): Course => ({ id: uid(), name: "", issuer: "", year: "" });

export const emptyResume = (): Resume => ({
  photo: null,
  photoRatio: "1:1",
  fullName: "",
  title: "",
  birthDate: "",
  showAge: true,
  contacts: { phone: "", email: "", telegram: "", linkedin: "", portfolio: "", city: "" },
  // Fixed ids: this runs during prerender, where random values are not allowed.
  jobs: [{ id: "job-1", company: "", position: "", start: "", end: "", current: false, notes: "", bullets: [] }],
  education: [{ id: "edu-1", institution: "", faculty: "", degree: "", year: "" }],
  courses: [],
  skills: [],
  summary: "",
  strengths: [],
});

export const defaultSettings = (): Settings => ({
  template: "modern",
  palette: "navy",
  tone: "modern",
});
