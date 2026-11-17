"use client";
import { useEffect, useRef, useState } from "react";
import type { Resume, Settings } from "@/lib/types";
import { htmlPrims } from "./templates/prims";
import { A4, MOBILE_WIDTH, ResumeDoc, type Variant } from "./templates/ResumeDoc";

export function Preview({ resume, settings, variant, loading }: { resume: Resume; settings: Settings; variant: Variant; loading?: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(A4.height);
  const docWidth = variant === "a4" ? A4.width : MOBILE_WIDTH;
  const frame = variant === "mobile" ? 12 : 0;

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const ro = new ResizeObserver(() => {
      const avail = o.clientWidth - 2 * frame;
      setScale(Math.min(variant === "mobile" ? 1 : 1.4, avail / docWidth));
      setHeight(i.offsetHeight);
    });
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [docWidth, frame, variant]);

  const pages = variant === "a4" ? Math.max(1, Math.ceil((height - 20) / A4.height)) : 1;

  return (
    <div ref={outer} className="w-full">
      <div
        className={variant === "mobile" ? "mx-auto rounded-[28px] bg-slate-900 shadow-xl" : "mx-auto"}
        style={{ width: docWidth * scale + 2 * frame, padding: frame }}
      >
        <div
          className={variant === "mobile" ? "overflow-hidden rounded-[18px] bg-white" : "overflow-hidden bg-white shadow-lg ring-1 ring-black/5"}
          style={{ width: docWidth * scale, height: (variant === "a4" ? Math.max(height, pages * A4.height) : height) * scale }}
        >
          <div ref={inner} style={{ width: docWidth, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
            <ResumeDoc resume={resume} settings={settings} P={htmlPrims} variant={variant} loading={loading} />
            {variant === "a4"
              ? Array.from({ length: pages - 1 }).map((_, k) => (
                  <div
                    key={k}
                    aria-hidden
                    className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-rose-400/70"
                    style={{ top: (k + 1) * A4.height }}
                  >
                    <span className="absolute right-2 -top-5 rounded bg-rose-500 px-1.5 text-[10px] text-white">стр. {k + 2}</span>
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>
      {variant === "a4" ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          A4 · {pages} {pages === 1 ? "страница" : "страницы"}. Пунктир — примерная граница страницы.
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-500">Мобильный PDF: одна колонка, крупный шрифт, без разрывов страниц.</p>
      )}
    </div>
  );
}
