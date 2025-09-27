// src/utils/aiAnalysis.ts
import { getResponseForGivenPrompt } from "./GeminiFunctions";
import { aggregateRowsToWizardData } from "./transformForWizard";
import { aggregateByTimeSeries } from "./aggregation"; // your earlier helper
import { toNumber } from "./toNumber"; 

// Build a small per-column summary from sample rows
export function buildColumnSummary(rows: Record<string, any>[], sampleLimit = 100) {
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

    const inferredType = numericCount / Math.max(1, sample.length) > 0.6 ? "numeric" : "categorical_or_string";
    columns.push({
      name: k,
      type: inferredType,
      sample: Array.from(seen).slice(0, 8),
      uniqueSampleCount: seen.size,
      numericSummary: inferredType === "numeric" ? { min: numericMin === Infinity ? null : numericMin, max: numericMax === -Infinity ? null : numericMax } : null
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
  ]
}

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

// helper to extract JSON from possibly noisy response
export function extractJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("No JSON found in AI response");
  const jsonText = text.slice(first, last + 1);
  return JSON.parse(jsonText);
}

/**
 * Main analyze function: returns parsed recommendations or throws.
 */
export async function analyzeDataWithAI(rows: Record<string, any>[], options?: { sampleLimit?: number }) {
  const sampleLimit = options?.sampleLimit ?? 200;
  const sampleRows = Array.isArray(rows) ? rows.slice(0, Math.min(sampleLimit, rows.length)) : [];
  if (sampleRows.length === 0) throw new Error("No rows to analyze");

  const columnSummary = buildColumnSummary(sampleRows, sampleLimit);
  const prompt = buildAIPrompt(columnSummary, sampleRows.length);

  // call your existing wrapper which returns text
  const raw = await getResponseForGivenPrompt(prompt); // returns string
  const parsed = extractJson(raw);
  return parsed; // { columns, recommendedCharts }
}
