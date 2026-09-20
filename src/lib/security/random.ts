import { randomBytes } from "node:crypto";

export function randomSecret(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomPassword(length = 16): string {
  return randomBytes(Math.ceil(length * 0.75))
    .toString("base64url")
    .slice(0, length);
}
