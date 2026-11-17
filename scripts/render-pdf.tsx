// Dev helper: render a ResumeDocument JSON to PDF in Node (see README). Args: doc.json out.pdf [a4|mobile] [template]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, renderToBuffer } from "@react-pdf/renderer";
import { ResumeDoc } from "../src/components/templates/ResumeDoc";
import { registerPdfFonts } from "../src/lib/fonts";
import { pdfPrimsFor } from "../src/components/templates/pdfPrims";

const [, , draftPath, out, variant = "a4", template] = process.argv;
const d = JSON.parse(readFileSync(draftPath, "utf8"));
registerPdfFonts(Font, path.join(process.cwd(), "public/fonts") + path.sep);
if (template) d.meta.template = template;
renderToBuffer(
  <Document>
    <ResumeDoc doc={d} P={pdfPrimsFor(variant as "a4")} variant={variant as "a4"} />
  </Document>,
).then((b) => writeFileSync(out, b));
