/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

/**
 * Templates are written once against these primitives and rendered twice:
 * as HTML for the live preview and as @react-pdf/renderer nodes for export.
 * Numbers are points in PDF and CSS pixels in HTML, so layouts match 1:1.
 */
export type Style = Record<string, string | number | undefined>;

export interface Prims {
  View: (p: { style?: Style; fixed?: boolean; wrap?: boolean; children?: ReactNode }) => ReactNode;
  Text: (p: { style?: Style; children?: ReactNode }) => ReactNode;
  Link: (p: { src: string; style?: Style; children?: ReactNode }) => ReactNode;
  Image: (p: { src: string; style?: Style }) => ReactNode;
  Icon: (p: { d: string; size: number; color: string }) => ReactNode;
  /** Root: page in PDF, sheet in HTML. */
  Page: (p: { size: { width: number; height?: number }; style?: Style; children?: ReactNode }) => ReactNode;
}

const SHORTHANDS: Record<string, string[]> = {
  paddingHorizontal: ["paddingLeft", "paddingRight"],
  paddingVertical: ["paddingTop", "paddingBottom"],
  marginHorizontal: ["marginLeft", "marginRight"],
  marginVertical: ["marginTop", "marginBottom"],
};

/** Translate react-pdf style shorthands into CSS. */
function css(s?: Style): CSSProperties {
  if (!s) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined) continue;
    const pair = SHORTHANDS[k];
    if (pair) for (const p of pair) out[p] = v;
    else out[k] = v;
  }
  return out as CSSProperties;
}

/** Text nested in Text renders inline, like in react-pdf. */
const InText = createContext(false);

function HtmlText({ style, children }: { style?: Style; children?: ReactNode }) {
  const nested = useContext(InText);
  if (nested) return <span style={css(style)}>{children}</span>;
  return (
    <InText.Provider value={true}>
      <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...css(style) }}>{children}</div>
    </InText.Provider>
  );
}

export const htmlPrims: Prims = {
  View: ({ style, fixed, children }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
        minWidth: 0,
        ...(fixed ? { position: "absolute" } : null),
        ...css(style),
      }}
    >
      {children}
    </div>
  ),
  Text: HtmlText,
  Link: ({ src, style, children }) => (
    <a href={src} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", ...css(style) }}>
      {children}
    </a>
  ),
  Image: ({ src, style }) => <img src={src} alt="" style={{ display: "block", ...css(style) }} />,
  Icon: ({ d, size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: "block" }}>
      <path d={d} fill={color} />
    </svg>
  ),
  Page: ({ size, style, children }) => (
    <div
      className="resume-sheet"
      style={{
        width: size.width,
        minHeight: size.height,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
        background: "#fff",
        ...css(style),
      }}
    >
      {children}
    </div>
  ),
};

export const ICONS = {
  phone:
    "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
  email:
    "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  telegram: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
  linkedin:
    "M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.34 18.34V10H5.67v8.34h2.67zM7 8.83a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.34 9.51v-4.57c0-2.45-1.31-3.6-3.06-3.6-1.41 0-2.04.78-2.39 1.32V10h-2.67c.04.75 0 8.34 0 8.34h2.67v-4.66c0-.25.02-.5.09-.68.2-.5.65-1.01 1.41-1.01.99 0 1.39.76 1.39 1.87v4.48h2.56z",
  portfolio:
    "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  city: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  age: "M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12C21 10.34 19.66 9 18 9z",
};
