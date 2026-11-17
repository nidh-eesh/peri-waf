import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DB_PATH = path.join(process.cwd(), "data", "waf.db");

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  db ??= new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}