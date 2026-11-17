# WAF log viewer

A one-page Next.js app over `data/waf-logs-sample.csv` (5,000 web-firewall
requests). It shows:

- total requests by action;
- the top 10 client IPs by blocked requests;
- the 50 most recent requests.

Filters for action and time range update all three, and are applied in SQL.

## Run it

Needs **Node 22.13 or newer**, for the built-in `node:sqlite` module. No
database server is needed.

```bash
npm install
npm run db:load     # loads the CSV into data/waf.db; safe to run again
npm run dev         # http://localhost:3000
```

Checks:

```bash
npm test            # SQL edge cases, filter input, loading
npm run typecheck
```

To load a different file: `npm run db:load path/to/file.csv`.

## How it fits together

| File | What it does |
|---|---|
| `scripts/load.ts` | The `db:load` command: reads the CSV, writes the database |
| `src/lib/schema.ts` | Table, indexes, the timestamp format, the list of actions |
| `src/lib/load.ts` | Parses and validates the CSV, replaces the table in one transaction |
| `src/lib/filters.ts` | Checks the URL's filter values and turns them into query values |
| `src/lib/queries.ts` | The three queries, sharing one `WHERE` builder |
| `src/lib/db.ts` | The app's read-only database connection |
| `src/app/page.tsx` | The page: filter form and three tables |
| `tests/` | Tests against an in-memory database with the real schema |

## Decisions

- **SQLite through Node's built-in module.** There's no server to run and
  nothing native to compile. Postgres would need a server for 5,000 rows.
- **Timestamps stored as UTC text in one fixed format,**
  `YYYY-MM-DDTHH:MM:SSZ`. Comparing the strings then gives the same order as
  comparing the times, and the values stay readable. Every value is checked
  against that format, both at load and in the filters.
- **The load is all or nothing.** It replaces the table in one transaction,
  so running it twice gives the same result. A single invalid row rejects the
  file, with its line number. For security logs, I'd rather refuse a file than
  silently drop rows.
- **Filters live in the URL and are checked before any query runs.** The
  three queries share one `WHERE` builder, and values are bound as `?`
  parameters.
- **A server component and a plain GET form,** with no API layer and no
  client-side JavaScript of my own.
- **Indexes on `ts` and `(action, ts)`,** and a fixed sort order: count then
  IP for the top IPs, and `ts DESC, id DESC` for recent requests. Some
  timestamps appear more than once, so `id` breaks the ties.

### Where the brief was open, I chose

- **Time zone:** the filter times are UTC, like the data. The form labels say
  so.
- **Range ends:** From is included and To is not. From must be before To.
- **The action filter and the top IPs:** the action filter applies to the
  top-IPs list too. Filtering on ALLOW or COUNT leaves it empty, and the page
  says why.
- **Invalid filter input:** the page shows a message and no data, rather than
  falling back to unfiltered numbers.

## With more time

- Show times in the viewer's own time zone, with a UTC toggle.
- Show the date range the data covers next to the filters.
- Replace the full reload with an append-only import, using a key per
  source line, for logs that keep arriving.
- Store timestamps as epoch integers once the data is large.
- Add one browser test that submits the form, and run the tests in CI.
