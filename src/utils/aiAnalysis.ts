// src/utils/aiAnalysis.ts
import { getResponseForGivenPrompt } from "./GeminiFunctions";
import { aggregateRowsToWizardData } from "./transformForWizard";
import { aggregateByTimeSeries } from "./aggregation"; // your earlier helper
import { toNumber } from "./toNumber";
import type { GeneratedChart } from "../components/dashboard/Dashboard";

interface RegenerationState {
  originalChart: GeneratedChart;
  columnSummary: any;
  regenerationAttempts: number;
}

// Build a small per-column summary from sample rows
export function buildColumnSummary(
  rows: Record<string, any>[],
  sampleLimit = 100
) {
  if (!Array.isArray(rows) || rows.length === 0) return { columns: [] };

  const sample = rows.slice(0, Math.min(sampleLimit, rows.length));
  const keys = Object.keys(sample[0] || {});
  const columns: any[] = [];

  for (const k of keys) {
    const seen = new Set<any>();
    let numericCount = 0;
    let numericMin = Infinity;
    let numericMax = -Infinity;

    for (let i = 0; i < sample.length; i++) {
      const v = sample[i][k];
      seen.add(String(v));
      const n = toNumber(v);
      if (!Number.isNaN(n) && n !== 0) {
        numericCount++;
        numericMin = Math.min(numericMin, n);
        numericMax = Math.max(numericMax, n);
      }
    }

    const inferredType =
      numericCount / Math.max(1, sample.length) > 0.6
        ? "numeric"
        : "categorical_or_string";
    columns.push({
      name: k,
      type: inferredType,
      sample: Array.from(seen).slice(0, 8),
      uniqueSampleCount: seen.size,
      numericSummary:
        inferredType === "numeric"
          ? {
              min: numericMin === Infinity ? null : numericMin,
              max: numericMax === -Infinity ? null : numericMax,
            }
          : null,
    });
  }

  return { columns, sampleSize: sample.length };
}

// Build a strict JSON-only prompt. Ask model to return EXACT JSON with no extra narration.
export function buildAIPrompt(columnSummary: any, sampleSize = 50) {
  const prompt = `
You are given a compact summary of a dataset (column names with type hints and small sample values). DO NOT add any text outside the JSON. Return strictly a JSON object that follows this exact schema:

{
  "columns": [
    { "name": <string>, "type": <"numeric"|"categorical"|"date"|"unknown">, "sample": [<values>], "uniqueSampleCount": <int>, "numericSummary": { "min": <number|null>, "max": <number|null> } | null }
  ],
  "recommendedCharts": [
    {
      "chartType": <"bar"|"donut"|"pie"|"line"|"area">,
      "groupBy": <string|null>,            // column name to group by, null if not applicable
      "metric": <string|null>,             // numeric metric column
      "aggregation": <"sum"|"avg"|"count"|"none">,
      "granularity": <"day"|"month-year"|"year"|"none">,
      "topN": <int|null>,
      "explain": <string>                  // short explanation (1-2 sentences)
    }
  ],
  "recommendedCards": [
    {
      "cardType": <"metric"|"topCategory"|"count"|"avg"|"minMax">,
      "field": <string|null>,            // column name used for metric or category; null if not applicable (e.g. count)
      "aggregation": <"sum"|"avg"|"count"|null>,
      "label": <string>,                 // short display label for the card title
      "format": <"currency"|"number"|"percentage"|"text">,
      "topN": <int|null>,                // optional, for topCategory
      "explain": <string>
    }
  ]

}

Now analyze the supplied column metadata and suggest up to 4 charts and up to 4 small dashboard cards that would be useful for a quick glance (e.g., total sales, average order value, number of orders, top categories). Do NOT compute exact numbers — only return the card specs (field, aggregation, label, format, optional topN) so the frontend will compute the values on the real data. Prefer 'sum' for monetary-like columns.

Here is the column summary (JSON):
${JSON.stringify(columnSummary)}

RULES:
- Output only valid JSON that strictly conforms to the schema above.
- Provide up to 4 recommended chart objects, ordered by importance.
- For numeric metrics prefer "sum" for totals (sales) and "avg" if data looks like rates.
- For time-series use granularity "month-year" by default when dates are present.
- If you cannot decide, use null values where appropriate.

Return the JSON only.
`;
  return prompt;
}

export function buildAIRegeneratePrompt({
  originalChart,
  columnSummary,
  regenerationAttempts,
}: RegenerationState) {
  console.log("original chart: ", JSON.stringify(originalChart));

  const prompt = `
    You are given the previous chart recommendation (JSON) and a compact dataset column summary.
    Return JSON ONLY with the same schema used in the original analysis: { recommendedCharts: [ ... ], recommendedCards: [ ... ], columns: [...] }.

    Goal: propose an *alternative* chart recommendation for the user because they rejected the original. Avoid recommending the exact same groupBy+metric as the original; prefer a different metric, group or chart type. If no alternative is possible, indicate an empty recommendedCharts array.

    Original chart:
    ${JSON.stringify(originalChart)}

    Column summary:
    ${JSON.stringify(columnSummary)}

    Return up to 3 alternative recommendedCharts and up to 3 recommendedCards. Use "explain" for a 1-line rationale. The JSON you return must have the same structure of the Original chart json and the same id, only with new recommendations.
  `;

  if (regenerationAttempts > 5) return null;

  return prompt;
}

// helper to extract JSON from possibly noisy response
export function extractJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1)
    throw new Error("No JSON found in AI response");
  const jsonText = text.slice(first, last + 1);
  return JSON.parse(jsonText);
}

/**
 * Main analyze function: returns parsed recommendations or throws.
 */
export async function analyzeDataWithAI(
  rows: Record<string, any>[],
  options?: { sampleLimit?: number }
) {
  const sampleLimit = options?.sampleLimit ?? 200;
  const sampleRows = Array.isArray(rows)
    ? rows.slice(0, Math.min(sampleLimit, rows.length))
    : [];
  if (sampleRows.length === 0) throw new Error("No rows to analyze");

  const columnSummary = buildColumnSummary(sampleRows, sampleLimit);
  const prompt = buildAIPrompt(columnSummary, sampleRows.length);

  const raw = await getResponseForGivenPrompt(prompt); // returns string
  const parsed = extractJson(raw); // your robust extractor
  if (!parsed) throw new Error("AI returned no JSON");

  // parsed.recommendedCharts (existing)
  const recCharts = parsed.recommendedCharts ?? [];
  const recCards = parsed.recommendedCards ?? [];

  // Compute local card values (do not trust AI to compute numbers)
  const cardPayloads = computeCardValues(rows, recCards);

  return {
    columns: parsed.columns,
    recommendedCharts: recCharts,
    recommendedCards: recCards,
    cardPayloads,
  };
}

export async function reAnalyzeDataWithAI(
  originalChart: GeneratedChart,
  regenerationAttempts: number,
  rows: Record<string, any>[],
  options?: { sampleLimit?: number }
) {
  const sampleLimit = options?.sampleLimit ?? 200;
  const sampleRows = Array.isArray(rows)
    ? rows.slice(0, Math.min(sampleLimit, rows.length))
    : [];
  if (sampleRows.length === 0) throw new Error("No rows to analyze");

  const columnSummary = buildColumnSummary(sampleRows, sampleLimit);
  const prompt = buildAIRegeneratePrompt({
    originalChart,
    columnSummary,
    regenerationAttempts,
  });

  if (!prompt) return null;

  const raw = await getResponseForGivenPrompt(prompt); // returns string
  const parsed = extractJson(raw); // your robust extractor
  if (!parsed) throw new Error("AI returned no JSON");

  // parsed.recommendedCharts (existing)
  const recCharts = parsed.recommendedCharts ?? [];
  const recCards = parsed.recommendedCards ?? [];

  // Compute local card values (do not trust AI to compute numbers)
  const cardPayloads = computeCardValues(rows, recCards);

  return {
    columns: parsed.columns,
    recommendedCharts: recCharts,
    recommendedCards: recCards,
    cardPayloads,
  };
}

export function computeCardValues(
  rows: Record<string, any>[],
  cardSpecs: any[]
) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const results = cardSpecs.map((spec: any, idx: number) => {
    const { cardType, field, aggregation, label, format, topN } = spec || {};
    const id = `card-${idx}-${cardType}-${field ?? "all"}`;

    try {
      if (cardType === "metric") {
        // metric: sum/avg/count of a numeric field
        if (!field) throw new Error("metric requires field");
        const values = rows.map((r) => toNumber(r[field]));
        const sum = values.reduce((s, v) => s + v, 0);
        const avg = values.length ? sum / values.length : 0;
        const val =
          aggregation === "avg"
            ? avg
            : aggregation === "count"
              ? values.length
              : sum;
        return {
          id,
          cardType,
          label: label ?? `${aggregation ?? "sum"} ${field}`,
          field,
          value: val,
          format,
          explain: spec.explain,
        };
      }

      if (cardType === "count") {
        // just count rows or count distinct field values if field present
        if (!field)
          return {
            id,
            cardType,
            label: label ?? "Count",
            field: null,
            value: rows.length,
            format: format ?? "number",
            explain: spec.explain,
          };
        const set = new Set(rows.map((r) => String(r[field] ?? "")));
        return {
          id,
          cardType,
          label: label ?? `Count of ${field}`,
          field,
          value: set.size,
          format: format ?? "number",
          explain: spec.explain,
        };
      }

      if (cardType === "topCategory") {
        if (!field) throw new Error("topCategory requires a field");
        // aggregate sums of numeric columns across the group - choose best numeric automatically
        // find the numeric-like column to display value (prefer Valor_Venda-like names)
        const numericField =
          Object.keys(rows[0]).find((k) =>
            /valor|value|total|price|amount|sales|cost/i.test(k)
          ) ??
          Object.keys(rows[0]).find(
            (k) => typeof toNumber(rows[0][k]) === "number"
          );
        // group sums
        const map = new Map<string, number>();
        for (const r of rows) {
          const key = String(r[field] ?? "Unknown");
          const n = numericField ? toNumber(r[numericField]) : 1; // if no numeric, count
          map.set(key, (map.get(key) ?? 0) + n);
        }
        const arr = Array.from(map.entries()).map(([k, v]) => ({
          key: k,
          value: v,
        }));
        arr.sort((a, b) => b.value - a.value);
        const top = topN && topN > 0 ? arr.slice(0, topN) : arr.slice(0, 3);
        return {
          id,
          cardType,
          label: label ?? `Top ${field}`,
          field,
          value: top,
          numericField,
          format: format ?? "number",
          explain: spec.explain,
        };
      }

      if (cardType === "avg") {
        if (!field) throw new Error("avg requires field");
        const values = rows.map((r) => toNumber(r[field]));
        const avg = values.reduce((s, v) => s + v, 0) / (values.length || 1);
        return {
          id,
          cardType,
          label: label ?? `Avg ${field}`,
          field,
          value: avg,
          format: format ?? "number",
          explain: spec.explain,
        };
      }

      if (cardType === "minMax") {
        if (!field) throw new Error("minMax requires field");
        const values = rows.map((r) => toNumber(r[field]));
        const min = Math.min(...values);
        const max = Math.max(...values);
        return {
          id,
          cardType,
          label: label ?? field,
          field,
          value: { min, max },
          format: format ?? "number",
          explain: spec.explain,
        };
      }

      // fallback: return null entry
      return {
        id,
        cardType,
        label: label ?? "Unknown",
        field,
        value: null,
        format,
        explain: spec.explain,
      };
    } catch (err) {
      return {
        id,
        cardType,
        label: label ?? "Error",
        field,
        value: null,
        format,
        explain: String(err),
      };
    }
  });

  return results;
}
