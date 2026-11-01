import { randomBytes } from "node:crypto";

// ID curto e URL-safe (16 bytes aleatórios em base64url)
export function createId(): string {
  return randomBytes(16).toString("base64url");
}
