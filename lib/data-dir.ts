import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL) return path.join(os.tmpdir(), "lool-network-desk");
  return path.join(process.cwd(), "data");
}

export function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

export function cacheDir(): string {
  return path.join(dataDir(), "cache");
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
