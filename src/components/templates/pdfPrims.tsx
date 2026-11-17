// Note: react-pdf treats a present-but-undefined `wrap` prop as wrap=false, so props are only passed when set.
import { Image, Link, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import { ICON_STROKE, type Prims } from "./base";
import type { Variant } from "./ResumeDoc";

/* eslint-disable @typescript-eslint/no-explicit-any */
const pdfPrims: Prims = {
  View: ({ style, fixed, wrap, children }) => (
    <View style={style as any} {...(fixed ? { fixed: true } : null)} {...(wrap === false ? { wrap: false } : null)}>
      {children}
    </View>
  ),
  Text: ({ style, children }) => <Text style={style as any}>{children}</Text>,
  Link: ({ src, style, children }) => (
    <Link src={src} style={{ textDecoration: "none", ...(style as any) }}>
      {children}
    </Link>
  ),
  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
  Image: ({ src, style }) => <Image src={src} style={style as any} />,
  Icon: ({ d, size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {d.map((x, i) => (
        <Path key={i} d={x} fill="none" stroke={color} strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  ),
  Page: ({ size, style, children }) => (
    <Page size={size.height ? [size.width, size.height] : ({ width: size.width } as any)} style={style as any}>
      {children}
    </Page>
  ),
};

// The mobile PDF is one auto-height page; react-pdf splits it if any node has wrap={false}.
const mobilePrims: Prims = {
  ...pdfPrims,
  View: ({ style, fixed, children }) => (
    <View style={style as any} {...(fixed ? { fixed: true } : null)}>
      {children}
    </View>
  ),
};

export const pdfPrimsFor = (v: Variant) => (v === "mobile" ? mobilePrims : pdfPrims);
