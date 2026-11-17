"use client";
import { useEffect, useRef, useState } from "react";
import { cssVars } from "@/lib/palettes";
import type { ResumeDocument } from "@/lib/types";
import { htmlPrims } from "./templates/prims";
import { A4, MOBILE_WIDTH, ResumeDoc, type Editor, type Variant } from "./templates/ResumeDoc";

export type Zoom = "fit" | number;

/** DESIGN 8: a white sheet on the sunken surface, scaled with transform; the layout is never recomputed. */
export function Preview({
  doc,
  variant,
  loading,
  edit,
  onMeasure,
  zoom = "fit",
  onFitScale,
  flash = 0,
}: {
  doc: ResumeDocument;
  variant: Variant;
  loading?: boolean;
  edit?: Editor;
  /** Reports content height in A4 pages (e.g. 1.15), for the overflow warning. */
  onMeasure?: (pages: number) => void;
  zoom?: Zoom;
  /** Reports the fit-to-width scale, so zoom buttons can step from it. */
  onFitScale?: (s: number) => void;
  /** Increment to highlight blocks changed by a build (DESIGN 7.4). */
  flash?: number;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [height, setHeight] = useState(A4.height);
  const [flashing, setFlashing] = useState(false);
  const docWidth = variant === "a4" ? A4.width : MOBILE_WIDTH;
  const frame = variant === "mobile" ? 9 : 0; // 1 px border + 8 px inset

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const ro = new ResizeObserver(() => {
      const avail = o.clientWidth - 2 * frame;
      const f = Math.min(variant === "mobile" ? 1 : 1.2, avail / docWidth);
      setFit(f);
      onFitScale?.(f);
      setHeight(i.offsetHeight);
      const sheet = i.querySelector<HTMLElement>(".resume-sheet");
      if (variant === "a4" && sheet) onMeasure?.(measureContent(sheet) / A4.height);
    });
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [docWidth, frame, variant, onMeasure, onFitScale]);

  useEffect(() => {
    if (!flash) return;
    let b = 0;
    const a = requestAnimationFrame(() => {
      setFlashing(false);
      b = requestAnimationFrame(() => setFlashing(true));
    });
    const t = setTimeout(() => setFlashing(false), 2200);
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
      clearTimeout(t);
    };
  }, [flash]);

  const scale = zoom === "fit" ? fit : zoom;
  const pages = variant === "a4" ? Math.max(1, Math.ceil((height - 20) / A4.height)) : 1;
  const sheetH = (variant === "a4" ? Math.max(height, pages * A4.height) : height) * scale;
  const empty = !doc.personal.fullName.trim() && !doc.personal.targetTitle.trim();

  return (
    <div ref={outer} className="resume-canvas w-full" style={cssVars(doc.meta.theme) as React.CSSProperties}>
      <div className="overflow-x-auto">
        <div
          key={`${variant}-${doc.meta.template}`}
          className={variant === "mobile" ? "anim-phone mx-auto rounded-[20px] border border-line-strong p-2" : "anim-fade mx-auto"}
          style={{ width: docWidth * scale + 2 * frame }}
        >
          <div className={`relative overflow-hidden bg-paper ${variant === "mobile" ? "rounded-[12px]" : "shadow-paper"}`} style={{ width: docWidth * scale, height: sheetH }}>
            <div
              ref={inner}
              className={flashing ? "resume-flash" : undefined}
              style={{ width: docWidth, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative", visibility: empty ? "hidden" : undefined }}
              aria-hidden={empty || undefined}
            >
              <ResumeDoc doc={doc} P={htmlPrims} variant={variant} loading={loading} edit={edit} />
              {variant === "a4"
                ? Array.from({ length: pages - 1 }).map((_, k) => (
                    <div key={k} aria-hidden className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-line-strong" style={{ top: (k + 1) * A4.height }} />
                  ))
                : null}
            </div>
            {empty ? <EmptySheet /> : null}
            {variant === "a4" && pages > 1
              ? Array.from({ length: pages }).map((_, k) => (
                  <span key={k} aria-hidden className="tnum pointer-events-none absolute right-3 text-[11px] leading-none text-faint" style={{ top: ((k + 1) * A4.height) * scale - 16 }}>
                    {k + 1} / {pages}
                  </span>
                ))
              : null}
          </div>
        </div>
      </div>
      <p className="t-small tnum mt-3 text-center text-muted">
        {variant === "a4" ? `A4, ${pages} ${pages === 1 ? "страница" : pages < 5 ? "страницы" : "страниц"}` : "Телефон: 390 px, одна длинная страница"}
        {edit && !empty ? ". Текст можно править прямо на листе" : ""}
      </p>
    </div>
  );
}

/** DESIGN 6.15: static grey lines and one sentence, no illustration. */
function EmptySheet() {
  const bar = (w: string, h = 8, mt = 10) => <div className="rounded-sm bg-sunken" style={{ width: w, height: h, marginTop: mt }} />;
  return (
    <div className="absolute inset-0 p-[8%]">
      {bar("45%", 16, 0)}
      {bar("30%", 10)}
      <div className="mt-8" />
      {["100%", "92%", "96%", "60%"].map((w, i) => (
        <div key={i}>{bar(w)}</div>
      ))}
      <div className="mt-8" />
      {["100%", "88%", "94%"].map((w, i) => (
        <div key={i}>{bar(w)}</div>
      ))}
      <p className="t-small absolute inset-x-6 top-[42%] text-center text-muted">Начните с имени и должности — резюме появится здесь</p>
    </div>
  );
}

/** Height of the actual content (lowest descendant + bottom padding), ignoring the sheet's A4 min-height. */
function measureContent(sheet: HTMLElement) {
  const rect = sheet.getBoundingClientRect();
  const scale = rect.height / sheet.offsetHeight || 1;
  let max = rect.top;
  sheet.querySelectorAll<HTMLElement>("div,img,svg").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height >= rect.height - 1) return; // full-height decorations, e.g. the sidebar background
    if (r.bottom > max) max = r.bottom;
  });
  const pad = parseFloat(getComputedStyle(sheet).paddingBottom) || 0;
  return (max - rect.top) / scale + pad;
}
