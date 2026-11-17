import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLogCsv, replaceAllRows } from "../src/lib/load";
import type { LogRow } from "../src/lib/schema";
import { makeDb, plain, row } from "./helpers";

const HEADER = "timestamp,client_ip,country,method,uri,action,rule_name";

test("parses Windows line endings, quoted commas and IPv6", () => {
  const csv = `${HEADER}\r\n2026-11-10T00:03:44Z,2001:db8::1,DE,GET,"/search?q=a,b",BLOCK,XSS-Generic\r\n`;
  assert.deepEqual(parseLogCsv(csv), [
    {
      ts: "2026-11-10T00:03:44Z",
      client_ip: "2001:db8::1",
      country: "DE",
      method: "GET",
      uri: "/search?q=a,b",
      action: "BLOCK",
      rule_name: "XSS-Generic",
    },
  ]);
});

test("a bad row rejects the whole file and names its line", () => {
  const csv = `${HEADER}\n2026-11-10T00:03:44Z,192.0.2.1,US,GET,/,ALLOW,x\n2026-11-10T00:03:45Z,192.0.2.1,US,GET,/,allow,x\n`;
  assert.throws(() => parseLogCsv(csv), /^Error: Line 3: action "allow"/);
});

test("loading twice gives the same rows and ids", () => {
  const rows = [row("2026-11-10T10:00:00Z"), row("2026-11-10T10:00:01Z")];
  const db = makeDb(rows);
  replaceAllRows(db, rows);

  assert.deepEqual(plain(db.prepare("SELECT id, ts FROM requests ORDER BY id").all()), [
    { id: 1, ts: "2026-11-10T10:00:00Z" },
    { id: 2, ts: "2026-11-10T10:00:01Z" },
  ]);
});

test("a failed load leaves the previous data in place", () => {
  const db = makeDb([row("2026-11-10T10:00:00Z")]);
  const badRow = { ...row("2026-11-10T10:00:01Z"), action: "DROP" } as unknown as LogRow;

  assert.throws(() => replaceAllRows(db, [row("2026-11-10T10:00:02Z"), badRow]), /CHECK constraint failed/);
  assert.deepEqual(plain(db.prepare("SELECT ts FROM requests").all()), [{ ts: "2026-11-10T10:00:00Z" }]);
});