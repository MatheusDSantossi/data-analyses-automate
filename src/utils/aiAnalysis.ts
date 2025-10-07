// src/utils/aiAnalysis.ts
import { getResponseForGivenPrompt } from "./GeminiFunctions";
import { aggregateRowsToWizardData } from "./transformForWizard";
import { aggregateByTimeSeries } from "./aggregation"; // your earlier helper
import { toNumber } from "./toNumber";
import type { GeneratedChart } from "../components/dashboard/Dashboard";
import { fuzzyMatchColumn } from "./fields";

interface RegenerationState {
  originalChart: GeneratedChart;
  aiPreviousRecommendations: any;
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
  aiPreviousRecommendations,
  columnSummary,
  regenerationAttempts,
}: RegenerationState) {
  // console.log("original chart: ", JSON.stringify(originalChart));

  // preparing simple lsit of column names (safe)
  const columnNames =
    columnSummary && Array.isArray(columnSummary.columns)
      ? columnSummary.columns.map((c: any) => c.name)
      : [];

  // Building a list of forbidden combos: "groupBy || metric"
  const forbiddenCombos = (
    aiPreviousRecommendations?.recommendedCharts || []
  ).map((rc: any) => {
    const g = rc.groupBy || "";
    const m = rc.metric || "";
    return `${g}||${m}`;
  });

  const prompt = `
      You are given:
      1) The previous chart recommendation (JSON).
      2) A compact column summary and the allowed column NAMES.
      3) A list of forbidden "groupBy||metric" combinations the user already saw.

      **Task:** Return JSON ONLY. Suggest up to 3 *alternative* chart recommendations (same schema used earlier) that are **different** from the forbidden combinations. Prefer diversity: change the metric OR the groupBy OR the chartType. If you return a suggestion that matches a forbidden combo exactly, it will be discarded.

      **Output JSON schema (exact):**
      {
        "columns": [ { "name": "...", "type": "numeric|categorical_or_string|date|unknown", ... } ],
        "recommendedCharts": [
          {
            "chartType": "bar|line|pie|donut|area",
            "groupBy": "<one of the provided column NAMES or null>",
            "metric": "<one of the provided column NAMES or null>",
            "aggregation": "sum|avg|count|none",
            "granularity": "month-year|year|day|none",
            "topN": <int|null>,
            "score": <number between 0 and 1>, 
            "explain": "<1-line rationale>"
          }
        ],
        "recommendedCards": [ /* optional */ ]
      }

      RULES:
      - Use ONLY the provided column NAMES in 'groupBy' and 'metric'.
      - Do NOT invent new column names.
      - Avoid exact matches to any of the forbidden combos (see list below).
      - Prefer suggestions that differ from the original chart, and rank them with 'score' (0..1).
      - If no valid alternatives exist, return an empty array for recommendedCharts.
      - Return valid JSON only, nothing else.

      Original chart:
      ${JSON.stringify({
        id: originalChart?.id,
        kind: originalChart?.kind,
        recommendation: originalChart?.recommendation,
      })}

      Available column NAMES:
      ${JSON.stringify(columnNames)}

      Forbidden groupBy||metric combos:
      ${JSON.stringify(forbiddenCombos)}

      Column summary:
      ${JSON.stringify(columnSummary)}

      Return only JSON, nothing else.
      `;

  if (regenerationAttempts > 5) return null;

  console.log("Regeneration prompt: ", prompt);

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
  aiPreviousRecommendations: any,
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
    aiPreviousRecommendations,
    columnSummary,
    regenerationAttempts,
  });

  if (!prompt) return null;

  const raw = await getResponseForGivenPrompt(prompt); // returns string
  const parsed = extractJson(raw); // your robust extractor
  if (!parsed) throw new Error("AI returned no JSON");

  // map and fuzzy match returned recs to real columns
  const colNames = Object.keys(sampleRows[0] || {});
  const forbiddenCombos = (
    aiPreviousRecommendations?.recommendedCharts || []
  ).map((rc: any) => {
    const g = rc.groupBy || "";
    const m = rc.metric || "";
    return `${g}||${m}`;
  });

  const recChartsRaw = parsed.recommendedCharts ?? [];

  // Trying to map AI returned recommendatiosn to real columns using fuzzy matching
  const recChartsMapped = (recChartsRaw as any[])
    .map((rc) => {
      const mapped: any = { ...rc };

      mapped._original = rc; // keep original suggestion for debugging
      mapped.groupByMapped = fuzzyMatchColumn(rc.groupBy, colNames);
      mapped.metricMapped = fuzzyMatchColumn(rc.metric, colNames);

      // prefer exact mapped names for later processing
      if (mapped.groupByMapped) mapped.groupBy = mapped.groupByMapped;
      if (mapped.metricByMapped) mapped.groupBy = mapped.metricByMapped;

      return mapped;
    })
    // remove any that did not map to allowed columns if they claimed a column
    .filter((m) => {
      const needsGroupOK = !!m.groupBy ? colNames.includes(m.groupBy) : true;
      const needsMetricOK = !!m.metric ? colNames.includes(m.metric) : true;

      return needsGroupOK && needsMetricOK;
    });

  // Remove duplicates against forbidden combos and dedupe among recs (keep highest score)
  const unique: any[] = [];
  const seen = new Set<string>();

  recChartsMapped
    .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0)) // prefer higher score
    .forEach((m) => {
      if (forbiddenCombos.includes(m.combo)) return; // skip duplicates the user already saw
      if (seen.has(m.combo)) return; // remove duplicates in returned list
      seen.add(m.combo);
      unique.push(m);
    });

  // If unique is empty, generate local fallback recommendations
  let finalRecs: any[] = unique;
  if (!finalRecs || finalRecs.length === 0) {
    finalRecs = generateFallbackRecommendations(sampleRows, forbiddenCombos, 3);
  }

  const recCards = parsed.recommendedCards ?? [];

  // Compute local card values (do not trust AI to compute numbers)
  const cardPayloads = computeCardValues(rows, recCards);

  return {
    columns: parsed.columns,
    recommendedCharts: finalRecs,
    // recommendedCharts: recChartsMapped,
    recommendedCards: recCards,
    cardPayloads,
    rawAIResponse: parsed,
  };
}

// picks candidate numeric metrics and categorical groupBy and produce combos not in forbidden
export function generateFallbackRecommendations(
  rows: Record<string, any>[],
  forbiddenCombos: string[] = [],
  limit = 3
): any[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const first = rows[0];
  const columns = Object.keys(first);

  // simple heuristics:
  // numeric candidates: columns with many numeric values (use buildColumSummary)
  const numbericCols: string[] = [];
  const categoricalCols: string[] = [];

  for (const col of columns) {
    let numericCount = 0;
    let nonNull = 0;
    for (let i = 0; i < Math.min(200, rows.length); i++) {
      const v = rows[i][col];
      if (v !== null && v !== undefined && String(v) !== "") {
        nonNull++;
        const n = Number(String(v).replace(",", "."));
        if (!Number.isNaN(n)) numericCount++;
      }
    }
    const numericRatio = nonNull === 0 ? 0 : numericCount / nonNull;
    if (numericRatio > 0.6) numbericCols.push(col);
    else categoricalCols.push(col);
  }

  // rank numeric cols by total sum (desc) as heuristic for "interesting metrics"
  const numericScores = numbericCols.map((c) => {
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < rows.length; i++) {
      const v = Number(String(rows[i][c] ?? "").replace(",", "."));
      if (!Number.isNaN(v)) {
        sum += v;
        cnt++;
      }
    }

    return { col: c, sum, cnt };
  });
  numericScores.sort((a, b) => b.sum - a.sum);

  // Rank categorical by unique sample count
  const categoricalScores = categoricalCols.map((c) => {
    const s = new Set<string>();
    for (let i = 0; i < Math.min(500, rows.length); i++)
      s.add(String(rows[i][c] ?? ""));
    return { col: c, distinct: s.size };
  });

  categoricalScores.sort((a, b) => b.distinct - a.distinct);

  const recs: any[] = [];

  // try to create combos: top categorcal x top numeric
  for (const cat of categoricalScores.slice(0, 10)) {
    for (const num of numericScores.slice(0, 10)) {
      const combo = `${cat.col}||${num.col}`;

      if (forbiddenCombos.includes(combo)) continue;

      if (cat.col === num.col) continue;

      recs.push({
        chartType: "bar",
        groupBy: cat.col,
        metric: num.col,
        aggregation: "sum",
        granularity: "none",
        topN: 8,
        score: 0.5,
        explain: `Auto fallback: ${num.col} summed by ${cat.col} because ${cat.col} has ${cat.distinct} distinct values.`,
        _fallback: true,
      });
      if (recs.length >= limit) break;
    }
    if (recs.length >= limit) break;
  }

  // if still none, produce counts of rows as final fallback
  if (recs.length === 0) {
    recs.push({
      chartType: "bar",
      groupBy: categoricalScores[0]?.col ?? null,
      metric: null,
      aggregation: "count",
      granularity: "none",
      topN: 8,
      score: 0.4,
      explain: "Fallback: count of rows grouped by top categorical column.",
      _fallback: true,
    });
  }

  return recs;
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
