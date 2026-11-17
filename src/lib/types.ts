// Data model from the technical specification, section 2 (ResumeDocument).

export type ToneOfVoice = "corporate" | "modern" | "creative";
export type TemplateId = "classic" | "modern" | "minimal";
export type ThemePaletteId = "deep_navy" | "emerald_green" | "graphite_dark" | "burgundy_wine" | "slate_blue";

export interface Experience {
  id: string;
  company: string;
  position: string;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM
  isCurrent: boolean;
  rawNotes: string;
  aiBullets: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  specialty: string;
  degree: string;
  graduationYear: number | null;
  isCourse: boolean;
}

export interface KeyStrength {
  title: string;
  description: string;
}

export interface ResumeDocument {
  meta: {
    id: string;
    updatedAt: string;
    template: TemplateId;
    theme: ThemePaletteId;
    tone: ToneOfVoice;
    /** Extension: "fit to one page" mode (spec 8.1), 9.5pt base font and 20% tighter spacing. */
    compact?: boolean;
  };
  personal: {
    photoUrl?: string;
    /** Extension: crop ratio chosen in the cropper, so templates size the photo correctly. */
    photoRatio?: "1:1" | "3:4";
    fullName: string;
    targetTitle: string;
    birthDate?: string;
    showAge: boolean;
    location?: string;
  };
  contacts: {
    phone?: string;
    email?: string;
    telegram?: string;
    linkedin?: string;
    portfolioUrl?: string;
  };
  aiGenerated: {
    summary: string;
    keyStrengths: KeyStrength[];
  };
  experience: Experience[];
  education: EducationItem[];
  skills: {
    hard: string[];
    soft: string[];
  };
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const emptyExperience = (): Experience => ({
  id: uid(),
  company: "",
  position: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  rawNotes: "",
  aiBullets: [],
});

export const emptyEducation = (isCourse = false): EducationItem => ({
  id: uid(),
  institution: "",
  specialty: "",
  degree: "",
  graduationYear: null,
  isCourse,
});

/** Fixed ids/dates: this also runs during prerender, where random values and clocks are not allowed. */
export const emptyResume = (): ResumeDocument => ({
  meta: { id: "draft", updatedAt: "", template: "modern", theme: "deep_navy", tone: "modern" },
  personal: { fullName: "", targetTitle: "", showAge: true, photoRatio: "1:1" },
  contacts: {},
  aiGenerated: { summary: "", keyStrengths: [] },
  experience: [{ id: "exp-1", company: "", position: "", startDate: "", endDate: "", isCurrent: false, rawNotes: "", aiBullets: [] }],
  education: [{ id: "edu-1", institution: "", specialty: "", degree: "", graduationYear: null, isCourse: false }],
  skills: { hard: [], soft: [] },
});
