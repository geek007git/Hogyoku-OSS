import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import { config, isProduction } from "../config.js";
import { db } from "../db/client.js";

export const SESSION_COOKIE = "hogyoku_session";
const SESSION_DAYS = 30;

function tokenHash(token: string): string {
  return createHash("sha256")
    .update(`${config.SESSION_SECRET}:${token}`)
    .digest("hex");
}

export async function createSession(
  userId: string,
  reply: FastifyReply,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    "INSERT INTO sessions(user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash(token), expiresAt],
  );
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession(
  token: string | undefined,
  reply: FastifyReply,
): Promise<void> {
  if (token) {
    await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  }
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null;
  const result = await db.query<{
    id: string;
    email: string;
    display_name: string;
  }>(
    `SELECT users.id, users.email, users.display_name
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
    [tokenHash(token)],
  );
  const row = result.rows[0];
  return row
    ? { id: row.id, email: row.email, displayName: row.display_name }
    : null;
}
