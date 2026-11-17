import type { DatabaseSync } from "node:sqlite";
import type { Filters } from "./filters";
import { ACTIONS, type Action } from "./schema";

export type ActionCount = { action: Action; count: number };
export type IpCount = { client_ip: string; blocked: number };
export type RecentRequest = {
  id: number;
  ts: string;
  client_ip: string;
  country: string;
  method: string;
  uri: string;
  action: Action;
  rule_name: string;
};

// Builds the WHERE clause shared by all three queries
function where(filters: Filters, extraConditions: string[] = []) {
  const conditions = [...extraConditions];
  const params: string[] = [];
  if (filters.action) {
    conditions.push("action = ?");
    params.push(filters.action);
  }
  if (filters.from) {
    conditions.push("ts >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("ts < ?");
    params.push(filters.to);
  }
  const sql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql, params };
}

export function countByAction(db: DatabaseSync, filters: Filters): ActionCount[] {
  const w = where(filters);
  const rows = db
    .prepare(`SELECT action, COUNT(*) AS count FROM requests ${w.sql} GROUP BY action`)
    .all(...w.params) as ActionCount[];
  const counts = new Map(rows.map((row) => [row.action, row.count]));
  const shown = filters.action ? [filters.action] : ACTIONS;
  return shown.map((action) => ({ action, count: counts.get(action) ?? 0 }));
}

// The IPs with the most BLOCK requests
export function topBlockedIps(db: DatabaseSync, filters: Filters, limit = 10): IpCount[] {
  const w = where(filters, ["action = 'BLOCK'"]);
  return db
    .prepare(
      `SELECT client_ip, COUNT(*) AS blocked FROM requests ${w.sql}
       GROUP BY client_ip
       ORDER BY blocked DESC, client_ip ASC
       LIMIT ?`,
    )
    .all(...w.params, limit) as IpCount[];
}

// The newest requests
export function recentRequests(db: DatabaseSync, filters: Filters, limit = 50): RecentRequest[] {
  const w = where(filters);
  return db
    .prepare(
      `SELECT id, ts, client_ip, country, method, uri, action, rule_name FROM requests ${w.sql}
       ORDER BY ts DESC, id DESC
       LIMIT ?`,
    )
    .all(...w.params, limit) as RecentRequest[];
}