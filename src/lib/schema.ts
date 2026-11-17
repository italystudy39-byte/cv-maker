import { z } from "zod";

// Zod mirror of ResumeDocument (spec 2), used to validate API input.
const s = (max: number) => z.string().max(max);

export const ToneSchema = z.enum(["corporate", "modern", "creative"]);

export const ExperienceSchema = z.object({
  id: s(64),
  company: s(200),
  position: s(200),
  startDate: s(10),
  endDate: s(10).optional(),
  isCurrent: z.boolean(),
  rawNotes: s(5000),
  aiBullets: z.array(s(800)).max(20),
});

export const ResumeDocumentSchema = z.object({
  meta: z.object({
    id: s(64),
    updatedAt: s(40),
    template: z.enum(["classic", "modern", "minimal"]),
    theme: z.enum(["deep_navy", "emerald_green", "graphite_dark", "burgundy_wine", "slate_blue"]),
    tone: ToneSchema,
    compact: z.boolean().optional(),
  }),
  personal: z.object({
    photoUrl: z.string().max(3_000_000).optional(),
    photoRatio: z.enum(["1:1", "3:4"]).optional(),
    fullName: s(100),
    targetTitle: s(200),
    birthDate: s(10).optional(),
    showAge: z.boolean(),
    location: s(100).optional(),
  }),
  contacts: z.object({
    phone: s(40).optional(),
    email: s(200).optional(),
    telegram: s(200).optional(),
    linkedin: s(300).optional(),
    portfolioUrl: s(300).optional(),
  }),
  aiGenerated: z.object({
    summary: s(3000),
    keyStrengths: z.array(z.object({ title: s(200), description: s(800) })).max(8),
  }),
  experience: z.array(ExperienceSchema).max(20),
  education: z
    .array(
      z.object({
        id: s(64),
        institution: s(300),
        specialty: s(300),
        degree: s(200),
        graduationYear: z.number().int().min(1900).max(2100).nullable(),
        isCourse: z.boolean(),
      }),
    )
    .max(30),
  skills: z.object({ hard: z.array(s(80)).max(60), soft: z.array(s(80)).max(60) }),
});

export type ResumeDocumentInput = z.infer<typeof ResumeDocumentSchema>;
