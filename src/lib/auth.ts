import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE = "fin_session";

/** 会话令牌 = HMAC(密码, 密钥)。密码不变则令牌固定，足够 2 人内部工具使用。 */
export function sessionToken(): string {
  return createHmac("sha256", env.sessionSecret)
    .update(env.appPassword)
    .digest("hex");
}

export function verifyToken(token?: string | null): boolean {
  if (!token) return false;
  const expected = sessionToken();
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  return input === env.appPassword;
}
