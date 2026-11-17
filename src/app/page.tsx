"use client";
import { useState } from "react";
import { Builder } from "@/components/Builder";
import { useDraft } from "@/lib/useDraft";

export default function Home() {
  const d = useDraft();
  const [started, setStarted] = useState(false);

  if (!d.hydrated) return <main className="min-h-screen" />;
  if (started) return <main className="min-h-screen">{<Builder d={d} />}</main>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-slate-500">ИИ-конструктор резюме</p>
        <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">Сильное резюме за 10 минут</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
          Впишите факты о себе как есть. ИИ сформулирует опыт языком достижений, выделит сильные стороны и соберёт два PDF: для печати и для отправки в мессенджер.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" className="btn-primary px-8 py-3 text-base" onClick={() => setStarted(true)}>
            {d.hasSaved ? "Продолжить черновик" : "Создать резюме"}
          </button>
          {d.hasSaved ? (
            <button
              type="button"
              className="btn-secondary px-6 py-3 text-base"
              onClick={() => {
                d.reset();
                setStarted(true);
              }}
            >
              Начать с нуля
            </button>
          ) : null}
        </div>
        <ul className="mx-auto mt-12 grid max-w-xl gap-4 text-left text-sm text-slate-600 sm:grid-cols-3">
          <li className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <b className="block text-slate-900">ИИ-редактор</b>«О себе», буллиты с глаголами действия, сильные стороны
          </li>
          <li className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <b className="block text-slate-900">3 шаблона, 5 палитр</b>Переключение в один клик, данные не теряются
          </li>
          <li className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <b className="block text-slate-900">A4 + Mobile PDF</b>Текстовый слой для ATS и кликабельные контакты
          </li>
        </ul>
        <p className="mt-8 text-xs text-slate-400">Черновик хранится только в вашем браузере. Регистрация не нужна.</p>
      </div>
    </main>
  );
}
