import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generatePlayerRecoveryToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPlayerRecoveryToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyPlayerRecoveryToken(token: string, hash: string): boolean {
  const tokenHash = hashPlayerRecoveryToken(token);
  const left = Buffer.from(tokenHash, "utf8");
  const right = Buffer.from(hash, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function getPlayerRecoveryTokenCookieName(slug: string): string {
  return `bingra-player-recovery-token-${slug}`;
}
