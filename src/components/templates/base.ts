import { Globe, Mail, MapPin, Phone, Send, User, type IconNode } from "lucide";
import type { ReactNode } from "react";

/**
 * Templates are written once against these primitives and rendered twice:
 * as HTML for the live preview and as @react-pdf/renderer nodes for export.
 * Numbers are points in PDF and CSS pixels in HTML, so layouts match 1:1.
 */
export type Style = Record<string, string | number | undefined>;

export interface Prims {
  View: (p: { style?: Style; fixed?: boolean; wrap?: boolean; children?: ReactNode }) => ReactNode;
  /** onEdit makes the text editable in place in the HTML preview (ignored in PDF). */
  Text: (p: { style?: Style; children?: ReactNode; onEdit?: (v: string) => void }) => ReactNode;
  Link: (p: { src: string; style?: Style; children?: ReactNode }) => ReactNode;
  Image: (p: { src: string; style?: Style }) => ReactNode;
  /** Lucide-style stroke icon: path data on a 24×24 grid, stroke 1.5, no fill. */
  Icon: (p: { d: string[]; size: number; color: string }) => ReactNode;
  /** Root: page in PDF, sheet in HTML. */
  Page: (p: { size: { width: number; height?: number }; style?: Style; children?: ReactNode }) => ReactNode;
}

export const ICON_STROKE = 1.5;

/** Flatten a Lucide icon node to path strings, so the PDF needs only <Path>. */
function toPaths(node: IconNode): string[] {
  const n = (v: unknown) => Number(v ?? 0);
  return node.map(([tag, a]) => {
    if (tag === "path") return String(a.d);
    if (tag === "circle") {
      const [cx, cy, r] = [n(a.cx), n(a.cy), n(a.r)];
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
    if (tag === "rect") {
      const [x, y, w, h] = [n(a.x), n(a.y), n(a.width), n(a.height)];
      const r = Math.min(n(a.rx), w / 2, h / 2);
      return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
    }
    if (tag === "line") return `M${n(a.x1)} ${n(a.y1)}L${n(a.x2)} ${n(a.y2)}`;
    if (tag === "polyline") return "M" + String(a.points).trim().split(/\s+/).join("L");
    return "";
  });
}

// Lucide dropped brand icons; this is its former LinkedIn glyph.
const LINKEDIN: IconNode = [
  ["path", { d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" }],
  ["rect", { x: "2", y: "9", width: "4", height: "12" }],
  ["circle", { cx: "4", cy: "4", r: "2" }],
];

// DESIGN 5: Phone, Mail, Send (Telegram), Linkedin, Globe, MapPin.
export const ICONS = {
  phone: toPaths(Phone),
  email: toPaths(Mail),
  telegram: toPaths(Send),
  linkedin: toPaths(LINKEDIN),
  portfolio: toPaths(Globe),
  city: toPaths(MapPin),
  age: toPaths(User),
};
