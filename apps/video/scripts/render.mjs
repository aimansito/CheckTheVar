// Renderiza un MP4 por pregunta del lote.
// Uso: npm run render                         → data/lote.json (QuizShort)
//      npm run render -- --clips              → data/clips.json (ClipShort, con clips reales) → out/clips/
//      npm run render -- --props=./data/otro.json
//      npm run render -- --only=03-balon-de-oro
//      npm run render -- --covers             → portadas/*.png
//      npm run render -- --stills             → stills/*.png (revisión); --frames=30,120,-130 elige cuáles (negativo = desde el final)
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const clips = process.argv.includes("--clips");
const compositionId = clips ? "ClipShort" : "QuizShort";
const propsPath = resolve(root, arg("props") ?? (clips ? "data/clips.json" : "data/lote.json"));
const only = arg("only");
const stillsOnly = process.argv.includes("--stills");
const coversOnly = process.argv.includes("--covers");
const frames = arg("frames")?.split(",").map(Number) ?? [30, 180, 268, 360, 430];
const items = JSON.parse(readFileSync(propsPath, "utf8")).filter((it) => !only || it.slug === only);
if (items.length === 0) throw new Error("No hay preguntas que renderizar.");

const outDir = join(root, "out", clips ? "clips" : "");
mkdirSync(outDir, { recursive: true });

console.log("Empaquetando…");
const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts") });

for (const item of items) {
  const inputProps = { item };
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });

  if (coversOnly) {
    // Portada para TikTok: pregunta visible, sin respuesta.
    const output = join(outDir, "portadas", `${item.slug}.png`);
    await renderStill({ composition, serveUrl, inputProps, frame: clips ? 110 : 100, output });
    console.log(`✓ ${output}`);
    continue;
  }

  if (stillsOnly) {
    // Fotogramas clave para revisar el diseño sin renderizar el vídeo entero.
    for (const f of frames) {
      // Negativo = contando desde el final (útil porque cada vídeo dura distinto).
      const frame = Math.min(f < 0 ? composition.durationInFrames + f : f, composition.durationInFrames - 1);
      await renderStill({ composition, serveUrl, inputProps, frame, output: join(outDir, "stills", `${item.slug}-${frame}.png`) });
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
    // Con clips reales, la caché de fotogramas por defecto se queda corta al renderizar en
    // paralelo y Remotion falla con "No frame found at position".
    ...(clips ? { offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024, concurrency: 4 } : {}),
    onProgress: ({ progress }) => process.stdout.write(`\r${item.slug}: ${Math.round(progress * 100)} %`),
  });
  console.log(`\n✓ ${output} (${(composition.durationInFrames / composition.fps).toFixed(1)} s)`);
}
