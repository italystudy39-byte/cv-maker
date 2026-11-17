"use client";
import { Font, pdf } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/lib/fonts";
import type { ResumeDocument } from "@/lib/types";
import { ResumePdfDocument } from "./pdfDocument";
import type { Variant } from "./ResumeDoc";

let fontsReady = false;

/** Client-side PDF rendering, used when the export API is unreachable. */
export async function renderPdfInBrowser(doc: ResumeDocument, variant: Variant): Promise<Blob> {
  if (!fontsReady) {
    registerPdfFonts(Font, window.location.origin + "/fonts/");
    fontsReady = true;
  }
  return pdf(<ResumePdfDocument doc={doc} variant={variant} />).toBlob();
}
