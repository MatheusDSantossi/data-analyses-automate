// Wizard.tsx
import React, { useMemo } from "react";
import {
  ChartWizard,
  type ChartWizardDataRow,
  getWizardDataFromDataRows,
} from "@progress/kendo-react-chart-wizard";
import { aggregateRowsToWizardData } from "../../../utils/transformForWizard";
import { useNavigate } from "react-router-dom";

interface WizardProps {
  // incoming: array of objects like your sample rows
  data: Record<string, any>[];
  file: any;
}

const toDataRows = (rows: Record<string, any>[], sampleLimit = 200) => {
  if (!Array.isArray(rows)) return [];

  // optionally sample first N rows to keep wizard responsive
  const slice = rows.slice(0, Math.min(sampleLimit, rows.length));

  return slice.map((row) => {
    const cols = Object.keys(row).map((k) => ({
      // DataColumn shape (field + title are enough; value goes in dataItem or in the dataColumns)
      field: k,
      title: k,
      // NOTE: some Kendo examples put the value inside dataColumns too; we'll keep it in dataItem
      // but adding value here is harmless and useful for the wizard preview:
      value: row[k],
    }));

    return {
      dataItem: row, // original object (keeps full row)
      dataColumns: cols,
    };
  });
};

const Wizard = ({ data, file }: WizardProps) => {
  // hook
  const navigate = useNavigate(); 
  
  // create DataRow[] then convert to ChartWizardDataRow[]
  const wizardData: ChartWizardDataRow[] = useMemo(() => {
    // build DataRow[] (sample to keep UI snappy)
    const dataRows = toDataRows(data, 200);

    // convert using Kendo helper to exact ChartWizardDataRow[] format
    return getWizardDataFromDataRows(dataRows); // note: some versions accept array directly
    // if getWizardDataFromDataRows expects the array directly, call: getWizardDataFromDataRows(dataRows)
    // check your package export: either form works in different versions.
  }, [data]);

  // Example: aggregated by Categoria summing Valor_Venda (top 10 categories)
  const wizardData2 = useMemo(() => {
    return aggregateRowsToWizardData(data, "Categoria", ["Valor_Venda"], {
      topN: 10,
      sortDesc: true,
      includeCount: true, // optional
    });
  }, [data]);

  return (
    <div>
      <img className="h-10" src="/src/assets/logo.png" alt="System Logo" />
      <h2 className="text-2xl font-bold mb-8">Wizard</h2>
      <p>File: {file.name ?? "No file selected"}</p>
      <ChartWizard data={wizardData2} onClose={() => {
        navigate("/dashboard")
      }} />
    </div>
  );
};

export default Wizard;
