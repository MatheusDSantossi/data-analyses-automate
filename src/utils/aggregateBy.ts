import { toNumber } from "./toNumber";

type Row = Record<string, any>;

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
    aggregated.sort((a, b) => (b[valueField] as number) - (a[valueField] as number));
  }

  if (options?.topN && options.topN > 0) {
    aggregated = aggregated.slice(0, options.topN);
  }

  return aggregated;
}
