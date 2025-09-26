import type { ChartWizardDataRow } from "@progress/kendo-react-chart-wizard";

type Row = Record<string, any>;

/**
 * Convert a single object into the wizard-friendly list: [{ field, value }, ...]
 */
export function objectToFieldValueList(row: Row): ChartWizardDataRow[] {
  return Object.entries(row).map(([k, v]) => ({ field: k, value: v }));
}
