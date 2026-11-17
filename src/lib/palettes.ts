import type { ThemePaletteId } from "./types";

// WCAG 2.x relative luminance / contrast helpers
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function rgbToHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function mix(hex: string, target: string, t: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}
/** Darken `fg` towards black until it reaches `ratio` against `bg`. */
export function ensureContrast(fg: string, bg: string, ratio = 4.5) {
  let c = fg;
  for (let i = 0; i < 20 && contrast(c, bg) < ratio; i++) c = mix(c, "#000000", 0.08);
  return c;
}
/** Pick white or near-black text for a coloured background. */
export function textOn(bg: string) {
  return contrast("#ffffff", bg) >= 4.5 ? "#ffffff" : "#14171B";
}

export interface Palette {
  id: ThemePaletteId;
  name: string;
  /** Muted base colour (DESIGN 9.3); every other token is derived from it. */
  base: string;
}

// DESIGN 9.3: muted bases instead of the Tailwind-like SPEC values. New palettes must stay muted (OKLCH chroma <= 0.12).
export const PALETTES: Palette[] = [
  { id: "deep_navy", name: "Тёмно-синий", base: "#1F3A68" },
  { id: "emerald_green", name: "Изумрудный", base: "#0F7B5F" },
  { id: "graphite_dark", name: "Графит", base: "#2F3337" },
  { id: "burgundy_wine", name: "Бордовый", base: "#7A1F3D" },
  { id: "slate_blue", name: "Серо-голубой", base: "#5A7192" },
];

export interface Theme {
  primary: string; // accent: headings, lines, icons (>= 4.5:1 on white)
  secondary: string; // tint: soft background for strengths and mobile buttons
  onPrimary: string; // text on primary
  onSecondary: string; // accent text on tint (>= 4.5:1)
  text: string;
  muted: string;
  rule: string; // subtle divider
  sidebar: string; // Modern sidebar background
  onSidebar: string;
  onSidebarMuted: string;
  chipBg: string; // Modern skill chips on the sidebar
  chipText: string;
}

/** Theme tokens with an automatic WCAG AA guard, so any palette edit stays readable. */
export function themeFor(id: ThemePaletteId): Theme {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];
  const primary = ensureContrast(p.base, "#ffffff", 4.5);
  const secondary = mix(p.base, "#ffffff", 0.92);
  const sidebar = p.base;
  const onSidebar = textOn(sidebar);
  // Chips a step lighter than the sidebar; if that loses contrast with the sidebar text, a step darker.
  const lighter = mix(sidebar, "#ffffff", 0.16);
  const chipBg = contrast(onSidebar, lighter) >= 4.5 ? lighter : mix(sidebar, "#000000", 0.2);
  return {
    primary,
    secondary,
    onPrimary: textOn(primary),
    onSecondary: ensureContrast(primary, secondary, 4.5),
    text: ensureContrast("#1A1D21", secondary, 7),
    muted: ensureContrast("#555C66", secondary, 4.5),
    rule: mix(primary, "#ffffff", 0.75),
    sidebar,
    onSidebar,
    onSidebarMuted: contrast(mix(onSidebar, sidebar, 0.22), sidebar) >= 4.5 ? mix(onSidebar, sidebar, 0.22) : onSidebar,
    chipBg,
    chipText: contrast(onSidebar, chipBg) >= 4.5 ? onSidebar : textOn(chipBg),
  };
}

/** CSS custom properties for the preview container (`.resume-canvas`). */
export function cssVars(id: ThemePaletteId): Record<string, string> {
  const t = themeFor(id);
  return { "--color-primary": t.primary, "--color-secondary": t.secondary, "--color-text-main": t.text, "--color-text-muted": t.muted };
}
