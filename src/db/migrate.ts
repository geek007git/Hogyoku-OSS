import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const bundledMigrationsDir = path.join(currentDir, "migrations");
const sourceMigrationsDir = path.resolve(process.cwd(), "src/db/migrations");
const migrationsDir = await fs
  .access(bundledMigrationsDir)
  .then(() => bundledMigrationsDir)
  .catch(() => sourceMigrationsDir);

await db.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const files = (await fs.readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const applied = await db.query(
    "SELECT 1 FROM schema_migrations WHERE name = $1",
    [file],
  );
  if (applied.rowCount) continue;

  const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`Applied migration ${file}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await db.end();
