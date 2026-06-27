import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/client.js";
import { ingestionQueue } from "./lib/queue.js";
import { ensureBucket } from "./lib/storage.js";

const app = await buildApp();

try {
  await ensureBucket();
  await app.listen({ host: "0.0.0.0", port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Shutting down");

  const forceExit = setTimeout(() => {
    app.log.error("Graceful shutdown timed out; forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await app.close();
    await ingestionQueue.close();
    await db.end();
  } catch (error) {
    app.log.error({ error }, "Error during shutdown");
    clearTimeout(forceExit);
    process.exit(1);
  }

  clearTimeout(forceExit);
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
