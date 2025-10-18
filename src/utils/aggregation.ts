import { toNumber } from "./toNumber";
type Row = Record<string, any>;

type Granularity = "day" | "month" | "month-year" | "year";

type AggregateOptions = {
  dateField?: string; // e.g. "Data_Pedido"
  valueField?: string; // e.g. "Valor_Venda"
  groupByField?: string | null; // e.g. "Categoria" (optional; null => single series aggregated)
  granularity?: Granularity;
  topN?: number | null; // keep only top N groups by total (null = keep all)
  fillMissing?: boolean; // fill zero for empty month buckets so all series align
  localeMonthLabels?: string; // locale for month labels, e.g. 'en-US' or 'pt-BR'
};

// --- small robust date parser for common formats (DD/MM/YYYY, YYYY-MM-DD, etc.)
function parseDateFlexible(value: any): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  // ISO-like or YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  // DD/MM/YYYY or D/M/YYYY
  // Common slash/dash formats: dd/mm/yyyy or mm/dd/yyyy
  // eslint-disable-next-line no-useless-escape
  const dm = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]) - 1;
    const year = Number(dm[3]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  // fallback: try Date constructor (may parse MM/DD/YYYY in some envs)
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Convert numeric-ish strings to number (re-using earlier heuristic)
// function toNumber(value: any): number {
//   if (value === null || value === undefined || value === "") return 0;
//   if (typeof value === "number") return value;
//   const text = String(value).trim();
//   const cleaned = text.replace(/[^\d.,\-]/g, "");
//   if (cleaned.includes(".") && cleaned.includes(",")) {
//     return Number(cleaned.replace(/\./g, "").replace(/,/g, "."));
//   }
//   if (cleaned.includes(",") && !cleaned.includes(".")) {
//     const commaDecimal = /,\d{1,3}$/.test(cleaned);
//     if (commaDecimal) return Number(cleaned.replace(/,/g, "."));
//     return Number(cleaned.replace(/,/g, ""));
//   }
//   const normalized = cleaned.replace(/,/g, "");
//   const num = Number(normalized);
//   return Number.isFinite(num) ? num : 0;
// }

// Format a bucket key and a human-friendly label
function bucketKeyAndLabel(
  date: Date,
  granularity: Granularity,
  locale = "en-US"
) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-based
  const d = date.getDate();
  if (granularity === "year") {
    return { key: `${y}`, label: `${y}` };
  }
  if (granularity === "month" || granularity === "month-year") {
    // label like "Jan 2020" (locale-aware)
    const label = new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
    }).format(date);
    const key = `${y}-${String(m + 1).padStart(2, "0")}`; // "2020-01"
    return { key, label };
  }
  // day granularity
  const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
  return { key, label };
}

/**
 * Aggregate rows into chart-friendly time-series.
 * Returns: { categories: string[], series: { name: string, data: number[] }[] }
 */
export function aggregateByTimeSeries(
  rows: Row[] = [],
  opts: AggregateOptions = {}
) {
  const {
    dateField = "Data_Pedido",
    valueField = "Valor_Venda",
    groupByField = "Categoria",
    granularity = "month-year",
    topN = null,
    // fillMissing = true,
    localeMonthLabels = "en-US",
  } = opts;

  // Map: groupName -> Map(bucketKey -> sumInCents)
  const groupMap = new Map<string, Map<string, number>>();
  // Map bucketKey -> label (we need to keep label)
  const bucketLabels = new Map<string, string>();

  // accumulate in integer cents to avoid floating rounding noise
  for (const r of rows) {
    const date = parseDateFlexible(r[dateField]);
    if (!date) continue; // skip invalid dates
    const { key, label } = bucketKeyAndLabel(
      date,
      granularity,
      localeMonthLabels
    );
    bucketLabels.set(key, label);

    const groupName = groupByField
      ? String(r[groupByField] ?? "Unknown")
      : "__all__";
    const value = toNumber(r[valueField]);
    const cents = Math.round(value * 100);

    if (!groupMap.has(groupName)) groupMap.set(groupName, new Map());
    const g = groupMap.get(groupName)!;
    g.set(key, (g.get(key) ?? 0) + cents);
  }

  // collect sorted bucket keys (chronological)
  // convert keys to Date for sort
  const uniqueBuckets = Array.from(bucketLabels.keys());
  uniqueBuckets.sort((a, b) => {
    // parse "YYYY-MM" or "YYYY-MM-DD" or "YYYY"
    const da = new Date(
      a + (a.length === 4 ? "-01-01" : a.length === 7 ? "-01" : "")
    );
    const db = new Date(
      b + (b.length === 4 ? "-01-01" : b.length === 7 ? "-01" : "")
    );
    return da.getTime() - db.getTime();
  });

  // optionally filter groups to topN by total
  let groups = Array.from(groupMap.entries()).map(([name, vals]) => {
    const totalCents = Array.from(vals.values()).reduce((s, v) => s + v, 0);
    return { name, vals, totalCents };
  });

  groups.sort((a, b) => b.totalCents - a.totalCents);
  if (topN && topN > 0) groups = groups.slice(0, topN);

  // categories and aligned series data arrays
  const categories = uniqueBuckets.map((k) => bucketLabels.get(k) ?? k);

  const series = groups.map((g) => {
    const arr: number[] = uniqueBuckets.map((bk) => {
      const cents = g.vals.get(bk) ?? 0;
      return cents / 100; // back to float with cents precision
    });
    return { name: g.name, data: arr, total: g.totalCents / 100 };
  });

  // If fillMissing=false, you might prefer sparse arrays per series; we keep alignment by default.

  // console.log("rows: ", rows);
  // console.log("aggregate: ", opts);

  return { categories, series };
}

export function aggregateBy(
  rows: Row[] = [],
  categoryField = "Categoria",
  valueField = "Valor_Venda",
  options?: { topN?: number; sortDesc?: boolean }
) {
  const map = new Map<string, number>();

  for (const r of rows) {
    const cat = (r[categoryField] ?? "N/A").toString();
    const num = toNumber(r[valueField]);

    map.set(cat, (map.get(cat) ?? 0) + num);
  }

  let aggregated = Array.from(map.entries()).map(([category, value]) => ({
    [categoryField]: category,
    [valueField]: Number(value.toFixed(2)),
  }));

  //   Sort and take top N (if asked)
  if (options?.sortDesc ?? true) {
    aggregated.sort(
      (a, b) => (b[valueField] as number) - (a[valueField] as number)
    );
  }

  if (options?.topN && options.topN > 0) {
    aggregated = aggregated.slice(0, options.topN);
  }

  return aggregated;
}
