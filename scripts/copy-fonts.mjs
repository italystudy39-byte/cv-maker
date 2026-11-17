// Copies the template TTFs (Cyrillic) from @expo-google-fonts into public/fonts before the build,
// so the binary fonts do not have to be uploaded with every deploy.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FILES = {
  "@expo-google-fonts/roboto": ["Roboto_400Regular.ttf", "Roboto_500Medium.ttf", "Roboto_700Bold.ttf"],
  "@expo-google-fonts/pt-serif": ["PTSerif_400Regular.ttf", "PTSerif_700Bold.ttf"],
  "@expo-google-fonts/montserrat": ["Montserrat_400Regular.ttf", "Montserrat_600SemiBold.ttf", "Montserrat_800ExtraBold.ttf"],
};
const out = join(process.cwd(), "public", "fonts");
mkdirSync(out, { recursive: true });

function find(dir, name) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === name) return p;
    if (statSync(p).isDirectory() && e !== "node_modules") {
      const hit = find(p, name);
      if (hit) return hit;
    }
  }
}

for (const [pkg, names] of Object.entries(FILES)) {
  const missing = names.filter((n) => !existsSync(join(out, n)));
  if (!missing.length) continue;
  const root = dirname(require.resolve(`${pkg}/package.json`));
  for (const n of missing) {
    const src = find(root, n);
    if (!src) throw new Error(`Font ${n} not found in ${pkg}`);
    copyFileSync(src, join(out, n));
    console.log("font", n);
  }
}
