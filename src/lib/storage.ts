import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Storage de arquivos atrás de uma interface mínima.
 * Hoje grava em disco (UPLOAD_DIR); para produção, troque a implementação
 * por S3/R2 mantendo as mesmas três funções.
 */
function baseDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
}

function resolveKey(key: string) {
  const full = path.resolve(baseDir(), key);
  if (!full.startsWith(baseDir() + path.sep)) {
    throw new Error("Chave de storage inválida.");
  }
  return full;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "text/plain",
]);

export async function saveFile(tripId: string, file: File): Promise<string> {
  const ext = path.extname(file.name).slice(0, 10).replace(/[^.\w]/g, "");
  const key = `${tripId}/${randomBytes(16).toString("hex")}${ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deleteStoredFile(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}
