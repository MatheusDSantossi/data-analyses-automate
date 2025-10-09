// Returns array of column name that look like dates
export function detectDateColumns(
  rows: Record<string, any>[],
  sampleLimit = 200
) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const sample = rows.slice(0, Math.min(sampleLimit, rows.length));
  const keys = Object.keys(sample[0] || {});
  const dateCols: string[] = [];

  for (const k of keys) {
    let dateCount = 0;
    let nonEmpty = 0;
    for (let i = 0; i < sample.length; i++) {
      const v = sample[i][k];
      if (v === null || v === undefined || v === "") continue;
      nonEmpty++;

      //   Accept Date objects, or strings that parse into reasonable Date
      if (v instanceof Date && !isNaN(v.getTime())) {
        dateCount++;
        continue;
      }
    }
    const ratio = nonEmpty === 0 ? 0 : dateCount / nonEmpty;

    if (ratio >= 0.6) dateCols.push(k);
  }
  return dateCols;
}
