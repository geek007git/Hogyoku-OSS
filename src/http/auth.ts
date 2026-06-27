import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import {
  createSession,
  deleteSession,
  getSessionUser,
  SESSION_COOKIE,
} from "../lib/sessions.js";

const credentialsSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(2).max(80).optional(),
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    request.user = await getSessionUser(request.cookies[SESSION_COOKIE]);
  });

  app.post("/api/auth/register", async (request, reply) => {
    const input = credentialsSchema.parse(request.body);
    const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [
      input.email,
    ]);
    if (existing.rowCount) {
      return reply.code(409).send({ error: "An account already exists for this email." });
    }
    const result = await db.query<{ id: string }>(
      `INSERT INTO users(email, display_name, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [
        input.email,
        input.displayName ?? input.email.split("@")[0],
        await hashPassword(input.password),
      ],
    );
    await createSession(result.rows[0]!.id, reply);
    return reply.code(201).send({ ok: true });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const input = credentialsSchema.omit({ displayName: true }).parse(request.body);
    const result = await db.query<{
      id: string;
      password_hash: string;
    }>("SELECT id, password_hash FROM users WHERE email = $1", [input.email]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      return reply.code(401).send({ error: "Invalid email or password." });
    }
    await createSession(user.id, reply);
    return { ok: true };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await deleteSession(request.cookies[SESSION_COOKIE], reply);
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Authentication required." });
    return { user: request.user };
  });
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    await reply.code(401).send({ error: "Authentication required." });
  }
}
