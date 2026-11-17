import { Document } from "@react-pdf/renderer";
import type { ResumeDocument } from "@/lib/types";
import { pdfPrimsFor } from "./pdfPrims";
import { ResumeDoc, type Variant } from "./ResumeDoc";

/** The react-pdf document for a resume; shared by the server route and the client fallback. */
export function ResumePdfDocument({ doc, variant }: { doc: ResumeDocument; variant: Variant }) {
  const p = doc.personal;
  return (
    <Document title={`${p.fullName} — резюме`} author={p.fullName} subject={p.targetTitle} creator="AI Resume Builder" language="ru">
      <ResumeDoc doc={doc} P={pdfPrimsFor(variant)} variant={variant} />
    </Document>
  );
}
