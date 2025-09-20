import { useNavigate } from "react-router-dom";
import { useFile } from "../../context/FileContext";
import { useEffect, useState } from "react";

import ExcelJS from "exceljs";
import BarChart from "./charts/BarChart";
import { aggregateBy } from "../../utils/aggregateBy";

const Dashboard = () => {
  // File Context
  const { file, parsedData, setParsedData } = useFile();

  const navigate = useNavigate();

  // States
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<any[] | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      // If no file in context, send user back to Home
      navigate("/");
      return;
    }

    // If parsedData already exists skip parsing
    if (parsedData) return;

    const parse = async () => {
      try {
        setLoading(true);

        const arrayBuffer = await file.arrayBuffer();
        // Detect file type by extension
        const filename = file.name.toLowerCase();
        if (filename.endsWith(".csv")) {
          // csv -> read as text
          const text = new TextDecoder().decode(arrayBuffer);
          const rows = csvToJson(text); // helper
          setParsedData(rows);
        } else {
          // xslx/xlsx... -> we use SheetJS
          const workbook = new ExcelJS.Workbook();
          workbook.xlsx.load(arrayBuffer);
          const sheet = workbook.worksheets[0];
          const rows = [];

          sheet.eachRow((row) => rows.push(row.values));

          setParsedData(rows);
        }
      } catch (err) {
        console.log("Parsing error", err);
        alert("Error parsing file. See console for details;");
      } finally {
        setLoading(false);
      }
    };

    parse();
  }, [file, parsedData, navigate, setParsedData]);

  useEffect(() => {
    if (!parsedData) return;

    // Convert and aggregate
    const aggregated = aggregateBy(parsedData, "Categoria", "Valor_Venda", {
      topN: 10, // show only top 10 categories (helps readability)
      sortDesc: true,
    });

    // console.log("")

    setChartData(aggregated);
  }, [parsedData]);

  if (!file) return null; // redirect handle above

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Dashboard</h2>
      <p>File: {file.name}</p>

      {!loading && parsedData && chartData && (
        <div>
          <h3 className="mt-4">Preview (first 5 rows)</h3>
          <pre className="overflow-auto max-h-64 text-sm bg-gray-900 text-white p-2 rounded my-10">
            {/* {JSON.stringify(chartData.slice(0, 5), null, 2)} */}
            {JSON.stringify(parsedData.slice(0, 5), null, 2)}
          </pre>

          {/* TODO: render Grid, charts, selectors, etc. */}
          <BarChart
            // seriesData={parsedData}
            seriesData={chartData}
            chartType="column"
            field="Valor_Venda"
            categoryField="Categoria"
            mainTitle="Sales by Category"
            axisTitle="Categories"
            axisValueTitle="Sales Value"
          />
        </div>
      )}
    </div>
  );
};

function csvToJson(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj: Record<string, any> = {};

    headers.forEach((h, i) => (obj[h] = values[i] ?? null));
    return obj;
  });

  return rows;
}

export default Dashboard;
