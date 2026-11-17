import assert from "node:assert/strict";
import { test } from "node:test";
import type { Filters } from "../src/lib/filters";
import { countByAction, recentRequests, topBlockedIps } from "../src/lib/queries";
import { makeDb, plain, row } from "./helpers";

const noFilters: Filters = { action: null, from: null, to: null };

test("from is included and to is not", () => {
  const db = makeDb([
    row("2026-11-10T09:59:59Z"),
    row("2026-11-10T10:00:00Z"),
    row("2026-11-10T10:59:59Z"),
    row("2026-11-10T11:00:00Z"),
  ]);
  const filters = { ...noFilters, from: "2026-11-10T10:00:00Z", to: "2026-11-10T11:00:00Z" };

  const times = recentRequests(db, filters).map((r) => r.ts);
  assert.deepEqual(times, ["2026-11-10T10:59:59Z", "2026-11-10T10:00:00Z"]);
  assert.deepEqual(countByAction(db, filters), [
    { action: "ALLOW", count: 2 },
    { action: "BLOCK", count: 0 },
    { action: "COUNT", count: 0 },
  ]);
});

test("the action filter applies to all three queries", () => {
  const db = makeDb([
    row("2026-11-10T10:00:00Z", "ALLOW"),
    row("2026-11-10T10:00:01Z", "BLOCK"),
    row("2026-11-10T10:00:02Z", "COUNT"),
  ]);
  const filters = { ...noFilters, action: "ALLOW" as const };

  assert.deepEqual(countByAction(db, filters), [{ action: "ALLOW", count: 1 }]);
  assert.deepEqual(topBlockedIps(db, filters), []);
  assert.deepEqual(
    recentRequests(db, filters).map((r) => r.action),
    ["ALLOW"],
  );
});

test("top IPs count only BLOCK, sort by count then IP, and stop at 10", () => {
  const rows = [row("2026-11-10T10:00:00Z", "ALLOW", "192.0.2.99")]; // allowed, never counted
  // 192.0.2.1 to 192.0.2.12 blocked once each; 192.0.2.5 and 192.0.2.7 blocked a second time.
  for (let i = 1; i <= 12; i++) rows.push(row("2026-11-10T10:00:00Z", "BLOCK", `192.0.2.${i}`));
  rows.push(row("2026-11-10T10:00:01Z", "BLOCK", "192.0.2.7"));
  rows.push(row("2026-11-10T10:00:01Z", "BLOCK", "192.0.2.5"));
  const db = makeDb(rows);

  const top = plain(topBlockedIps(db, noFilters));
  assert.equal(top.length, 10);
  assert.deepEqual(top.slice(0, 4), [
    { client_ip: "192.0.2.5", blocked: 2 },
    { client_ip: "192.0.2.7", blocked: 2 },
    { client_ip: "192.0.2.1", blocked: 1 },
    { client_ip: "192.0.2.10", blocked: 1 }, // ties sort as text, so .10 comes before .2
  ]);
  assert.ok(!top.some((r) => r.client_ip === "192.0.2.99"));
});

test("recent requests are newest first, id breaks ties, and stop at 50", () => {
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push(row(`2026-11-10T10:00:${String(i % 30).padStart(2, "0")}Z`));
  const db = makeDb(rows); // ids 1-60; every timestamp appears twice (ids n and n + 30)

  const recent = recentRequests(db, noFilters);
  assert.equal(recent.length, 50);
  assert.deepEqual(
    recent.slice(0, 3).map((r) => [r.ts, r.id]),
    [
      ["2026-11-10T10:00:29Z", 60],
      ["2026-11-10T10:00:29Z", 30],
      ["2026-11-10T10:00:28Z", 59],
    ],
  );
});

test("no matching rows gives zero counts and empty lists", () => {
  const db = makeDb([row("2026-11-10T10:00:00Z", "BLOCK")]);
  const filters = { ...noFilters, from: "2030-01-01T00:00:00Z" };

  assert.deepEqual(
    countByAction(db, filters).map((r) => r.count),
    [0, 0, 0],
  );
  assert.deepEqual(topBlockedIps(db, filters), []);
  assert.deepEqual(recentRequests(db, filters), []);
});

test("filter values are bound as parameters, not pasted into the SQL", () => {
  const db = makeDb([row("2026-11-10T10:00:00Z", "BLOCK")]);
  // parseFilters would reject this; here we bypass it to prove the query itself is safe.
  const filters = { ...noFilters, action: "BLOCK' OR '1'='1" } as unknown as Filters;

  assert.deepEqual(recentRequests(db, filters), []);
});