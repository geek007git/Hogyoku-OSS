import { Queue } from "bullmq";
import { config } from "../config.js";

export interface IngestionJob {
  documentId: string;
  userId: string;
}

export function redisConnection() {
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

export const ingestionQueue = new Queue<IngestionJob>("document-ingestion", {
  connection: redisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 500,
    removeOnFail: 1_000,
  },
});
