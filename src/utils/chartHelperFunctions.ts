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
  const title = rec.explain || `${rec.chartTyoe} of ${rec.metric ?? "value"}`;

  const groupExists =
    !!rec.groupBy && parsedData[0] && parsedData[0].hasOwnProperty(rec.groupBy);
  const metricExists =
    !!rec.metric && parsedData[0] && parsedData[0].hasOwnProperty(rec.metric);

    console.log("rec inside chart helper: ", rec)

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
