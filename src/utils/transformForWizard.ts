import { toNumber } from "./toNumber";

export type Row = Record<string, any>;
export type FieldValue = { field: string; value: any };
export type ChartWizardDataRow = FieldValue[];

/** Convert one JS object (row) into ChartWizard row format */
export function objectToWizardRow(obj: Row): ChartWizardDataRow {
  return Object.entries(obj).map(([k, v]) => ({ field: k, value: v }));
}

/**
 * Convert many rows to per-row wizard rows (optionally sample first N rows).
 * Use this when you want the wizard to inspect raw rows rather than aggregated data.
 */
export function rowsToWizardRows(rows: Row[], sampleLimit = 200): ChartWizardDataRow[] {
  if (!Array.isArray(rows)) return [];
  const limit = Math.min(sampleLimit, rows.length);
  const out: ChartWizardDataRow[] = [];
  for (let i = 0; i < limit; i++) out.push(objectToWizardRow(rows[i]));
  return out;
}

/**
 * Aggregate rows by `groupField` and sum numeric `valueFields`.
 * Returns ChartWizardDataRow[] where each row is:
 *   [{ field: groupField, value: groupKey }, { field: valueField1, value: aggregated }, ...]
 *
 * Options:
 *  - topN: keep only top N groups by total (default = keep all)
 *  - sortDesc: sort groups by aggregated total descending (default true)
 *  - includeCount: include a "Count" column with number of original rows per group
 */
export function aggregateRowsToWizardData(
  rows: Row[],
  groupField: string,
  valueFields: string[] = ["Valor_Venda"],
  options?: { topN?: number; sortDesc?: boolean; includeCount?: boolean }
): ChartWizardDataRow[] {
  const { topN = 0, sortDesc = true, includeCount = false } = options || {};
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Map: groupKey -> { sums: Map(valueField -> centsSum), count }
  const map = new Map<string, { sums: Map<string, number>; count: number }>();

  for (const r of rows) {
    const key = String(r[groupField] ?? "Unknown");
    if (!map.has(key)) map.set(key, { sums: new Map<string, number>(), count: 0 });
    const entry = map.get(key)!;
    entry.count += 1;
    for (const vf of valueFields) {
      const n = toNumber(r[vf]);
      const cents = Math.round(n * 100);
      entry.sums.set(vf, (entry.sums.get(vf) ?? 0) + cents);
    }
  }

  // Convert to array with totals for sorting
  const arr = Array.from(map.entries()).map(([key, { sums, count }]) => {
    const totals = valueFields.map((vf) => (sums.get(vf) ?? 0));
    const totalCents = totals.reduce((s, v) => s + v, 0);
    return { key, sums, count, totalCents };
  });

  if (sortDesc) arr.sort((a, b) => b.totalCents - a.totalCents);
  const sliced = topN && topN > 0 ? arr.slice(0, topN) : arr;

  // Build ChartWizardDataRow[] (each row is an array of {field,value})
  const wizardRows: ChartWizardDataRow[] = sliced.map((g) => {
    const row: FieldValue[] = [];
    // group field first
    row.push({ field: groupField, value: g.key });
    // add aggregated numeric fields (convert cents -> float rounded to 2 decimals)
    for (const vf of valueFields) {
      const cents = g.sums.get(vf) ?? 0;
      row.push({ field: vf, value: Number((cents / 100).toFixed(2)) });
    }
    if (includeCount) row.push({ field: "Count", value: g.count });
    return row;
  });

  return wizardRows;
}
