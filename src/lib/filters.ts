import { isAction, isDbTimestamp, type Action } from "./schema";

export type Filters = {
  action: Action | null;
  from: string | null;
  to: string | null;
};

export type FilterResult = { ok: true; filters: Filters } | { ok: false; error: string };

type SearchParams = Record<string, string | string[] | undefined>;

// Reads the action, from and to query parameters. An empty value means no filter.
// Returns an error message instead of throwing, so the page can show it.
export function parseFilters(params: SearchParams): FilterResult {
  const action = first(params.action);
  const from = first(params.from);
  const to = first(params.to);

  if (action && !isAction(action)) {
    return { ok: false, error: `Unknown action "${action}". Choose ALLOW, BLOCK or COUNT.` };
  }

  const fromTs = from ? parseTimeInput(from) : null;
  if (from && !fromTs) return { ok: false, error: "From is not a valid date and time." };

  const toTs = to ? parseTimeInput(to) : null;
  if (to && !toTs) return { ok: false, error: "To is not a valid date and time." };

  if (fromTs && toTs && fromTs >= toTs) {
    return { ok: false, error: "From must be before To." };
  }

  return { ok: true, filters: { action: isAction(action) ? action : null, from: fromTs, to: toTs } };
}

const INPUT_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/;

export function parseTimeInput(value: string): string | null {
  const match = INPUT_PATTERN.exec(value);
  if (!match) return null;
  const candidate = `${match[1]}${match[2] ?? ":00"}Z`;
  return isDbTimestamp(candidate) ? candidate : null;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}