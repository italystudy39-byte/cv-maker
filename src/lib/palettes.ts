import type { PaletteId } from "./types";

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
  return contrast("#ffffff", bg) >= 4.5 ? "#ffffff" : "#111827";
}

export interface Palette {
  id: PaletteId;
  name: string;
  base: string;
}

export const PALETTES: Palette[] = [
  { id: "navy", name: "Deep Navy", base: "#1f3a68" },
  { id: "emerald", name: "Emerald Green", base: "#0f7b5f" },
  { id: "graphite", name: "Graphite Dark", base: "#2f3337" },
  { id: "burgundy", name: "Burgundy", base: "#7a1f3d" },
  { id: "slate", name: "Slate Blue", base: "#5a7192" },
];

export interface Theme {
  accent: string; // headings, lines, icons on white (>= 4.5:1 on white)
  sidebar: string; // sidebar background
  onSidebar: string; // text on sidebar (auto WCAG)
  onSidebarMuted: string;
  chipBg: string; // light tint for skill chips on white
  chipText: string; // >= 4.5:1 on chipBg
  tint: string; // very light background for blocks
  text: string;
  muted: string;
  rule: string;
}

export function themeFor(id: PaletteId): Theme {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];
  const accent = ensureContrast(p.base, "#ffffff", 4.5);
  const sidebar = p.base;
  const onSidebar = textOn(sidebar);
  const chipBg = mix(p.base, "#ffffff", 0.86);
  return {
    accent,
    sidebar,
    onSidebar,
    onSidebarMuted: onSidebar === "#ffffff" ? mix(sidebar, "#ffffff", 0.78) : "#374151",
    chipBg,
    chipText: ensureContrast(p.base, chipBg, 4.5),
    tint: mix(p.base, "#ffffff", 0.93),
    text: "#1f2328",
    muted: "#5b6470",
    rule: mix(p.base, "#ffffff", 0.7),
  };
}
