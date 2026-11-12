// Rutas del monorepo para los scripts de este paquete.
import { existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const resolve = (p: string) => pathResolve(ROOT, p);
export { existsSync };
