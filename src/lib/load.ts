import { isIP } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { parse } from "csv-parse/sync";
import { createSchema, isAction, isDbTimestamp, type LogRow } from "./schema";

const COLUMNS = ["timestamp", "client_ip", "country", "method", "uri", "action", "rule_name"] as const;
type CsvRecord = Record<(typeof COLUMNS)[number], string>;

// Parses the CSV and checks every row. Throws on the first bad row, naming its line,
// so a broken file never gets half-loaded.
export function parseLogCsv(text: string): LogRow[] {
  const records: { record: CsvRecord; info: { lines: number } }[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    info: true,
  });
  return records.map(({ record, info }) => toLogRow(record, info.lines));
}

function toLogRow(r: CsvRecord, line: number): LogRow {
  const fail = (message: string): never => {
    throw new Error(`Line ${line}: ${message}`);
  };
  for (const column of COLUMNS) {
    if (!r[column]) return fail(`missing ${column}`);
  }
  if (!isDbTimestamp(r.timestamp)) return fail(`timestamp "${r.timestamp}" is not a valid YYYY-MM-DDTHH:MM:SSZ time`);
  if (isIP(r.client_ip) === 0) return fail(`client_ip "${r.client_ip}" is not an IP address`);
  if (!isAction(r.action)) return fail(`action "${r.action}" is not ALLOW, BLOCK or COUNT`);

  return {
    ts: r.timestamp,
    client_ip: r.client_ip,
    country: r.country,
    method: r.method,
    uri: r.uri,
    action: r.action,
    rule_name: r.rule_name,
  };
}

// Replaces the whole table in one transaction: running the load twice gives the same
// result, and if anything fails the previous data is left untouched.
export function replaceAllRows(db: DatabaseSync, rows: LogRow[]): void {
  db.exec("BEGIN");
  try {
    db.exec("DROP TABLE IF EXISTS requests");
    createSchema(db);
    const insert = db.prepare(
      `INSERT INTO requests (ts, client_ip, country, method, uri, action, rule_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of rows) {
      insert.run(row.ts, row.client_ip, row.country, row.method, row.uri, row.action, row.rule_name);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}