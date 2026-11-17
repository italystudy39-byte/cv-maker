// Dev helper: render a draft JSON to PDF in Node. Usage: npx tsx scripts/render-pdf.tsx draft.json out.pdf [a4|mobile] [template]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, renderToBuffer } from "@react-pdf/renderer";
import { ResumeDoc } from "../src/components/templates/ResumeDoc";
import { pdfPrimsFor } from "../src/components/templates/pdfPrims";

const [, , draftPath, out, variant = "a4", template] = process.argv;
const d = JSON.parse(readFileSync(draftPath, "utf8"));
if (template) d.settings.template = template;
const f = (n: string) => path.join(process.cwd(), "public/fonts", n);
Font.register({ family: "Roboto", fonts: [{ src: f("Roboto_400Regular.ttf"), fontWeight: 400 }, { src: f("Roboto_400Regular_Italic.ttf"), fontWeight: 400, fontStyle: "italic" }, { src: f("Roboto_500Medium.ttf"), fontWeight: 500 }, { src: f("Roboto_700Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "PTSerif", fonts: [{ src: f("PTSerif_400Regular.ttf"), fontWeight: 400 }, { src: f("PTSerif_400Regular_Italic.ttf"), fontWeight: 400, fontStyle: "italic" }, { src: f("PTSerif_700Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Montserrat", fonts: [{ src: f("Montserrat_400Regular.ttf"), fontWeight: 400 }, { src: f("Montserrat_600SemiBold.ttf"), fontWeight: 600 }, { src: f("Montserrat_800ExtraBold.ttf"), fontWeight: 800 }] });
Font.registerHyphenationCallback((w) => [w]);
renderToBuffer(
  <Document>
    <ResumeDoc resume={d.resume} settings={d.settings} P={pdfPrimsFor(variant as "a4")} variant={variant as "a4"} />
  </Document>,
).then((b) => writeFileSync(out, b));
