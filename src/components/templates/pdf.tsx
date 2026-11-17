"use client";
import { Document, Font, pdf } from "@react-pdf/renderer";
import type { Resume, Settings } from "@/lib/types";
import { pdfPrimsFor } from "./pdfPrims";
import { ResumeDoc, type Variant } from "./ResumeDoc";

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const base = window.location.origin + "/fonts/";
  Font.register({
    family: "Roboto",
    fonts: [
      { src: base + "Roboto_400Regular.ttf", fontWeight: 400 },
      { src: base + "Roboto_400Regular_Italic.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: base + "Roboto_500Medium.ttf", fontWeight: 500 },
      { src: base + "Roboto_700Bold.ttf", fontWeight: 700 },
    ],
  });
  Font.register({
    family: "PTSerif",
    fonts: [
      { src: base + "PTSerif_400Regular.ttf", fontWeight: 400 },
      { src: base + "PTSerif_400Regular_Italic.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: base + "PTSerif_700Bold.ttf", fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Montserrat",
    fonts: [
      { src: base + "Montserrat_400Regular.ttf", fontWeight: 400 },
      { src: base + "Montserrat_600SemiBold.ttf", fontWeight: 600 },
      { src: base + "Montserrat_800ExtraBold.ttf", fontWeight: 800 },
    ],
  });
  // Keep words whole: no automatic hyphenation in Russian text.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

export async function renderPdf(resume: Resume, settings: Settings, variant: Variant): Promise<Blob> {
  registerFonts();
  const doc = (
    <Document title={`${resume.fullName} — резюме`} author={resume.fullName} subject={resume.title} creator="AI Resume Builder" language="ru">
      <ResumeDoc resume={resume} settings={settings} P={pdfPrimsFor(variant)} variant={variant} />
    </Document>
  );
  return pdf(doc).toBlob();
}
