import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { config } from "./config.js";
import { checkDatabase } from "./db/client.js";
import { registerAuthRoutes } from "./http/auth.js";
import { registerDocumentRoutes } from "./http/documents.js";
import { registerThreadRoutes } from "./http/threads.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: config.MAX_UPLOAD_MB * 1024 * 1024,
    requestIdHeader: "x-request-id",
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: config.APP_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.user?.id ?? request.ip,
  });
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
      parts: 10,
    },
  });

  app.decorateRequest("user", null);
  app.addHook("onRequest", async (request, reply) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
      request.headers.origin &&
      request.headers.origin !== config.APP_ORIGIN
    ) {
      await reply.code(403).send({ error: "Invalid request origin." });
    }
  });

  app.get("/api/health", async () => {
    await checkDatabase();
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  await registerAuthRoutes(app);
  await registerDocumentRoutes(app);
  await registerThreadRoutes(app);

  const publicDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../public",
  );
  await app.register(staticPlugin, {
    root: publicDir,
    wildcard: false,
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "API route not found." });
    }
    return reply.sendFile("index.html");
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "Request failed");
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid request.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const knownError = error instanceof Error ? error : new Error("Unknown error");
    const candidateStatus =
      "statusCode" in knownError && typeof knownError.statusCode === "number"
        ? knownError.statusCode
        : 500;
    const statusCode = candidateStatus < 500 ? candidateStatus : 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? "Internal server error." : knownError.message,
    });
  });

  return app;
}
