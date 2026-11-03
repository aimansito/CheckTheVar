// Renderiza un MP4 por pregunta del lote.
// Uso: npm run render                         → data/lote.json
//      npm run render -- --props=./data/otro.json
//      npm run render -- --only=03-balon-de-oro
//      npm run render -- --covers             → out/portadas/*.png
//      npm run render -- --stills             → out/stills/*.png (revisión)
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const propsPath = resolve(root, arg("props") ?? "data/lote.json");
const only = arg("only");
const stillsOnly = process.argv.includes("--stills");
const coversOnly = process.argv.includes("--covers");
const items = JSON.parse(readFileSync(propsPath, "utf8")).filter((it) => !only || it.slug === only);
if (items.length === 0) throw new Error("No hay preguntas que renderizar.");

const outDir = join(root, "out");
mkdirSync(outDir, { recursive: true });

console.log("Empaquetando…");
const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts") });

for (const item of items) {
  const inputProps = { item };
  const composition = await selectComposition({ serveUrl, id: "QuizShort", inputProps });

  if (coversOnly) {
    // Portada para TikTok: pregunta y opciones visibles, sin respuesta.
    const output = join(outDir, "portadas", `${item.slug}.png`);
    await renderStill({ composition, serveUrl, inputProps, frame: 100, output });
    console.log(`✓ ${output}`);
    continue;
  }

  if (stillsOnly) {
    // Fotogramas clave para revisar el diseño sin renderizar el vídeo entero.
    for (const f of [30, 180, 268, 360, 430]) {
      await renderStill({ composition, serveUrl, inputProps, frame: f, output: join(outDir, "stills", `${item.slug}-${f}.png`) });
    }
    console.log(`✓ fotogramas de ${item.slug}`);
    continue;
  }

  const output = join(outDir, `${item.slug}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    inputProps,
    outputLocation: output,
    crf: 18,
    onProgress: ({ progress }) => process.stdout.write(`\r${item.slug}: ${Math.round(progress * 100)} %`),
  });
  console.log(`\n✓ ${output}`);
}
