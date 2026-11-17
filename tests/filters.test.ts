import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFilters } from "../src/lib/filters";

test("empty or missing values mean no filter", () => {
  const none = { ok: true, filters: { action: null, from: null, to: null } };
  assert.deepEqual(parseFilters({}), none);
  assert.deepEqual(parseFilters({ action: "", from: "", to: "" }), none);
});

test("form values are converted to the database time format", () => {
  assert.deepEqual(parseFilters({ action: "BLOCK", from: "2026-11-10T13:45", to: "2026-11-11T00:00:30" }), {
    ok: true,
    filters: { action: "BLOCK", from: "2026-11-10T13:45:00Z", to: "2026-11-11T00:00:30Z" },
  });
});

test("bad input gives a message instead of filters", () => {
  const error = (params: Record<string, string>) => {
    const result = parseFilters(params);
    return result.ok ? null : result.error;
  };
  assert.equal(error({ action: "block" }), 'Unknown action "block". Choose ALLOW, BLOCK or COUNT.');
  assert.equal(error({ from: "yesterday" }), "From is not a valid date and time.");
  assert.equal(error({ to: "2026-02-30T00:00" }), "To is not a valid date and time.");
  assert.equal(error({ from: "2026-11-12T00:00", to: "2026-11-11T00:00" }), "From must be before To.");
  assert.equal(error({ from: "2026-11-12T00:00", to: "2026-11-12T00:00" }), "From must be before To.");
});