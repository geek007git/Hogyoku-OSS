import { Worker } from "bullmq";
import { config } from "./config.js";
import { redisConnection, type IngestionJob } from "./lib/queue.js";
import { ingestDocument } from "./services/ingestion.js";

const worker = new Worker<IngestionJob>(
  "document-ingestion",
  async (job) => {
    await ingestDocument(job.data.documentId, job.data.userId);
  },
  {
    connection: redisConnection(),
    concurrency: Math.max(1, Number(process.env.WORKER_CONCURRENCY || 2)),
    lockDuration: 10 * 60 * 1000,
  },
);

worker.on("completed", (job) => {
  console.log(`Ingested document ${job.data.documentId}`);
});
worker.on("failed", (job, error) => {
  console.error(`Ingestion failed for ${job?.data.documentId ?? "unknown"}`, error);
});

const shutdown = async (signal: string) => {
  console.log(`Worker received ${signal}`);
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`Hogyoku worker connected to ${new URL(config.REDIS_URL).host}`);
