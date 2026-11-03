import "server-only";
import { randomInt } from "node:crypto";

// Sem caracteres ambíguos (0/O, 1/l/I) para a senha temporária ser fácil de ditar e digitar.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Ex.: "Kx7m-Qp3R-w9Tn" (12 caracteres, ~68 bits). */
export function generateTempPassword(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((g) => g.join(""))
    .join("-");
}

export const MIN_PASSWORD_LENGTH = 8;
