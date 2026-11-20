// Prepara los clips reales de data/clips.json: recorta cada tramo, lo escala a 1080×1920 a 30 fps
// (los apaisados van centrados sobre una copia desenfocada) y concatena los tramos de cada carrete.
// Los vídeos de origen viven fuera del repositorio (videos-tiktok/ en la raíz); la salida va a
// public/clips/<slug>-<carrete>.mp4 más un PNG con su último fotograma (el congelado del gol).
// Uso: npm run clips:prepare [-- --props=./data/clips.json --src=../../videos-tiktok --only=slug]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const propsPath = resolve(root, arg("props") ?? "data/clips.json");
const srcDir = resolve(root, arg("src") ?? "../../videos-tiktok");
const only = arg("only");
const outDir = join(root, "public", "clips");
mkdirSync(outDir, { recursive: true });

const FPS = 30;
const W = 1080;
const H = 1920;

const items = JSON.parse(readFileSync(propsPath, "utf8")).filter((it) => !only || it.slug === only);
if (items.length === 0) throw new Error("No hay vídeos que preparar.");

const run = (bin, args) => execFileSync(bin, args, { stdio: ["ignore", "pipe", "inherit"] }).toString();

const dims = new Map();
function dim(name) {
  if (!dims.has(name)) {
    const file = join(srcDir, name);
    if (!existsSync(file)) throw new Error(`No existe el vídeo de origen ${file}`);
    const info = JSON.parse(
      run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file]),
    );
    dims.set(name, { w: info.streams[0].width, h: info.streams[0].height });
  }
  return dims.get(name);
}

for (const item of items) {
  item.reels.forEach((reel, r) => {
    const frames = reel.segments.map((s) => Math.round((s.to - s.from) * FPS));
    const args = ["-y", "-v", "error"];
    const filters = [];

    reel.segments.forEach((s, i) => {
      args.push("-ss", String(s.from), "-t", String(frames[i] / FPS + 0.5), "-i", join(srcDir, s.src));
      const { w, h } = dim(s.src);
      // Se clona el último fotograma por si el origen se queda corto, y se corta al número exacto.
      const tail = `tpad=stop_mode=clone:stop_duration=1,trim=end_frame=${frames[i]},setpts=PTS-STARTPTS[v${i}]`;
      if (w / h < 0.66) {
        // Vertical: llena la pantalla recortando lo justo.
        filters.push(
          `[${i}:v]fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,${tail}`,
        );
      } else {
        // Cuadrado o apaisado: a todo el ancho, sobre una copia desenfocada y oscurecida, algo por
        // encima del centro para que el cartel de GOL CONFIRMADO no tape la imagen.
        filters.push(
          `[${i}:v]fps=${FPS},split[a${i}][b${i}];` +
            `[a${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=28:2,eq=brightness=-0.22:saturation=0.75[bg${i}];` +
            `[b${i}]scale=${W}:-2:flags=lanczos[fg${i}];` +
            `[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2-160,setsar=1,${tail}`,
        );
      }
    });

    const n = reel.segments.length;
    filters.push(`${reel.segments.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0,format=yuv420p[out]`);

    const out = join(outDir, `${item.slug}-${r}.mp4`);
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[out]", "-an", "-r", String(FPS),
      // Sin fotogramas B y con fotograma clave cada 15: el extractor de Remotion (OffthreadVideo)
      // falla con "No frame found at position" si no.
      "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-bf", "0", "-g", "15",
      "-movflags", "+faststart",
      out,
    );
    execFileSync("ffmpeg", args, { stdio: "inherit" });

    const expected = frames.reduce((a, b) => a + b, 0);
    const got = Number(
      run("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", out]).trim(),
    );
    if (got !== expected) console.warn(`  aviso: ${out} tiene ${got} fotogramas y se esperaban ${expected}`);

    const png = join(outDir, `${item.slug}-${r}.png`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", out, "-vf", `select=eq(n\\,${got - 1})`, "-frames:v", "1", "-update", "1", png], { stdio: "inherit" });
    console.log(`✓ ${item.slug} carrete ${r}: ${n} tramos, ${got} fotogramas (${(got / FPS).toFixed(1)} s)`);
  });
}
