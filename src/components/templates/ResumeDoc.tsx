import type { ReactNode } from "react";
import { ageFrom, contactItems, fmtPeriod, jobBullets, type ContactItem } from "@/lib/format";
import { themeFor, type Theme } from "@/lib/palettes";
import type { Resume, Settings, Skill } from "@/lib/types";
import { ICONS, type Prims, type Style } from "./prims";

export const A4 = { width: 595.28, height: 841.89 };
export const MOBILE_WIDTH = 360;

export type Variant = "a4" | "mobile";

export interface DocProps {
  resume: Resume;
  settings: Settings;
  P: Prims;
  variant: Variant;
  /** Show skeleton placeholders for AI blocks (preview only). */
  loading?: boolean;
}

const FONTS = {
  classic: { body: "PTSerif", head: "PTSerif" },
  modern: { body: "Roboto", head: "Roboto" },
  minimal: { body: "Roboto", head: "Montserrat" },
} as const;

function groupSkills(skills: Skill[]) {
  const hard = skills.filter((s) => s.kind === "hard").map((s) => s.name);
  const soft = skills.filter((s) => s.kind === "soft").map((s) => s.name);
  const other = skills.filter((s) => !s.kind).map((s) => s.name);
  const groups: { label: string; items: string[] }[] = [];
  if (hard.length || soft.length) {
    if (hard.length || other.length) groups.push({ label: "Hard skills", items: [...hard, ...other] });
    if (soft.length) groups.push({ label: "Soft skills", items: soft });
  } else if (other.length) groups.push({ label: "", items: other });
  return groups;
}

/** Shared building blocks, parameterised by primitives, theme and scale. */
function kit(P: Prims, t: Theme, fs: number, font: { body: string; head: string }) {
  const lh = 1.38;
  const body: Style = { fontFamily: font.body, fontSize: fs, lineHeight: lh, color: t.text };

  const Bullets = ({ items, color = t.accent }: { items: string[]; color?: string }) => (
    <P.View>
      {items.map((b, i) => (
        <P.View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: fs * 0.22 }}>
          <P.Text style={{ ...body, width: fs * 0.9, color }}>•</P.Text>
          <P.Text style={{ ...body, flex: 1 }}>{b}</P.Text>
        </P.View>
      ))}
    </P.View>
  );

  const Contact = ({ c, color, iconColor, size = fs }: { c: ContactItem; color: string; iconColor: string; size?: number }) => {
    const label = <P.Text style={{ ...body, fontSize: size, color, flex: 1 }}>{c.label}</P.Text>;
    return (
      <P.View style={{ flexDirection: "row", alignItems: "center", marginBottom: size * 0.45 }}>
        <P.View style={{ marginRight: size * 0.5 }}>
          <P.Icon d={ICONS[c.kind]} size={size * 1.05} color={iconColor} />
        </P.View>
        {c.href ? (
          <P.Link src={c.href} style={{ ...body, fontSize: size, color, flex: 1 }}>
            {c.label}
          </P.Link>
        ) : (
          label
        )}
      </P.View>
    );
  };

  const Chips = ({ items, bg, color, size = fs * 0.92 }: { items: string[]; bg: string; color: string; size?: number }) => (
    <P.View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((s, i) => (
        <P.View
          key={i}
          style={{ backgroundColor: bg, borderRadius: 3, paddingVertical: size * 0.22, paddingHorizontal: size * 0.55, marginRight: size * 0.4, marginBottom: size * 0.4 }}
        >
          <P.Text style={{ fontFamily: font.body, fontSize: size, color, lineHeight: 1.2 }}>{s}</P.Text>
        </P.View>
      ))}
    </P.View>
  );

  const Skeleton = ({ lines = 3 }: { lines?: number }) => (
    <P.View>
      {Array.from({ length: lines }).map((_, i) => (
        <P.View
          key={i}
          style={{ height: fs * 0.8, borderRadius: 3, backgroundColor: t.tint, marginBottom: fs * 0.45, width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </P.View>
  );

  return { body, lh, Bullets, Contact, Chips, Skeleton };
}

/* ------------------------------------------------------------------------ */

function Classic({ resume: r, settings, P, loading }: DocProps) {
  const t = themeFor(settings.palette);
  const font = FONTS.classic;
  const fs = 10.5;
  const { body, Bullets, Skeleton } = kit(P, t, fs, font);
  const contacts = contactItems(r.contacts);
  const age = r.showAge ? ageFrom(r.birthDate) : null;

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <P.View style={{ marginTop: 14 }}>
      <P.View wrap={false}>
        <P.Text style={{ fontFamily: font.head, fontSize: 11.5, fontWeight: 700, color: t.accent, letterSpacing: 1.2, textTransform: "uppercase" }}>
          {title}
        </P.Text>
        <P.View style={{ height: 0.8, backgroundColor: t.accent, marginTop: 3, marginBottom: 7 }} />
      </P.View>
      {children}
    </P.View>
  );

  return (
    <P.Page size={A4} style={{ paddingTop: 40, paddingBottom: 40, paddingHorizontal: 48, ...body }}>
      <P.View style={{ flexDirection: "row", alignItems: "center" }}>
        {r.photo ? (
          <P.Image
            src={r.photo}
            style={{ width: 74, height: r.photoRatio === "3:4" ? 98 : 74, objectFit: "cover", marginRight: 18, borderRadius: 2 }}
          />
        ) : null}
        <P.View style={{ flex: 1 }}>
          <P.Text style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: t.text, lineHeight: 1.15 }}>{r.fullName || "Имя Фамилия"}</P.Text>
          <P.Text style={{ ...body, fontSize: 13, color: t.accent, marginTop: 3 }}>{r.title || "Желаемая должность"}</P.Text>
          <P.View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 7 }}>
            {[...(age ? [{ kind: "age" as const, label: age }] : []), ...contacts].map((c, i) => (
              <P.View key={i} style={{ flexDirection: "row", marginRight: 12, marginBottom: 2 }}>
                {"href" in c && c.href ? (
                  <P.Link src={c.href} style={{ ...body, fontSize: 9.5, color: t.muted }}>
                    {c.label}
                  </P.Link>
                ) : (
                  <P.Text style={{ ...body, fontSize: 9.5, color: t.muted }}>{c.label}</P.Text>
                )}
              </P.View>
            ))}
          </P.View>
        </P.View>
      </P.View>

      {r.summary || loading ? (
        <Call fn={Section} title="О себе">{r.summary ? <P.Text style={body}>{r.summary}</P.Text> : <Call fn={Skeleton} />}</Call>
      ) : null}

      {r.strengths.length || loading ? (
        <Call fn={Section} title="Ключевые компетенции">
          {r.strengths.length ? (
            r.strengths.map((s, i) => (
              <P.View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: 4 }}>
                <P.Text style={{ ...body, width: 12, color: t.accent }}>•</P.Text>
                <P.Text style={{ ...body, flex: 1 }}>
                  <P.Text style={{ fontWeight: 700 }}>{s.title}. </P.Text>
                  {s.description}
                </P.Text>
              </P.View>
            ))
          ) : (
            <Call fn={Skeleton} lines={3} />
          )}
        </Call>
      ) : null}

      {r.jobs.some((j) => j.company || j.position) ? (
        <Call fn={Section} title="Опыт работы">
          {r.jobs
            .filter((j) => j.company || j.position)
            .map((j) => (
              <P.View key={j.id} style={{ marginBottom: 9 }}>
                <P.View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <P.Text style={{ ...body, fontWeight: 700, flex: 1 }}>
                    {j.position}
                    {j.company ? <P.Text style={{ fontWeight: 400, fontStyle: "italic" }}>{(j.position ? ", " : "") + j.company}</P.Text> : null}
                  </P.Text>
                  <P.Text style={{ ...body, fontSize: 9.5, color: t.muted, marginLeft: 8 }}>{fmtPeriod(j)}</P.Text>
                </P.View>
                <P.View style={{ marginTop: 3 }}>
                  <Call fn={Bullets} items={jobBullets(j)} />
                </P.View>
              </P.View>
            ))}
        </Call>
      ) : null}

      {r.skills.length ? (
        <Call fn={Section} title="Навыки">
          {groupSkills(r.skills).map((g, i) => (
            <P.Text key={i} style={{ ...body, marginBottom: 3 }}>
              {g.label ? <P.Text style={{ fontWeight: 700 }}>{g.label}: </P.Text> : null}
              {g.items.join(", ")}
            </P.Text>
          ))}
        </Call>
      ) : null}

      <EducationBlock {...{ r, P, t, body, Section }} />
    </P.Page>
  );
}

function EducationBlock({
  r,
  P,
  t,
  body,
  Section,
  compact,
}: {
  r: Resume;
  P: Prims;
  t: Theme;
  body: Style;
  Section: (p: { title: string; children: ReactNode }) => ReactNode;
  compact?: boolean;
}) {
  const edu = r.education.filter((e) => e.institution);
  const courses = r.courses.filter((c) => c.name);
  return (
    <>
      {edu.length ? (
        <Call fn={Section} title="Образование">
          {edu.map((e) => (
            <P.View key={e.id} wrap={false} style={{ marginBottom: 6 }}>
              <P.View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between" }}>
                <P.Text style={{ ...body, fontWeight: 700, flex: compact ? undefined : 1 }}>{e.institution}</P.Text>
                {e.year ? <P.Text style={{ ...body, color: t.muted, marginLeft: compact ? 0 : 8 }}>{e.year}</P.Text> : null}
              </P.View>
              {e.faculty || e.degree ? (
                <P.Text style={{ ...body, color: t.muted }}>{[e.faculty, e.degree].filter(Boolean).join(" · ")}</P.Text>
              ) : null}
            </P.View>
          ))}
        </Call>
      ) : null}
      {courses.length ? (
        <Call fn={Section} title="Курсы и сертификаты">
          {courses.map((c) => (
            <P.View key={c.id} wrap={false} style={{ marginBottom: 4 }}>
              <P.Text style={body}>
                <P.Text style={{ fontWeight: 700 }}>{c.name}</P.Text>
                {[c.issuer, c.year].filter(Boolean).length ? " — " + [c.issuer, c.year].filter(Boolean).join(", ") : ""}
              </P.Text>
            </P.View>
          ))}
        </Call>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Modern({ resume: r, settings, P, loading }: DocProps) {
  const t = themeFor(settings.palette);
  const font = FONTS.modern;
  const fs = 10;
  const SIDE = 188;
  const { body, Bullets, Contact, Chips, Skeleton } = kit(P, t, fs, font);
  const contacts = contactItems(r.contacts);
  const age = r.showAge ? ageFrom(r.birthDate) : null;

  const SideTitle = ({ children }: { children: string }) => (
    <P.View wrap={false} style={{ marginTop: 16, marginBottom: 7 }}>
      <P.Text style={{ fontFamily: font.head, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: t.onSidebar }}>
        {children}
      </P.Text>
      <P.View style={{ height: 1.5, width: 22, backgroundColor: t.onSidebar, marginTop: 4, opacity: 0.6 }} />
    </P.View>
  );

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <P.View style={{ marginTop: 16 }}>
      <P.View wrap={false} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
        <P.Text style={{ fontFamily: font.head, fontSize: 12, fontWeight: 700, color: t.accent, letterSpacing: 0.6, textTransform: "uppercase" }}>
          {title}
        </P.Text>
        <P.View style={{ flex: 1, height: 1, backgroundColor: t.rule, marginLeft: 8 }} />
      </P.View>
      {children}
    </P.View>
  );

  return (
    // Sidebar is absolutely positioned on page 1 and the main column flows with a left
    // padding: react-pdf cannot split a two-column row across pages.
    <P.Page size={A4} style={{ paddingTop: 34, paddingBottom: 34, paddingLeft: SIDE + 24, paddingRight: 30, ...body }}>
      {/* Zero-height fixed wrapper: react-pdf refuses fixed nodes taller than the page's content box. */}
      <P.View fixed style={{ position: "absolute", top: 0, left: 0, width: SIDE, height: 0 }}>
        <P.View style={{ position: "absolute", top: 0, left: 0, width: SIDE, height: A4.height, backgroundColor: t.sidebar }} />
      </P.View>
      <P.View style={{ position: "absolute", top: 34, left: 0, width: SIDE, paddingHorizontal: 20 }}>
        {r.photo ? (
          <P.Image
            src={r.photo}
            style={{
              width: 112,
              height: r.photoRatio === "3:4" ? 149 : 112,
              borderRadius: r.photoRatio === "3:4" ? 6 : 56,
              objectFit: "cover",
              alignSelf: "center",
              marginBottom: 6,
            }}
          />
        ) : null}
        <Call fn={SideTitle}>Контакты</Call>
        {age ? <Call fn={Contact} c={{ kind: "age", label: age }} color={t.onSidebar} iconColor={t.onSidebar} /> : null}
        {contacts.map((c, i) => (
          <Call fn={Contact} key={i} c={c} color={t.onSidebar} iconColor={t.onSidebar} />
        ))}
        {groupSkills(r.skills).map((g, i) => (
          <P.View key={i}>
            <Call fn={SideTitle}>{g.label || "Навыки"}</Call>
            <Call fn={Chips} items={g.items} bg={t.onSidebar === "#ffffff" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)"} color={t.onSidebar} />
          </P.View>
        ))}
      </P.View>

      <P.View>
        <P.Text style={{ fontFamily: font.head, fontSize: 25, fontWeight: 700, color: t.text, lineHeight: 1.1 }}>{r.fullName || "Имя Фамилия"}</P.Text>
        <P.Text style={{ ...body, fontSize: 13, fontWeight: 500, color: t.accent, marginTop: 4 }}>{r.title || "Желаемая должность"}</P.Text>

        {r.summary || loading ? (
          <Call fn={Section} title="О себе">{r.summary ? <P.Text style={body}>{r.summary}</P.Text> : <Call fn={Skeleton} />}</Call>
        ) : null}

        {r.strengths.length || loading ? (
          <Call fn={Section} title="Сильные стороны">
            {r.strengths.length ? (
              <P.View style={{ backgroundColor: t.tint, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, borderLeftWidth: 3, borderLeftColor: t.accent, borderLeftStyle: "solid" }}>
                {r.strengths.map((s, i) => (
                  <P.View key={i} wrap={false} style={{ marginBottom: i === r.strengths.length - 1 ? 0 : 5 }}>
                    <P.Text style={{ ...body, fontWeight: 700, color: t.accent }}>{s.title}</P.Text>
                    <P.Text style={body}>{s.description}</P.Text>
                  </P.View>
                ))}
              </P.View>
            ) : (
              <Call fn={Skeleton} lines={4} />
            )}
          </Call>
        ) : null}

        {r.jobs.some((j) => j.company || j.position) ? (
          <Call fn={Section} title="Опыт работы">
            {r.jobs
              .filter((j) => j.company || j.position)
              .map((j) => (
                <P.View key={j.id} style={{ marginBottom: 10 }}>
                  <P.View wrap={false}>
                    <P.View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <P.Text style={{ ...body, fontSize: 11, fontWeight: 700, flex: 1 }}>{j.position}</P.Text>
                      <P.Text style={{ ...body, fontSize: 9, color: t.muted, marginLeft: 6 }}>{fmtPeriod(j)}</P.Text>
                    </P.View>
                    <P.Text style={{ ...body, color: t.accent, fontWeight: 500, marginBottom: 3 }}>{j.company}</P.Text>
                  </P.View>
                  <Call fn={Bullets} items={jobBullets(j)} />
                </P.View>
              ))}
          </Call>
        ) : null}

        <EducationBlock r={r} P={P} t={t} body={body} Section={Section} />
      </P.View>
    </P.Page>
  );
}

/* ------------------------------------------------------------------------ */

function Minimal({ resume: r, settings, P, loading }: DocProps) {
  const t = themeFor(settings.palette);
  const font = FONTS.minimal;
  const fs = 10;
  const LABEL = 104;
  const { body, Bullets, Skeleton } = kit(P, t, fs, font);
  const contacts = contactItems(r.contacts);
  const age = r.showAge ? ageFrom(r.birthDate) : null;

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <P.View style={{ flexDirection: "row", marginTop: 18 }}>
      <P.View style={{ width: LABEL, paddingRight: 10 }}>
        <P.Text style={{ fontFamily: font.head, fontSize: 9, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", color: t.accent, lineHeight: 1.3 }}>
          {title}
        </P.Text>
      </P.View>
      <P.View style={{ flex: 1 }}>{children}</P.View>
    </P.View>
  );

  return (
    <P.Page size={A4} style={{ paddingTop: 44, paddingBottom: 40, paddingHorizontal: 46, ...body }}>
      <P.View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <P.View style={{ flex: 1, paddingRight: 16 }}>
          <P.View style={{ width: 36, height: 4, backgroundColor: t.accent, marginBottom: 14 }} />
          <P.Text style={{ fontFamily: font.head, fontSize: 34, fontWeight: 800, color: t.text, lineHeight: 1.05, letterSpacing: -0.5 }}>
            {r.fullName || "Имя Фамилия"}
          </P.Text>
          <P.Text style={{ fontFamily: font.head, fontSize: 13, fontWeight: 600, color: t.accent, marginTop: 8, letterSpacing: 0.4 }}>
            {r.title || "Желаемая должность"}
          </P.Text>
          <P.View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
            {[...(age ? [{ kind: "age" as const, label: age, href: undefined }] : []), ...contacts].map((c, i) => (
              <P.View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 4 }}>
                <P.View style={{ marginRight: 4 }}>
                  <P.Icon d={ICONS[c.kind]} size={9} color={t.accent} />
                </P.View>
                {c.href ? (
                  <P.Link src={c.href} style={{ ...body, fontSize: 9, color: t.text }}>
                    {c.label}
                  </P.Link>
                ) : (
                  <P.Text style={{ ...body, fontSize: 9, color: t.text }}>{c.label}</P.Text>
                )}
              </P.View>
            ))}
          </P.View>
        </P.View>
        {r.photo ? (
          <P.Image src={r.photo} style={{ width: 118, height: r.photoRatio === "3:4" ? 157 : 118, objectFit: "cover" }} />
        ) : null}
      </P.View>

      {r.summary || loading ? (
        <P.View style={{ marginTop: 22 }}>
          {r.summary ? (
            <P.Text style={{ fontFamily: font.head, fontSize: 11.5, lineHeight: 1.5, color: t.text }}>{r.summary}</P.Text>
          ) : (
            <Call fn={Skeleton} />
          )}
        </P.View>
      ) : null}

      {r.strengths.length || loading ? (
        <P.View style={{ marginTop: 18 }}>
          {r.strengths.length ? (
            <P.View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -10 }}>
              {r.strengths.map((s, i) => (
                <P.View key={i} wrap={false} style={{ width: "50%", paddingRight: 10, marginBottom: 10 }}>
                  <P.View style={{ borderTopWidth: 1.5, borderTopColor: t.accent, borderTopStyle: "solid", paddingTop: 6 }}>
                    <P.Text style={{ fontFamily: font.head, fontSize: 16, fontWeight: 800, color: t.accent, lineHeight: 1 }}>
                      {String(i + 1).padStart(2, "0")}
                    </P.Text>
                    <P.Text style={{ fontFamily: font.head, fontSize: 10.5, fontWeight: 600, color: t.text, marginTop: 4 }}>{s.title}</P.Text>
                    <P.Text style={{ ...body, fontSize: 9.5, color: t.muted, marginTop: 2 }}>{s.description}</P.Text>
                  </P.View>
                </P.View>
              ))}
            </P.View>
          ) : (
            <Call fn={Skeleton} lines={4} />
          )}
        </P.View>
      ) : null}

      {r.jobs.some((j) => j.company || j.position) ? (
        <Call fn={Section} title="Опыт">
          {r.jobs
            .filter((j) => j.company || j.position)
            .map((j) => (
              <P.View key={j.id} style={{ marginBottom: 11 }}>
                <P.View wrap={false}>
                  <P.Text style={{ fontFamily: font.head, fontSize: 11, fontWeight: 600, color: t.text }}>
                    {j.position}
                    {j.company ? <P.Text style={{ color: t.accent }}>{(j.position ? " · " : "") + j.company}</P.Text> : null}
                  </P.Text>
                  <P.Text style={{ ...body, fontSize: 9, color: t.muted, marginBottom: 3 }}>{fmtPeriod(j)}</P.Text>
                </P.View>
                <Call fn={Bullets} items={jobBullets(j)} />
              </P.View>
            ))}
        </Call>
      ) : null}

      {r.skills.length ? (
        <Call fn={Section} title="Навыки">
          {groupSkills(r.skills).map((g, i) => (
            <P.View key={i} style={{ marginBottom: 4 }}>
              {g.label ? <P.Text style={{ ...body, fontSize: 9, color: t.muted, marginBottom: 2 }}>{g.label}</P.Text> : null}
              <P.Text style={body}>{g.items.join("  /  ")}</P.Text>
            </P.View>
          ))}
        </Call>
      ) : null}

      <EducationBlock {...{ r, P, t, body, Section }} />
    </P.Page>
  );
}

/* ------------------------------------------------------------------------ */

/** Mobile-first single column: Photo+Name → Contacts → Strengths → Experience → Skills → Education. */
function Mobile({ resume: r, settings, P, loading }: DocProps) {
  const t = themeFor(settings.palette);
  const font = FONTS[settings.template];
  const fs = 14;
  const { body, Bullets, Chips, Skeleton } = kit(P, t, fs, font);
  const b: Style = { ...body, lineHeight: 1.55 };
  const contacts = contactItems(r.contacts);
  const age = r.showAge ? ageFrom(r.birthDate) : null;
  const pad = 22;

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <P.View style={{ marginTop: 26 }}>
      <P.View wrap={false} style={{ marginBottom: 10 }}>
        <P.Text style={{ fontFamily: font.head, fontSize: 17, fontWeight: 700, color: t.accent }}>{title}</P.Text>
        <P.View style={{ height: 2, width: 32, backgroundColor: t.accent, marginTop: 5 }} />
      </P.View>
      {children}
    </P.View>
  );

  return (
    <P.Page size={{ width: MOBILE_WIDTH }} style={{ paddingBottom: 32, ...b }}>
      <P.View style={{ backgroundColor: t.sidebar, paddingHorizontal: pad, paddingTop: 28, paddingBottom: 22, alignItems: "center" }}>
        {r.photo ? (
          <P.Image
            src={r.photo}
            style={{ width: 120, height: r.photoRatio === "3:4" ? 160 : 120, borderRadius: r.photoRatio === "3:4" ? 8 : 60, objectFit: "cover", marginBottom: 14 }}
          />
        ) : null}
        <P.Text style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: t.onSidebar, textAlign: "center", lineHeight: 1.15 }}>
          {r.fullName || "Имя Фамилия"}
        </P.Text>
        <P.Text style={{ ...b, fontSize: 16, color: t.onSidebarMuted, textAlign: "center", marginTop: 6 }}>{r.title || "Желаемая должность"}</P.Text>
        {age ? <P.Text style={{ ...b, fontSize: 14, color: t.onSidebarMuted, marginTop: 2 }}>{age}</P.Text> : null}
      </P.View>

      <P.View style={{ paddingHorizontal: pad }}>
        {contacts.length ? (
          <Call fn={Section} title="Контакты">
            {contacts.map((c, i) => (
              <P.View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <P.View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.chipBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <P.Icon d={ICONS[c.kind]} size={15} color={t.accent} />
                </P.View>
                {c.href ? (
                  <P.Link src={c.href} style={{ ...b, fontSize: 15, color: t.accent, flex: 1, textDecoration: "underline" }}>
                    {c.label}
                  </P.Link>
                ) : (
                  <P.Text style={{ ...b, fontSize: 15, flex: 1 }}>{c.label}</P.Text>
                )}
              </P.View>
            ))}
          </Call>
        ) : null}

        {r.summary || loading ? (
          <Call fn={Section} title="О себе">{r.summary ? <P.Text style={b}>{r.summary}</P.Text> : <Call fn={Skeleton} />}</Call>
        ) : null}

        {r.strengths.length || loading ? (
          <Call fn={Section} title="Сильные стороны">
            {r.strengths.length ? (
              r.strengths.map((s, i) => (
                <P.View
                  key={i}
                  wrap={false}
                  style={{ backgroundColor: t.tint, borderRadius: 8, padding: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: t.accent, borderLeftStyle: "solid" }}
                >
                  <P.Text style={{ ...b, fontWeight: 700, color: t.accent, fontSize: 15 }}>{s.title}</P.Text>
                  <P.Text style={b}>{s.description}</P.Text>
                </P.View>
              ))
            ) : (
              <Call fn={Skeleton} lines={4} />
            )}
          </Call>
        ) : null}

        {r.jobs.some((j) => j.company || j.position) ? (
          <Call fn={Section} title="Опыт работы">
            {r.jobs
              .filter((j) => j.company || j.position)
              .map((j) => (
                <P.View key={j.id} style={{ marginBottom: 18 }}>
                  <P.View wrap={false}>
                    <P.Text style={{ ...b, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{j.position}</P.Text>
                    <P.Text style={{ ...b, color: t.accent }}>{j.company}</P.Text>
                    <P.Text style={{ ...b, fontSize: 13, color: t.muted, marginBottom: 6 }}>{fmtPeriod(j)}</P.Text>
                  </P.View>
                  <Call fn={Bullets} items={jobBullets(j)} />
                </P.View>
              ))}
          </Call>
        ) : null}

        {r.skills.length ? (
          <Call fn={Section} title="Навыки">
            {groupSkills(r.skills).map((g, i) => (
              <P.View key={i} style={{ marginBottom: 6 }}>
                {g.label ? <P.Text style={{ ...b, fontSize: 13, color: t.muted, marginBottom: 6 }}>{g.label}</P.Text> : null}
                <Call fn={Chips} items={g.items} bg={t.chipBg} color={t.chipText} size={14} />
              </P.View>
            ))}
          </Call>
        ) : null}

        <EducationBlock r={r} P={P} t={t} body={b} Section={Section} compact />
      </P.View>
    </P.Page>
  );
}

export function ResumeDoc(props: DocProps) {
  if (props.variant === "mobile") return <Mobile {...props} />;
  switch (props.settings.template) {
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
