import { getResponseForGivenPrompt } from "./GeminiFunctions";
import { toNumber } from "./toNumber";

// robust JSON extractor
function extractJson(text: string) {
  try {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last === -1) return null;
    return JSON.parse(text.slice(first, last + 1));
  } catch (err) {
    console.warn("Failed to parse JSON from AI:", err);
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

// build small column summary (sample rows)
function buildColumnSummary(rows: Record<string, any>[], sampleLimit = 100) {
  if (!Array.isArray(rows) || rows.length === 0) return { columns: [] };
  const sample = rows.slice(0, Math.min(sampleLimit, rows.length));
  const keys = Object.keys(sample[0] || {});
  return keys.map((k) => {
    const seen = new Set<any>();
    let numericCount = 0;
    let numericMin = Infinity;
    let numericMax = -Infinity;
    for (const r of sample) {
      const v = r[k];
      seen.add(String(v));
      const n = toNumber(v);
      if (!Number.isNaN(n) && n !== 0) {
        numericCount++;
        numericMin = Math.min(numericMin, n);
        numericMax = Math.max(numericMax, n);
      }
    }
    const likelyNumeric = numericCount / Math.max(1, sample.length) > 0.5;
    return {
      name: k,
      likelyNumeric,
      sample: Array.from(seen).slice(0, 8),
      uniqueSampleCount: seen.size,
      numericSummary: likelyNumeric
        ? {
            min: numericMin === Infinity ? null : numericMin,
            max: numericMax === -Infinity ? null : numericMax,
          }
        : null,
    };
  });
}

/**
 * Ask Gemini to pick a single aggregation target (metric) for the dataset.
 * Returns { metric: string | null, aggregation: "sum"|"avg"|"count", reason: string }
 */
export async function suggestAggregationMetric(
  rows: Record<string, any>[],
  sampleLimit = 100
) {
  const sampleRows = Array.isArray(rows)
    ? rows.slice(0, Math.min(sampleLimit, rows.length))
    : [];
  if (sampleRows.length === 0)
    return { metric: null, aggregation: "sum", reason: "No data available" };

  const columnSummary: any = buildColumnSummary(sampleRows, sampleLimit);

  const prompt = `
You are given a summary of dataset columns (name, whether likely numeric, sample values). RETURN JSON ONLY.

Task: Choose the single best numeric column to use as a metric for aggregation charts (e.g. bar, pie, line totals). If multiple numeric columns exist, prefer the one that looks like a monetary/total/sales field or the one with broad unique numeric values. If none look numeric, return null.

Return exactly this JSON schema and nothing else:
{
  "metric": <string|null>,          // the column name to aggregate
  "aggregation": <"sum"|"avg"|"count">,  // recommended aggregation
  "reason": <string>                // 1-2 sentence justification
}

Column summary:
${JSON.stringify(columnSummary)}
`;

  const raw = await getResponseForGivenPrompt(prompt);
  const parsed = extractJson(raw);
  // Validate parsed shape
  if (!parsed || typeof parsed !== "object") {
    return {
      metric: null,
      aggregation: "sum",
      reason: "AI did not return valid JSON",
    };
  }
  const metric = parsed.metric ?? null;
  const aggregation = parsed.aggregation ?? "sum";
  const reason = parsed.reason ?? "";

  // Extra validation: ensure metric exists and is likely numeric (fallbacks)
  const colNames = columnSummary.map((c: any) => c.name);
  if (metric && !colNames.includes(metric)) {
    // try fuzzy match (simple, case-insensitive & underscore/space tolerant)
    const lower = (s: string) => s.toLowerCase().replace(/\s|_/g, "");
    const targetKey = lower(metric);
    const fuzzy = columnSummary.find((c: any) => lower(c.name) === targetKey);
    if (fuzzy) {
      return {
        metric: fuzzy.name,
        aggregation,
        reason: (reason || "") + " (fuzzy-matched column name)",
      };
    }
    // invalid metric returned
    return {
      metric: null,
      aggregation: "sum",
      reason: "AI suggested a column not present in the data",
    };
  }

  // If metric not provided, fallback to pick a numeric column automatically
  if (!metric) {
    const auto = columnSummary.find(
      (c: any) =>
        c.likelyNumeric &&
        /valor|value|total|price|amount|sales|cost/i.test(c.name)
    );
    if (auto)
      return {
        metric: auto.name,
        aggregation: "sum",
        reason: "Fallback: auto-picked likely sales/amount column",
      };
    const anyNumeric = columnSummary.find((c: any) => c.likelyNumeric);
    if (anyNumeric)
      return {
        metric: anyNumeric.name,
        aggregation: "sum",
        reason: "Fallback: first numeric column detected",
      };
    // nothing numeric
    return {
      metric: null,
      aggregation: "count",
      reason: "No numeric columns found; default to count",
    };
  }

  return { metric, aggregation, reason };
}
