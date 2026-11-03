// Genera efectos de sonido sintéticos (sin derechos de terceros) con ffmpeg.
// Uso: npm run sfx  → public/sfx/*.wav
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sfx");
mkdirSync(outDir, { recursive: true });

const sounds = {
  // Golpe seco del gancho: bombo grave con caída rápida.
  hit: "sine=f=70:d=0.35,volume=2.2,afade=t=out:st=0.02:d=0.33",
  // Whoosh: ruido rosa filtrado con subida y caída.
  whoosh:
    "anoisesrc=c=pink:d=0.4:a=0.5,highpass=f=600,lowpass=f=4000,afade=t=in:d=0.15,afade=t=out:st=0.15:d=0.25",
  // Tic de la cuenta atrás.
  tick: "sine=f=1400:d=0.05,afade=t=out:st=0.005:d=0.045",
  // Pitido de árbitro estilizado (dos tonos alternos).
  whistle:
    "aevalsrc='0.35*sin(2*PI*(2900+120*sin(2*PI*28*t))*t)':d=0.55:s=44100,afade=t=in:d=0.02,afade=t=out:st=0.4:d=0.15",
  // Zumbido de la sala VAR mientras se revisa.
  buzz: "aevalsrc='0.18*sin(2*PI*110*t)+0.08*sin(2*PI*220*t)':d=0.9:s=44100,tremolo=f=9:d=0.6,afade=t=in:d=0.1,afade=t=out:st=0.7:d=0.2",
  // Confirmación: arpegio ascendente.
  confirm:
    "aevalsrc='0.3*sin(2*PI*523*t)*between(t,0,0.12)+0.3*sin(2*PI*659*t)*between(t,0.1,0.22)+0.3*sin(2*PI*784*t)*between(t,0.2,0.34)+0.3*sin(2*PI*1046*t)*between(t,0.32,0.8)':d=0.8:s=44100,afade=t=out:st=0.45:d=0.35",
};

for (const [name, filter] of Object.entries(sounds)) {
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "lavfi", "-i", filter, "-ac", "2", "-ar", "44100", join(outDir, `${name}.wav`)],
    { stdio: "inherit" },
  );
  console.log(`✓ ${name}.wav`);
}
