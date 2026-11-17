// Usage: npm run db:load [path/to/file.csv]
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "../src/lib/db";
import { parseLogCsv, replaceAllRows } from "../src/lib/load";

const csvPath = process.argv[2] ?? "data/waf-logs-sample.csv";

try {
  const rows = parseLogCsv(readFileSync(csvPath, "utf8"));
  const db = new DatabaseSync(DB_PATH);
  try {
    replaceAllRows(db, rows);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number };
    console.log(`Loaded ${n} rows from ${csvPath} into ${DB_PATH}`);
  } finally {
    db.close();
  }
} catch (error) {
  console.error(`Load failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}