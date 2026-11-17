import { DatabaseSync } from "node:sqlite";
import { replaceAllRows } from "../src/lib/load";
import type { Action, LogRow } from "../src/lib/schema";

// A fresh in-memory database with the real schema, loaded with the given rows.
export function makeDb(rows: LogRow[]): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  replaceAllRows(db, rows);
  return db;
}

// A row with sensible defaults, so each test only spells out what it cares about.
export function row(ts: string, action: Action = "ALLOW", client_ip = "192.0.2.1"): LogRow {
  return { ts, client_ip, country: "US", method: "GET", uri: "/", action, rule_name: "Default_Action" };
}

export function plain<T extends object>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r }));
}