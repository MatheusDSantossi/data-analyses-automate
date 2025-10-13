// Returns array of column name that look like dates
export function detectDateColumns(
  rows: Record<string, any>[],
  sampleLimit = 200,
  threshold = 0.6,
  preferDayFirst = true
) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const sample = rows.slice(0, Math.min(sampleLimit, rows.length));
  const keys = Object.keys(sample[0] || {});
  const dateCols: string[] = [];

  function looksLikeDate(value: any) {
    if (value === null || value === undefined) return false;

    if (value instanceof Date && !isNaN(value.getTime())) return true;

    const s = String(value).trim();
    if (s === "") return false;

    // ISO-like: 2020-01-02 or 2020-01-02T
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const parsed = Date.parse(s);
      return !Number.isNaN(parsed);
    }

    // Common slash/dash formats: dd/mm/yyyy or mm/dd/yyyy
    // eslint-disable-next-line no-useless-escape
    const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dm) {
      const a = parseInt(dm[1], 10);
      const b = parseInt(dm[2], 10);
      let y = parseInt(dm[3], 10);

      if (y < 100) y += 2000; // 21 -> 2021

      let day: number, month: number;
      // if one part > 12 it's the day
      if (a > 12 && b <= 12) {
        day = a;
        month = b;
      } else if (b > 12 && a <= 12) {
        day = a;
        month = b;
      } else {
        // ambiguous: use preferDayFirst setting
        if (preferDayFirst) {
          day = a;
          month = b;
        } else {
          day = b;
          month = a;
        }
      }
      // basic sanity check
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dt = new Date(y, month - 1, day);
        return !Number.isNaN(dt.getTime());
      }
      return false;
    }

    // 3) month-name / textual dates (e.g. "May 7, 2020" "Wed May 07 2025 21:00:00")
    if (/[A-Za-z]{3,}/.test(s)) {
      const p = Date.parse(s);
      if (!Number.isNaN(p)) return true;
    }

    // 4) epoch-like numeric strings (10-13 digits)
    if (/^\d{10, 13}$/.test(s)) {
      const asNum = Number(s);
      // if 10-digit, assume seconds -> multiply; if 13-digit assume ms
      const ms = s.length === 10 ? asNum * 1000 : asNum;
      const dt = new Date(ms);
      return !Number.isNaN(dt.getTime());
    }

    // fallback: try Date.parse (best-effort)
    const fallback = Date.parse(s);
    return !Number.isNaN(fallback);
  }

  for (const k of keys) {
    let dateCount = 0;
    let nonEmpty = 0;
    for (let i = 0; i < sample.length; i++) {
      const v = sample[i][k];
      if (v === null || v === undefined || v === "") continue;
      nonEmpty++;

      if (looksLikeDate(v)) dateCount++;
    }
    const ratio = nonEmpty === 0 ? 0 : dateCount / nonEmpty;

    console.log("ratio: ", ratio);

    if (ratio >= threshold) dateCols.push(k);
  }
  return dateCols;
}
