// Font files shared by the browser preview (globals.css), client PDF export and the server PDF route.
export const FONT_FILES: { family: string; file: string; weight: number }[] = [
  { family: "Roboto", file: "Roboto_400Regular.ttf", weight: 400 },
  { family: "Roboto", file: "Roboto_500Medium.ttf", weight: 500 },
  { family: "Roboto", file: "Roboto_700Bold.ttf", weight: 700 },
  { family: "PT Serif", file: "PTSerif_400Regular.ttf", weight: 400 },
  { family: "PT Serif", file: "PTSerif_700Bold.ttf", weight: 700 },
  { family: "Montserrat", file: "Montserrat_400Regular.ttf", weight: 400 },
  { family: "Montserrat", file: "Montserrat_600SemiBold.ttf", weight: 600 },
  { family: "Montserrat", file: "Montserrat_800ExtraBold.ttf", weight: 800 },
];

type FontApi = {
  register: (o: { family: string; fonts: { src: string; fontWeight: number }[] }) => void;
  registerHyphenationCallback: (cb: (w: string) => string[]) => void;
};

/** Register fonts with @react-pdf/renderer; `base` is a URL prefix or a filesystem directory. */
export function registerPdfFonts(Font: FontApi, base: string) {
  const families = [...new Set(FONT_FILES.map((f) => f.family))];
  for (const family of families) {
    Font.register({
      family,
      fonts: FONT_FILES.filter((f) => f.family === family).map((f) => ({ src: base + f.file, fontWeight: f.weight })),
    });
  }
  // Keep words whole: no automatic hyphenation in Russian text.
  Font.registerHyphenationCallback((w) => [w]);
}
