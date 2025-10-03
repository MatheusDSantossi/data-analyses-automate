import type {
  ChartKind,
  GeneratedChart,
} from "../components/dashboard/Dashboard";
import { aggregateByTimeSeries } from "./aggregation";
import { aggregateRowsToWizardData } from "./transformForWizard";

export function mapRecToGeneratedChart(
  rec: any,
  idx: number,
  parsedData: Record<string, any>[]
): GeneratedChart {
  const id = rec.id ?? `ai-${idx}-${rec.chartType}-${rec.groupBy ?? "nogroup"}`;
  const kind = rec.chartType as ChartKind;
  const title = rec.explain || `${rec.chartType} of ${rec.metric ?? "value"}`;

  const groupExists =
    !!rec.groupBy && parsedData[0] && parsedData[0].hasOwnProperty(rec.groupBy);
  const metricExists =
    !!rec.metric && parsedData[0] && parsedData[0].hasOwnProperty(rec.metric);

  console.log("rec inside chart helper: ", rec);

  /**
  * RETURN TEST
  * {
    "chartType": "bar",
    "groupBy": "Categoria",
    "metric": "Valor_Venda",
    "aggregation": "sum",
    "granularity": "none",
    "topN": null,
    "explain": "Bar chart showing the total sales value for each product category.",
    "_original": {
        "chartType": "bar",
        "groupBy": "Categoria",
        "metric": "Valor_Venda",
        "aggregation": "sum",
        "granularity": "none",
        "topN": null,
        "explain": "Bar chart showing the total sales value for each product category."
    },
    "groupByMapped": "Categoria",
    "metricMapped": "Valor_Venda",
    "regenerationAttempts": 1
}
  */

  //   BAR / PIE / DONUT
  if (kind === "bar" || kind === "pie" || kind === "donut") {
    if (!groupExists || !metricExists) {
      return {
        id,
        kind,
        title,
        recommendation: rec,
        payload: null,
        valid: false,
        error: "Missing groupBy/metric in data",
        regenerating: false,
        regenerationAttempts: rec.regenerationAttemps ?? 0,
      };
    }

    const wizardRows = aggregateRowsToWizardData(
      parsedData,
      rec.groupBy,
      [rec.metric],
      {
        topN: rec.topN ?? 10,
        sortDesc: true,
      }
    );

    return {
      id,
      kind,
      title,
      recommendation: rec,
      payload: { wizardRows },
      valid: true,
      regenerating: false,
      regenerationAttempts: rec.regenerationAttempts ?? 0,
    };
  }

  //   LINE / AREA
  if (kind === "line" || kind === "area") {
    const dateField =
      rec.dateField ||
      (parsedData[0].Data_Pedido
        ? "Data_Pedido"
        : Object.keys(parsedData[0]).find((k) => /date|data|dt/i.test(k)));

    if (
      !dateField ||
      !parsedData[0].hasOwnProperty(dateField) ||
      !metricExists
    ) {
      return {
        id,
        kind,
        title,
        recommendation: rec,
        payload: null,
        valid: false,
        error: "Missing date or metric",
        regenerating: false,
        regenerationAttempts: rec.regenerationAttempts ?? 0,
      };
    }

    const { categories, series } = aggregateByTimeSeries(parsedData, {
      dateField,
      valueField: rec.metric,
      groupByField: rec.groupBy,
      granularity: rec.granularity ?? "month-year",
      topN: rec.topN ?? 10,
      fillMissing: true,
      localeMonthLabels: "en-US",
    });

    return {
      id,
      kind,
      title,
      recommendation: rec,
      payload: { categories, series },
      valid: true,
      regenerating: false,
      regenerationAttempts: rec.regenerationAttempts ?? 0,
    };
  }
  // fallback
  return {
    id,
    kind,
    title,
    recommendation: rec,
    payload: null,
    valid: false,
    error: "Unsupported chart type",
    regenerating: false,
    regenerationAttempts: rec.regenerationAttempts ?? 0,
  };
}
