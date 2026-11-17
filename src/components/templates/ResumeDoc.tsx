import { Children, type ReactNode } from "react";
import { ageFrom, contactItems, fmtPeriod, hasJob, jobBullets, type ContactItem } from "@/lib/format";
import { themeFor, type Theme } from "@/lib/palettes";
import type { KeyStrength, ResumeDocument } from "@/lib/types";
import { ICONS, type Prims, type Style } from "./base";

export const A4 = { width: 595.28, height: 841.89 };
/** Spec 6.2: 390 px wide mobile page. Units are 1:1 with px, so 15 = 15 px text. */
export const MOBILE_WIDTH = 390;

export type Variant = "a4" | "mobile";

/** In-place editing hooks (preview only, spec 7.2). */
export interface Editor {
  summary: (v: string) => void;
  strength: (i: number, key: keyof KeyStrength, v: string) => void;
  bullet: (jobId: string, i: number, v: string) => void;
}

export interface DocProps {
  doc: ResumeDocument;
  P: Prims;
  variant: Variant;
  /** Skeleton placeholders for AI blocks while generating (preview only). */
  loading?: boolean;
  edit?: Editor;
}

const FONTS = {
  // DESIGN 9.2
  classic: { body: "Roboto", head: "PT Serif" },
  modern: { body: "Roboto", head: "Roboto" },
  minimal: { body: "Roboto", head: "Montserrat" },
} as const;
type FontPair = (typeof FONTS)[keyof typeof FONTS];

/**
 * Shared building blocks, parameterised by primitives, theme, base font size and spacing scale.
 * Helpers are invoked through <Call>, so they are plain functions and never remount.
 */
function kit(P: Prims, t: Theme, fs: number, font: FontPair, k: number, edit?: Editor) {
  const body: Style = { fontFamily: font.body, fontSize: fs, lineHeight: 1.4, color: t.text };

  const Bullets = ({ job, color = t.primary, style = body }: { job: ResumeDocument["experience"][number]; color?: string; style?: Style }) => (
    <P.View>
      {jobBullets(job).map((b, i) => (
        <P.View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: fs * 0.25 * k }}>
          <P.Text style={{ ...style, width: fs * 0.95, color }}>•</P.Text>
          <P.Text style={{ ...style, flex: 1 }} onEdit={edit ? (v) => edit.bullet(job.id, i, v) : undefined}>
            {b}
          </P.Text>
        </P.View>
      ))}
    </P.View>
  );

  const Contact = ({ c, color, iconColor, size = fs }: { c: ContactItem; color: string; iconColor: string; size?: number }) => (
    <P.View style={{ flexDirection: "row", alignItems: "center", marginBottom: size * 0.45 * k }}>
      <P.View style={{ marginRight: size * 0.5 }}>
        <P.Icon d={ICONS[c.kind]} size={size * 1.05} color={iconColor} />
      </P.View>
      {c.href ? (
        <P.Link src={c.href} style={{ ...body, fontSize: size, color, flex: 1 }}>
          {c.label}
        </P.Link>
      ) : (
        <P.Text style={{ ...body, fontSize: size, color, flex: 1 }}>{c.label}</P.Text>
      )}
    </P.View>
  );

  const Chips = ({ items, bg, color, size = fs * 0.9, radius = 4 }: { items: string[]; bg: string; color: string; size?: number; radius?: number }) => (
    <P.View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((s, i) => (
        <P.View
          key={i}
          style={{ backgroundColor: bg, borderRadius: radius, paddingVertical: size * 0.25, paddingHorizontal: size * 0.6, marginRight: size * 0.4, marginBottom: size * 0.4 }}
        >
          <P.Text style={{ fontFamily: font.body, fontSize: size, color, lineHeight: 1.2 }}>{s}</P.Text>
        </P.View>
      ))}
    </P.View>
  );

  const Skeleton = ({ lines = 3 }: { lines?: number }) => (
    <P.View>
      {Array.from({ length: lines }).map((_, i) => (
        <P.View key={i} style={{ height: fs * 0.8, borderRadius: 3, backgroundColor: t.secondary, marginBottom: fs * 0.45, width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </P.View>
  );

  const Summary = ({ style = body, text }: { style?: Style; text: string }) => (
    <P.Text style={style} onEdit={edit?.summary}>
      {text}
    </P.Text>
  );

  const StrengthText = ({ s, i, titleStyle, descStyle }: { s: KeyStrength; i: number; titleStyle: Style; descStyle: Style }) => (
    <P.View>
      <P.Text style={titleStyle} onEdit={edit ? (v) => edit.strength(i, "title", v) : undefined}>
        {s.title}
      </P.Text>
      <P.Text style={descStyle} onEdit={edit ? (v) => edit.strength(i, "description", v) : undefined}>
        {s.description}
      </P.Text>
    </P.View>
  );

  return { body, Bullets, Contact, Chips, Skeleton, Summary, StrengthText };
}

type SectionFn = (p: { title: string; children: ReactNode }) => ReactNode;

/** Split section content so the title can be kept on the same page as the first item. */
function splitFirst(children: ReactNode) {
  const [first, ...rest] = Children.toArray(children);
  return { first, rest };
}

function EducationBlock({ doc, P, t, body, Section, k, compact }: { doc: ResumeDocument; P: Prims; t: Theme; body: Style; Section: SectionFn; k: number; compact?: boolean }) {
  const edu = doc.education.filter((e) => !e.isCourse && e.institution.trim());
  const courses = doc.education.filter((e) => e.isCourse && e.institution.trim());
  const year = (y: number | null) => (y ? String(y) : "");
  return (
    <>
      {edu.length ? (
        <Call fn={Section} title="Образование">
          {edu.map((e) => (
            <P.View key={e.id} wrap={false} style={{ marginBottom: 6 * k }}>
              <P.View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between" }}>
                <P.Text style={{ ...body, fontWeight: 700, flex: compact ? undefined : 1 }}>{e.institution}</P.Text>
                {e.graduationYear ? <P.Text style={{ ...body, color: t.muted, marginLeft: compact ? 0 : 8 }}>{year(e.graduationYear)}</P.Text> : null}
              </P.View>
              {e.specialty || e.degree ? <P.Text style={{ ...body, color: t.muted }}>{[e.specialty, e.degree].filter(Boolean).join(" · ")}</P.Text> : null}
            </P.View>
          ))}
        </Call>
      ) : null}
      {courses.length ? (
        <Call fn={Section} title="Курсы и сертификаты">
          {courses.map((c) => (
            <P.View key={c.id} wrap={false} style={{ marginBottom: 4 * k }}>
              <P.Text style={{ ...body, fontWeight: 700 }}>{c.institution}</P.Text>
              {c.specialty || c.graduationYear ? (
                <P.Text style={{ ...body, color: t.muted }}>{[c.specialty, year(c.graduationYear)].filter(Boolean).join(", ")}</P.Text>
              ) : null}
            </P.View>
          ))}
        </Call>
      ) : null}
    </>
  );
}

function skillGroups(doc: ResumeDocument) {
  const g: { label: string; items: string[] }[] = [];
  if (doc.skills.hard.length) g.push({ label: "Hard skills", items: doc.skills.hard });
  if (doc.skills.soft.length) g.push({ label: "Soft skills", items: doc.skills.soft });
  return g;
}

function headerFacts(doc: ResumeDocument): ContactItem[] {
  const age = doc.personal.showAge ? ageFrom(doc.personal.birthDate) : null;
  return age ? [{ kind: "age", label: age }] : [];
}

function sizing(doc: ResumeDocument) {
  // Spec 6.1: 10.5pt base, line-height 1.4; spec 8.1: "fit to one page" drops to 9.5pt and 20% tighter spacing.
  return doc.meta.compact ? { fs: 9.5, k: 0.8 } : { fs: 10.5, k: 1 };
}

const PAGE_MARGIN = 34; // 12 mm

/* ------------------------------------------------------------------------ */

function Classic({ doc, P, loading, edit }: DocProps) {
  const t = themeFor(doc.meta.theme);
  const font = FONTS.classic;
  const { fs, k } = sizing(doc);
  const { body, Bullets, Skeleton, Summary, StrengthText } = kit(P, t, fs, font, k, edit);
  const facts = [...headerFacts(doc), ...contactItems(doc)];
  const { personal: p, aiGenerated: ai } = doc;
  const m = PAGE_MARGIN * (doc.meta.compact ? 0.8 : 1) + 6;

  const Section: SectionFn = ({ title, children }) => {
    const { first, rest } = splitFirst(children);
    return (
      <P.View style={{ marginTop: 14 * k }}>
        <P.View wrap={false}>
          <P.Text style={{ fontFamily: font.head, fontSize: fs + 1.5, fontWeight: 700, color: t.primary }}>{title}</P.Text>
          <P.View style={{ height: 0.75, backgroundColor: t.primary, marginTop: 3, marginBottom: 7 * k }} />
          {first}
        </P.View>
        {rest}
      </P.View>
    );
  };

  return (
    <P.Page size={A4} style={{ paddingVertical: m, paddingHorizontal: m + 8, ...body }}>
      <P.View style={{ flexDirection: "row", alignItems: "center" }}>
        {p.photoUrl ? (
          <P.Image src={p.photoUrl} style={{ width: 76, height: p.photoRatio === "3:4" ? 101 : 76, objectFit: "cover", marginRight: 18, borderRadius: 2 }} />
        ) : null}
        <P.View style={{ flex: 1 }}>
          <P.Text style={{ fontFamily: font.head, fontSize: 22, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{p.fullName || "Имя Фамилия"}</P.Text>
          <P.Text style={{ ...body, fontSize: fs + 2.5, fontWeight: 500, color: t.primary, marginTop: 3 }}>{p.targetTitle || "Желаемая должность"}</P.Text>
          <P.View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 7 }}>
            {facts.map((c, i) => (
              <P.View key={i} style={{ flexDirection: "row", marginRight: 12, marginBottom: 2 }}>
                {c.href ? (
                  <P.Link src={c.href} style={{ ...body, fontSize: fs - 1, color: t.muted }}>
                    {c.label}
                  </P.Link>
                ) : (
                  <P.Text style={{ ...body, fontSize: fs - 1, color: t.muted }}>{c.label}</P.Text>
                )}
              </P.View>
            ))}
          </P.View>
        </P.View>
      </P.View>

      {ai.summary || loading ? (
        <Call fn={Section} title="О себе">
          {ai.summary ? <Call fn={Summary} text={ai.summary} /> : <Call fn={Skeleton} />}
        </Call>
      ) : null}

      {ai.keyStrengths.length || loading ? (
        <Call fn={Section} title="Сильные стороны">
          {ai.keyStrengths.length ? (
            ai.keyStrengths.map((s, i) => (
              <P.View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: 5 * k }}>
                <P.Text style={{ ...body, width: 12, color: t.primary }}>•</P.Text>
                <P.View style={{ flex: 1 }}>
                  <Call fn={StrengthText} s={s} i={i} titleStyle={{ ...body, fontWeight: 700 }} descStyle={body} />
                </P.View>
              </P.View>
            ))
          ) : (
            <Call fn={Skeleton} />
          )}
        </Call>
      ) : null}

      {doc.experience.some(hasJob) ? (
        <Call fn={Section} title="Опыт работы">
          {doc.experience.filter(hasJob).map((j) => (
            <P.View key={j.id} style={{ marginBottom: 9 * k }}>
              <P.View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                <P.Text style={{ ...body, fontWeight: 700, flex: 1 }}>
                  {j.position}
                  {j.company ? <P.Text style={{ fontWeight: 400, color: t.muted }}>{(j.position ? " — " : "") + j.company}</P.Text> : null}
                </P.Text>
                <P.Text style={{ ...body, fontSize: fs - 1, color: t.muted, marginLeft: 8 }}>{fmtPeriod(j)}</P.Text>
              </P.View>
              <P.View style={{ marginTop: 3 }}>
                <Call fn={Bullets} job={j} />
              </P.View>
            </P.View>
          ))}
        </Call>
      ) : null}

      {skillGroups(doc).length ? (
        <Call fn={Section} title="Навыки">
          {skillGroups(doc).map((g, i) => (
            <P.Text key={i} style={{ ...body, marginBottom: 3 }}>
              <P.Text style={{ fontWeight: 700 }}>{g.label}: </P.Text>
              {g.items.join(", ")}
            </P.Text>
          ))}
        </Call>
      ) : null}

      <EducationBlock doc={doc} P={P} t={t} body={body} Section={Section} k={k} />
    </P.Page>
  );
}

/* ------------------------------------------------------------------------ */

function Modern({ doc, P, loading, edit }: DocProps) {
  const t = themeFor(doc.meta.theme);
  const font = FONTS.modern;
  const { fs, k } = sizing(doc);
  const SIDE = Math.round(A4.width * 0.32); // spec: grid 32% / 68%
  const { body, Bullets, Contact, Chips, Skeleton, Summary, StrengthText } = kit(P, t, fs, font, k, edit);
  const { personal: p, aiGenerated: ai } = doc;
  const m = PAGE_MARGIN * (doc.meta.compact ? 0.8 : 1);
  const side: Style = { ...body, fontSize: fs - 0.5, color: t.onSidebar };
  const sideTheme: Theme = { ...t, text: t.onSidebar, muted: t.onSidebarMuted };

  const SideTitle = ({ children }: { children: string }) => (
    <P.View wrap={false} style={{ marginTop: 16 * k, marginBottom: 7 * k }}>
      <P.Text style={{ fontFamily: font.head, fontSize: fs - 0.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: t.onSidebar }}>
        {children}
      </P.Text>
      <P.View style={{ height: 1, width: 22, backgroundColor: t.onSidebarMuted, marginTop: 4 }} />
    </P.View>
  );
  const SideSection: SectionFn = ({ title, children }) => (
    <P.View>
      <Call fn={SideTitle}>{title}</Call>
      {children}
    </P.View>
  );

  const Section: SectionFn = ({ title, children }) => {
    const { first, rest } = splitFirst(children);
    return (
      <P.View style={{ marginTop: 16 * k }}>
        <P.View wrap={false}>
          <P.View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 * k }}>
            <P.Text style={{ fontFamily: font.head, fontSize: fs + 1.5, fontWeight: 700, color: t.primary, letterSpacing: 0.4, textTransform: "uppercase" }}>
              {title}
            </P.Text>
            <P.View style={{ flex: 1, height: 1, backgroundColor: t.rule, marginLeft: 8 }} />
          </P.View>
          {first}
        </P.View>
        {rest}
      </P.View>
    );
  };

  return (
    // The sidebar is absolutely positioned on page 1 and the main column flows with a left padding:
    // react-pdf cannot split a two-column row across pages.
    <P.Page size={A4} style={{ paddingTop: m, paddingBottom: m, paddingLeft: SIDE + 22, paddingRight: m, ...body }}>
      {/* Zero-height fixed wrapper: react-pdf refuses fixed nodes taller than the page's content box. */}
      <P.View fixed style={{ position: "absolute", top: 0, left: 0, width: SIDE, height: 0 }}>
        <P.View style={{ position: "absolute", top: 0, left: 0, width: SIDE, height: A4.height, backgroundColor: t.sidebar }} />
      </P.View>
      <P.View style={{ position: "absolute", top: m, left: 0, width: SIDE, paddingHorizontal: 18 }}>
        {p.photoUrl ? (
          <P.Image
            src={p.photoUrl}
            style={{ width: 112, height: p.photoRatio === "3:4" ? 149 : 112, borderRadius: p.photoRatio === "3:4" ? 8 : 56, objectFit: "cover", alignSelf: "center", marginBottom: 4 }}
          />
        ) : null}
        <Call fn={SideTitle}>Контакты</Call>
        {[...headerFacts(doc), ...contactItems(doc)].map((c, i) => (
          <Call key={i} fn={Contact} c={c} color={t.onSidebar} iconColor={t.onSidebar} size={fs - 0.5} />
        ))}
        {skillGroups(doc).map((g, i) => (
          <P.View key={i}>
            <Call fn={SideTitle}>{g.label}</Call>
            <Call fn={Chips} items={g.items} bg={t.chipBg} color={t.chipText} size={fs - 1.5} radius={3} />
          </P.View>
        ))}
        <EducationBlock doc={doc} P={P} t={sideTheme} body={side} Section={SideSection} k={k} compact />
      </P.View>

      <P.View>
        <P.Text style={{ fontFamily: font.head, fontSize: 25, fontWeight: 700, color: t.text, lineHeight: 1.15 }}>{p.fullName || "Имя Фамилия"}</P.Text>
        <P.Text style={{ ...body, fontSize: fs + 3, fontWeight: 500, color: t.primary, marginTop: 4 }}>{p.targetTitle || "Желаемая должность"}</P.Text>

        {ai.summary || loading ? (
          <Call fn={Section} title="О себе">
            {ai.summary ? <Call fn={Summary} text={ai.summary} /> : <Call fn={Skeleton} />}
          </Call>
        ) : null}

        {ai.keyStrengths.length || loading ? (
          <Call fn={Section} title="Сильные стороны">
            {ai.keyStrengths.length ? (
              <P.View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -8 }}>
                {ai.keyStrengths.map((s, i) => (
                  <P.View key={i} wrap={false} style={{ width: "50%", paddingRight: 8, marginBottom: 8 * k }}>
                    <P.View style={{ backgroundColor: t.secondary, paddingVertical: 7 * k, paddingHorizontal: 9, borderLeftWidth: 2.5, borderLeftColor: t.primary, borderLeftStyle: "solid" }}>
                      <Call fn={StrengthText} s={s} i={i} titleStyle={{ ...body, fontWeight: 700, color: t.onSecondary }} descStyle={{ ...body, fontSize: fs - 1 }} />
                    </P.View>
                  </P.View>
                ))}
              </P.View>
            ) : (
              <Call fn={Skeleton} lines={4} />
            )}
          </Call>
        ) : null}

        {doc.experience.some(hasJob) ? (
          <Call fn={Section} title="Опыт работы">
            {doc.experience.filter(hasJob).map((j) => (
              <P.View key={j.id} style={{ marginBottom: 10 * k }}>
                <P.View wrap={false}>
                  <P.View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <P.Text style={{ ...body, fontSize: fs + 0.5, fontWeight: 700, flex: 1 }}>{j.position}</P.Text>
                    <P.Text style={{ ...body, fontSize: fs - 1.5, color: t.muted, marginLeft: 6 }}>{fmtPeriod(j)}</P.Text>
                  </P.View>
                  <P.Text style={{ ...body, color: t.primary, fontWeight: 500, marginBottom: 3 }}>{j.company}</P.Text>
                </P.View>
                <Call fn={Bullets} job={j} />
              </P.View>
            ))}
          </Call>
        ) : null}
      </P.View>
    </P.Page>
  );
}

/* ------------------------------------------------------------------------ */

function Minimal({ doc, P, loading, edit }: DocProps) {
  const t = themeFor(doc.meta.theme);
  const font = FONTS.minimal;
  const { fs, k } = sizing(doc);
  const LABEL = 100;
  const { body, Bullets, Skeleton, Summary, StrengthText } = kit(P, t, fs, font, k, edit);
  const { personal: p, aiGenerated: ai } = doc;
  const m = PAGE_MARGIN * (doc.meta.compact ? 0.8 : 1) + 8;

  const Section: SectionFn = ({ title, children }) => {
    const { first, rest } = splitFirst(children);
    return (
      <P.View style={{ marginTop: 18 * k }}>
        <P.View wrap={false} style={{ flexDirection: "row" }}>
          <P.View style={{ width: LABEL, paddingRight: 10 }}>
            <P.Text style={{ fontFamily: font.head, fontSize: fs - 1.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: t.primary, lineHeight: 1.3 }}>
              {title}
            </P.Text>
          </P.View>
          <P.View style={{ flex: 1 }}>{first}</P.View>
        </P.View>
        {rest.length ? <P.View style={{ marginLeft: LABEL }}>{rest}</P.View> : null}
      </P.View>
    );
  };

  return (
    <P.Page size={A4} style={{ paddingVertical: m, paddingHorizontal: m, ...body }}>
      <P.View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <P.View style={{ flex: 1, paddingRight: 16 }}>
          <P.View style={{ width: 40, height: 4, backgroundColor: t.primary, marginBottom: 14 * k }} />
          <P.Text style={{ fontFamily: font.head, fontSize: 34, fontWeight: 800, color: t.text, lineHeight: 1.08, letterSpacing: -0.8 }}>{p.fullName || "Имя Фамилия"}</P.Text>
          <P.Text style={{ fontFamily: font.head, fontSize: fs + 3, fontWeight: 600, color: t.primary, marginTop: 8 }}>{p.targetTitle || "Желаемая должность"}</P.Text>
          <P.View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 * k }}>
            {[...headerFacts(doc), ...contactItems(doc)].map((c, i) => (
              <P.View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 4 }}>
                <P.View style={{ marginRight: 4 }}>
                  <P.Icon d={ICONS[c.kind]} size={fs - 1} color={t.primary} />
                </P.View>
                {c.href ? (
                  <P.Link src={c.href} style={{ ...body, fontSize: fs - 1.5, color: t.text }}>
                    {c.label}
                  </P.Link>
                ) : (
                  <P.Text style={{ ...body, fontSize: fs - 1.5, color: t.text }}>{c.label}</P.Text>
                )}
              </P.View>
            ))}
          </P.View>
        </P.View>
        {p.photoUrl ? <P.Image src={p.photoUrl} style={{ width: 118, height: p.photoRatio === "3:4" ? 157 : 118, objectFit: "cover", borderRadius: 4 }} /> : null}
      </P.View>

      {ai.summary || loading ? (
        <P.View style={{ marginTop: 22 * k }}>
          {ai.summary ? <Call fn={Summary} text={ai.summary} style={{ ...body, fontSize: fs + 1.5, lineHeight: 1.5 }} /> : <Call fn={Skeleton} />}
        </P.View>
      ) : null}

      {ai.keyStrengths.length || loading ? (
        <P.View style={{ marginTop: 16 * k }}>
          {ai.keyStrengths.length ? (
            <P.View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -12 }}>
              {ai.keyStrengths.map((s, i) => (
                <P.View key={i} wrap={false} style={{ width: "50%", paddingRight: 12, marginBottom: 10 * k }}>
                  {/* DESIGN 9.1: strengths with a 2–3 pt accent line on the left */}
                  <P.View style={{ borderLeftWidth: 3, borderLeftColor: t.primary, borderLeftStyle: "solid", paddingLeft: 9 }}>
                    <Call
                      fn={StrengthText}
                      s={s}
                      i={i}
                      titleStyle={{ fontFamily: font.head, fontSize: fs + 0.5, fontWeight: 700, color: t.text, lineHeight: 1.3 }}
                      descStyle={{ ...body, fontSize: fs - 1, color: t.muted, marginTop: 2 }}
                    />
                  </P.View>
                </P.View>
              ))}
            </P.View>
          ) : (
            <Call fn={Skeleton} lines={4} />
          )}
        </P.View>
      ) : null}

      {doc.experience.some(hasJob) ? (
        <Call fn={Section} title="Опыт">
          {doc.experience.filter(hasJob).map((j) => (
            <P.View key={j.id} style={{ marginBottom: 11 * k }}>
              <P.View wrap={false}>
                <P.Text style={{ fontFamily: font.head, fontSize: fs + 0.5, fontWeight: 700, color: t.text }}>
                  {j.position}
                  {j.company ? <P.Text style={{ color: t.primary }}>{(j.position ? " · " : "") + j.company}</P.Text> : null}
                </P.Text>
                <P.Text style={{ ...body, fontSize: fs - 1.5, color: t.muted, marginBottom: 3 }}>{fmtPeriod(j)}</P.Text>
              </P.View>
              <Call fn={Bullets} job={j} />
            </P.View>
          ))}
        </Call>
      ) : null}

      {skillGroups(doc).length ? (
        <Call fn={Section} title="Навыки">
          {skillGroups(doc).map((g, i) => (
            <P.View key={i} style={{ marginBottom: 4 * k }}>
              <P.Text style={{ ...body, fontSize: fs - 1.5, color: t.muted, marginBottom: 2 }}>{g.label}</P.Text>
              <P.Text style={body}>{g.items.join("  /  ")}</P.Text>
            </P.View>
          ))}
        </Call>
      ) : null}

      <EducationBlock doc={doc} P={P} t={t} body={body} Section={Section} k={k} />
    </P.Page>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * Spec 6.2 mobile layout: forced single column, template fonts/colours kept.
 * Order: header → quick contact buttons → strengths → summary → experience → skills → education.
 */
function Mobile({ doc, P, loading, edit }: DocProps) {
  const tpl = doc.meta.template;
  const t = themeFor(doc.meta.theme);
  const font = FONTS[tpl];
  const fs = 15;
  const radius = tpl === "classic" ? 4 : 8;
  const { Bullets, Chips, Skeleton, Summary, StrengthText } = kit(P, t, fs, font, 1, edit);
  const b: Style = { fontFamily: font.body, fontSize: fs, lineHeight: 1.55, color: t.text };
  const { personal: p, aiGenerated: ai } = doc;
  const age = p.showAge ? ageFrom(p.birthDate) : null;
  const sub = [age, p.location?.trim()].filter(Boolean).join(" · ");
  const contacts = contactItems(doc, false);
  const GAP = 20;

  // DESIGN 9.4: 13 pt caps titles in the accent colour, 20 pt between sections.
  const Section: SectionFn = ({ title, children }) => (
    <P.View style={{ marginTop: GAP }}>
      <P.Text style={{ fontFamily: font.head, fontSize: 13, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: t.primary, marginBottom: 10 }}>{title}</P.Text>
      {children}
    </P.View>
  );

  return (
    <P.Page size={{ width: MOBILE_WIDTH }} style={{ paddingTop: 20, paddingBottom: 20, paddingHorizontal: 16, ...b }}>
      {/* 1. Header */}
      <P.View style={{ backgroundColor: t.secondary, borderRadius: radius, padding: 18, alignItems: "center" }}>
        {p.photoUrl ? (
          <P.Image src={p.photoUrl} style={{ width: 88, height: 88, borderRadius: 16, objectFit: "cover", marginBottom: 12 }} />
        ) : null}
        <P.Text style={{ fontFamily: font.head, fontSize: 24, fontWeight: 800, color: t.text, textAlign: "center", lineHeight: 1.2 }}>{p.fullName || "Имя Фамилия"}</P.Text>
        <P.Text style={{ ...b, fontSize: 16, fontWeight: 700, color: t.onSecondary, textAlign: "center", marginTop: 4 }}>{p.targetTitle || "Желаемая должность"}</P.Text>
        {sub ? <P.Text style={{ ...b, fontSize: 14, color: t.muted, textAlign: "center", marginTop: 2 }}>{sub}</P.Text> : null}
      </P.View>

      {/* 2. Quick contact buttons */}
      {contacts.length ? (
        <P.View style={{ marginTop: GAP }}>
          {contacts.map((c, i) => (
            <P.Link key={i} src={c.href!} style={{ textDecoration: "none" }}>
              {/* DESIGN 9.4: 44 pt rows, tint background, radius 8, the whole row is the link. */}
              <P.View style={{ flexDirection: "row", alignItems: "center", minHeight: 44, backgroundColor: t.secondary, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 8 }}>
                <P.View style={{ marginRight: 12 }}>
                  <P.Icon d={ICONS[c.kind]} size={18} color={t.primary} />
                </P.View>
                <P.Text style={{ ...b, fontSize: 15, fontWeight: 700, lineHeight: 1.25, color: t.onSecondary, flex: 1 }}>{c.action}</P.Text>
                <P.Text style={{ ...b, fontSize: 13, lineHeight: 1.3, color: t.muted, marginLeft: 8, maxWidth: 150, textAlign: "right" }}>{c.label}</P.Text>
              </P.View>
            </P.Link>
          ))}
        </P.View>
      ) : null}

      {/* 3. Strengths */}
      {ai.keyStrengths.length || loading ? (
        <Call fn={Section} title="Сильные стороны">
          {ai.keyStrengths.length ? (
            ai.keyStrengths.map((s, i) => (
              <P.View key={i} style={{ backgroundColor: t.secondary, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: t.primary, borderLeftStyle: "solid" }}>
                <Call fn={StrengthText} s={s} i={i} titleStyle={{ ...b, fontWeight: 700, color: t.onSecondary }} descStyle={b} />
              </P.View>
            ))
          ) : (
            <Call fn={Skeleton} lines={4} />
          )}
        </Call>
      ) : null}

      {/* 4. Summary */}
      {ai.summary || loading ? (
        <Call fn={Section} title="О себе">
          {ai.summary ? <Call fn={Summary} text={ai.summary} style={b} /> : <Call fn={Skeleton} />}
        </Call>
      ) : null}

      {/* 5. Experience timeline */}
      {doc.experience.some(hasJob) ? (
        <Call fn={Section} title="Опыт работы">
          {doc.experience.filter(hasJob).map((j, idx, arr) => (
            <P.View key={j.id} style={{ flexDirection: "row" }}>
              <P.View style={{ width: 18, alignItems: "center" }}>
                <P.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.primary, marginTop: 7 }} />
                {idx < arr.length - 1 ? <P.View style={{ width: 2, flex: 1, backgroundColor: t.rule, marginTop: 4 }} /> : null}
              </P.View>
              <P.View style={{ flex: 1, paddingLeft: 10, paddingBottom: 18 }}>
                <P.Text style={{ ...b, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{j.position}</P.Text>
                <P.Text style={{ ...b, fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: t.primary }}>{j.company}</P.Text>
                <P.Text style={{ ...b, fontSize: 13, color: t.muted, marginBottom: 6 }}>{fmtPeriod(j)}</P.Text>
                <Call fn={Bullets} job={j} style={b} />
              </P.View>
            </P.View>
          ))}
        </Call>
      ) : null}

      {/* 6. Skills */}
      {skillGroups(doc).length ? (
        <Call fn={Section} title="Навыки">
          {skillGroups(doc).map((g, i) => (
            <P.View key={i} style={{ marginBottom: 6 }}>
              <P.Text style={{ ...b, fontSize: 13, color: t.muted, marginBottom: 6 }}>{g.label}</P.Text>
              {tpl === "modern" ? (
                <Call fn={Chips} items={g.items} bg={t.secondary} color={t.onSecondary} size={14} radius={3} />
              ) : (
                <P.Text style={b}>{g.items.join(" · ")}</P.Text>
              )}
            </P.View>
          ))}
        </Call>
      ) : null}

      {/* 7. Education and courses */}
      <EducationBlock doc={doc} P={P} t={t} body={b} Section={Section} k={1} compact />
    </P.Page>
  );
}

export function ResumeDoc(props: DocProps) {
  if (props.variant === "mobile") return <Mobile {...props} />;
  switch (props.doc.meta.template) {
    case "classic":
      return <Classic {...props} />;
    case "minimal":
      return <Minimal {...props} />;
    default:
      return <Modern {...props} />;
  }
}

/**
 * Invokes a template helper as a plain function so its identity never changes
 * between renders (helpers are created per theme inside each template).
 */
function Call<T extends object>({ fn, ...props }: { fn: (p: T) => ReactNode } & T) {
  return <>{fn(props as unknown as T)}</>;
}
