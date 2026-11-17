import type { DatabaseSync } from "node:sqlite";

export const ACTIONS = ["ALLOW", "BLOCK", "COUNT"] as const;
export type Action = (typeof ACTIONS)[number];

export function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}

export type LogRow = {
  ts: string;
  client_ip: string;
  country: string;
  method: string;
  uri: string;
  action: Action;
  rule_name: string;
};

const TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export function toDbTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19) + "Z"; // drop the milliseconds
}

export function isDbTimestamp(value: string): boolean {
  if (!TS_PATTERN.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && toDbTimestamp(date) === value;
}

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE requests (
      id        INTEGER PRIMARY KEY,
      ts        TEXT NOT NULL,
      client_ip TEXT NOT NULL,
      country   TEXT NOT NULL,
      method    TEXT NOT NULL,
      uri       TEXT NOT NULL,
      action    TEXT NOT NULL CHECK (action IN ('ALLOW', 'BLOCK', 'COUNT')),
      rule_name TEXT NOT NULL
    );
    CREATE INDEX requests_ts ON requests (ts);
    CREATE INDEX requests_action_ts ON requests (action, ts);
  `);
}