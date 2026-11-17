"use client";
/* eslint-disable @next/next/no-img-element */
import React, { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { ICON_STROKE, type Prims, type Style } from "./base";

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

function HtmlText({ style, children, onEdit }: { style?: Style; children?: ReactNode; onEdit?: (v: string) => void }) {
  const nested = useContext(InText);
  if (nested) return <span style={css(style)}>{children}</span>;
  return (
    <InText.Provider value={true}>
      <div
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...css(style) }}
        {...(onEdit
          ? {
              contentEditable: true,
              suppressContentEditableWarning: true,
              className: "resume-editable",
              title: "Нажмите, чтобы изменить текст",
              onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
                const v = e.currentTarget.innerText.trim();
                if (v !== String(children ?? "").trim()) onEdit(v);
              },
              onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              },
            }
          : null)}
      >
        {children}
      </div>
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
    <a href={src} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block", ...css(style) }}>
      {children}
    </a>
  ),
  Image: ({ src, style }) => <img src={src} alt="" style={{ display: "block", ...css(style) }} />,
  Icon: ({ d, size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "block" }}>
      {d.map((x, i) => (
        <path key={i} d={x} />
      ))}
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

