import { existsSync } from "node:fs";
import { DB_PATH, getDb } from "../lib/db";
import { parseFilters, type Filters } from "../lib/filters";
import { countByAction, recentRequests, topBlockedIps } from "../lib/queries";
import { ACTIONS } from "../lib/schema";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const result = parseFilters(params);

  return (
    <main>
      <h1>WAF requests</h1>
      <FilterForm params={params} />
      {!existsSync(DB_PATH) ? (
        <p className="error">
          No database found. Run <code>npm run db:load</code> first.
        </p>
      ) : result.ok ? (
        <Results filters={result.filters} />
      ) : (
        <p className="error" role="alert">
          {result.error}
        </p>
      )}
    </main>
  );
}

function FilterForm({ params }: { params: SearchParams }) {
  const value = (name: string) => {
    const v = params[name];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  return (
    <form method="get" className="filters">
      <label>
        Action
        <select name="action" defaultValue={value("action")}>
          <option value="">All</option>
          {ACTIONS.map((action) => (
            <option key={action}>{action}</option>
          ))}
        </select>
      </label>
      <label>
        From (UTC)
        <input type="datetime-local" name="from" defaultValue={value("from")} />
      </label>
      <label>
        To (UTC)
        <input type="datetime-local" name="to" defaultValue={value("to")} />
      </label>
      <button type="submit">Apply</button>
      <a href="/">Reset</a>
      <p className="hint">From is included, To is not.</p>
    </form>
  );
}

function Results({ filters }: { filters: Filters }) {
  const db = getDb();
  const counts = countByAction(db, filters);
  const topIps = topBlockedIps(db, filters);
  const recent = recentRequests(db, filters);
  const total = counts.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <h2>Requests by action</h2>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Requests</th>
          </tr>
        </thead>
        <tbody>
          {counts.map((row) => (
            <tr key={row.action}>
              <td>{row.action}</td>
              <td className="num">{row.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <td className="num">{total}</td>
          </tr>
        </tfoot>
      </table>

      <h2>Top 10 client IPs by blocked requests</h2>
      {topIps.length === 0 ? (
        <p className="empty">
          {filters.action && filters.action !== "BLOCK"
            ? `No blocked requests: the action filter is set to ${filters.action}.`
            : "No blocked requests for this filter."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Client IP</th>
              <th>Blocked</th>
            </tr>
          </thead>
          <tbody>
            {topIps.map((row) => (
              <tr key={row.client_ip}>
                <td>{row.client_ip}</td>
                <td className="num">{row.blocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>50 most recent requests</h2>
      {recent.length === 0 ? (
        <p className="empty">No requests for this filter.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time (UTC)</th>
              <th>Client IP</th>
              <th>Country</th>
              <th>Method</th>
              <th>URI</th>
              <th>Action</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((row) => (
              <tr key={row.id}>
                <td>{row.ts}</td>
                <td>{row.client_ip}</td>
                <td>{row.country}</td>
                <td>{row.method}</td>
                <td className="uri">{row.uri}</td>
                <td>{row.action}</td>
                <td>{row.rule_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}