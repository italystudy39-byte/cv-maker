"use client";
import { CircleAlert, Monitor, Moon, Sun, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * DESIGN 6.1. While `busy`, the label switches to `busyText`, a 14 px spinner appears and the width
 * is locked to the idle label, so the button never jumps.
 */
export function Button({
  variant = "secondary",
  size = "m",
  busy,
  busyText,
  icon,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "s" | "m"; busy?: boolean; busyText?: string; icon?: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [minW, setMinW] = useState<number>();
  useLayoutEffect(() => {
    if (!busy && ref.current) setMinW(ref.current.offsetWidth);
  }, [busy, children]);
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={`btn btn-${variant} ${size === "s" ? "btn-s" : ""} ${className}`}
      style={{ ...rest.style, minWidth: busy ? minW : rest.style?.minWidth }}
    >
      {busy ? <span className="spinner" aria-hidden /> : icon}
      {busy && busyText ? busyText : children}
    </button>
  );
}

/* ------------------------------------------------------------- Segmented */

/** DESIGN 6.6: radiogroup with a thumb that slides under the selected option. Arrow keys move the choice. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "m",
  className = "",
}: {
  value: T;
  options: { id: T; label: ReactNode; icon?: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "s" | "m";
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const idx = Math.max(0, options.findIndex((o) => o.id === value));

  useLayoutEffect(() => {
    const el = track.current?.querySelectorAll<HTMLElement>("[role=radio]")[idx];
    if (!el) return;
    const measure = () => setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [idx, options.length]);

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (idx + d + options.length) % options.length;
    onChange(options[next].id);
    track.current?.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus();
  };

  const h = size === "s" ? "h-8" : "h-10 max-lg:h-11";
  return (
    <div ref={track} role="radiogroup" aria-label={label} onKeyDown={onKey} className={`relative inline-flex rounded-md bg-sunken p-0.5 ${h} ${className}`}>
      {thumb ? (
        <span
          aria-hidden
          className="seg-thumb absolute top-0.5 bottom-0.5 left-0 rounded-[5px] border border-line bg-raised"
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      ) : null}
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={i === idx}
          tabIndex={i === idx ? 0 : -1}
          title={o.title}
          onClick={() => onChange(o.id)}
          className={`relative z-[1] inline-flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-3 text-sm font-medium whitespace-nowrap transition-colors duration-100 ${i === idx ? "text-fg" : "text-muted hover:text-fg"}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Field */

/** DESIGN 6.2: label above, hint or error below; required fields say «обязательно» in grey. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = "",
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required ? <span className="text-[13px] font-normal text-muted">обязательно</span> : null}
      </label>
      {children({ id, "aria-describedby": error || hint ? msgId : undefined, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={msgId} className="anim-drop mt-1.5 flex items-start gap-1.5 text-[13px] leading-[18px] text-danger">
          <CircleAlert size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="hint mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- Theme */

type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "ui-theme";

function readTheme(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** DESIGN 3.2: «Светлая / Тёмная / Как в системе», switched instantly, stored in localStorage. */
export function ThemeToggle() {
  // Rendered only on the client (after the draft loads), so reading localStorage here is safe.
  const [pref, setPref] = useState<ThemePref>(readTheme);
  const set = (p: ThemePref) => {
    setPref(p);
    try {
      if (p === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, p);
    } catch {}
    if (p === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = p;
  };
  const opts: { id: ThemePref; icon: ReactNode; title: string }[] = [
    { id: "light", icon: <Sun size={16} strokeWidth={1.5} aria-hidden />, title: "Светлая тема" },
    { id: "dark", icon: <Moon size={16} strokeWidth={1.5} aria-hidden />, title: "Тёмная тема" },
    { id: "system", icon: <Monitor size={16} strokeWidth={1.5} aria-hidden />, title: "Как в системе" },
  ];
  return (
    <Segmented
      size="s"
      label="Тема оформления"
      value={pref}
      onChange={set}
      options={opts.map((o) => ({ id: o.id, title: o.title, label: <span className="sr-only">{o.title}</span>, icon: o.icon }))}
    />
  );
}

/* ------------------------------------------------------------------ Toast */

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  ms?: number;
}
const ToastCtx = createContext<(t: Omit<ToastMsg, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/** DESIGN 6.11: one toast at a time, 5 s by default, timer pauses on hover. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [hover, setHover] = useState(false);
  const show = useCallback((t: Omit<ToastMsg, "id">) => setToast({ ...t, id: Date.now() }), []);

  useEffect(() => {
    if (!toast || hover) return;
    const h = setTimeout(() => setToast(null), toast.ms ?? 5000);
    return () => clearTimeout(h);
  }, [toast, hover]);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[88px] z-50 flex justify-center lg:inset-x-auto lg:bottom-20 lg:left-6 lg:justify-start" role="status" aria-live="polite">
        {toast ? (
          <div
            key={toast.id}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="anim-toast pointer-events-auto flex max-w-[400px] items-center gap-4 rounded-lg border border-[var(--ui-pop-border)] bg-ink px-4 py-3 text-sm text-on-ink shadow-pop"
          >
            <span>{toast.text}</span>
            {toast.action ? (
              <button
                type="button"
                className="shrink-0 font-medium underline underline-offset-2"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ Modal */

/** DESIGN 6.10: no backdrop blur, Esc and backdrop click close it, focus is trapped and returned. */
export function Modal({ title, onClose, children, footer, width = 480 }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>("button, input, [tabindex]");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !box.current) return;
      const els = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, [tabindex]:not([tabindex='-1'])")];
      if (!els.length) return;
      const [a, z] = [els[0], els[els.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-[rgb(11_13_16/0.48)] lg:items-center lg:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-modal w-full rounded-t-lg border border-[var(--ui-pop-border)] bg-raised shadow-modal lg:rounded-lg"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="t-h2">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon btn-s" aria-label="Закрыть" title="Закрыть" onClick={onClose}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-5 pb-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** «17 ноября, 13:40» */
export function fmtDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${year}, ${fmtTime(iso)}`;
}

/** Logo word (DESIGN 4.1). */
export function Logo({ onClick }: { onClick?: () => void }) {
  const body = <span className="font-serif text-[20px] leading-none font-semibold tracking-[-0.01em] text-fg">Резюме</span>;
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-sm" aria-label="На главную">
      {body}
    </button>
  ) : (
    body
  );
}
