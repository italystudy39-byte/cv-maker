"use client";
import { useEffect, useState } from "react";
import { Builder } from "@/components/Builder";
import { htmlPrims } from "@/components/templates/prims";
import { A4, MOBILE_WIDTH, ResumeDoc } from "@/components/templates/ResumeDoc";
import { fmtDateTime, Logo, ThemeToggle, ToastProvider } from "@/components/ui";
import { SAMPLE } from "@/lib/sample";
import { hydrateResume, useResume } from "@/lib/store";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [started, setStarted] = useState(false);
  const reset = useResume((s) => s.reset);
  const updatedAt = useResume((s) => s.doc.meta.updatedAt);

  useEffect(() => {
    hydrateResume().then((had) => {
      setHasDraft(had);
      setReady(true);
    });
  }, []);

  if (!ready) return <main className="min-h-dvh" />;
  if (started)
    return (
      <ToastProvider>
        <Builder
          onHome={() => {
            setHasDraft(true);
            setStarted(false);
          }}
        />
      </ToastProvider>
    );

  // DESIGN 4.1: one 640 px column, no hero, a real example instead of an illustration.
  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex max-w-[640px] items-center justify-between px-4 pt-5 lg:px-0">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="mx-auto max-w-[640px] px-4 pt-14 lg:px-0 lg:pt-20">
        <h1 className="t-display max-w-[20ch] text-fg">Резюме, которое удобно читать и на бумаге, и в телефоне</h1>
        <p className="mt-5 max-w-[56ch] text-[17px] leading-[26px] text-muted">
          Заполните шесть коротких шагов своими словами. Мы перепишем опыт в деловые пункты, выделим сильные стороны и соберём два PDF: A4 для печати и сайтов и длинную страницу для Telegram и WhatsApp.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {hasDraft ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => setStarted(true)}>
                Продолжить черновик
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  reset();
                  setStarted(true);
                }}
              >
                Создать резюме
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setStarted(true)}>
              Создать резюме
            </button>
          )}
        </div>
        {hasDraft && updatedAt ? <p className="t-small tnum mt-3 text-muted">Черновик изменён {fmtDateTime(updatedAt)}</p> : null}
      </div>

      <Example />

      <p className="t-small mx-auto max-w-[640px] px-4 pt-8 pb-16 text-muted lg:px-0">Без регистрации · Черновик хранится в вашем браузере · PDF с текстовым слоем для ATS</p>
    </main>
  );
}

/** Two real sheets, A4 and phone, overlapping on the grey surface. Rendered by the same templates as the PDF. */
function Example() {
  const a4 = 0.5;
  const mob = 0.5;
  return (
    <div className="mx-auto mt-14 max-w-[640px] px-4 lg:px-0" aria-label="Пример резюме: версия A4 и версия для телефона" role="img">
      <div className="relative h-[330px] overflow-hidden rounded-lg bg-sunken sm:h-[400px]" aria-hidden>
        <div className="absolute top-8 left-6 origin-top-left shadow-paper sm:left-10" style={{ width: A4.width, transform: `scale(${a4})` }}>
          <div className="pointer-events-none select-none">
            <ResumeDoc doc={SAMPLE} P={htmlPrims} variant="a4" />
          </div>
        </div>
        <div className="absolute top-16 right-6 origin-top-right overflow-hidden rounded-[20px] border border-line-strong bg-paper p-2 shadow-paper sm:right-auto sm:left-[290px] sm:origin-top-left" style={{ width: MOBILE_WIDTH + 18, transform: `scale(${mob})` }}>
          <div className="pointer-events-none overflow-hidden rounded-[12px] select-none">
            <ResumeDoc doc={{ ...SAMPLE, meta: { ...SAMPLE.meta, template: "modern" } }} P={htmlPrims} variant="mobile" />
          </div>
        </div>
      </div>
    </div>
  );
}
