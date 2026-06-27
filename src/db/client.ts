import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.NODE_ENV === "production" ? 20 : 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
  ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

export async function checkDatabase(): Promise<void> {
  await db.query("SELECT 1");
}
