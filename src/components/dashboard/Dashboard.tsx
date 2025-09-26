import { useNavigate } from "react-router-dom";
import { useFile } from "../../context/FileContext";
import { useEffect, useMemo, useState } from "react";

import ExcelJS from "exceljs";
import BarChart from "./charts/BarChart";
import { aggregateBy, aggregateByTimeSeries } from "../../utils/aggregation";
import LineChart from "./charts/LineChart";
import DonutChart from "./charts/DonutChart";
import AreaChart from "./charts/AreaChart";
import PieChart from "./charts/PieChart";
import CardDashboard from "./charts/Card";
import { FaPencilAlt } from "react-icons/fa";
import { getResponseForGivenPrompt } from "../../utils/GeminiFunctions";
import ProgressBarComp from "../../ui/ProgressBarComp";
import { Skeleton } from "@progress/kendo-react-indicators";
import '@progress/kendo-theme-default/dist/all.css';

const Dashboard = () => {
  // File Context
  const { file, parsedData, setParsedData } = useFile();

  const navigate = useNavigate();

  // States
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<number | undefined>(
    undefined
  );
  const [barChartData, setBarChartData] = useState<any[] | undefined>(
    undefined
  );
  const [pieChartData, setPieChartData] = useState<any[] | undefined>(
    undefined
  );
  const [donutChartData, setDonutChartData] = useState<any[] | undefined>(
    undefined
  );

  // Consider "ready" when arrays exist and have length > 0
  const isReady = useMemo(() => {
    const hasParsed = Array.isArray(parsedData) && parsedData.length > 0;
    const hasBar = Array.isArray(barChartData) && barChartData.length > 0;
    return !loading && hasParsed && hasBar;
  }, [loading, parsedData, barChartData]);

  const { categories: categoriesLineChart, series: seriesLineChart } =
    aggregateByTimeSeries(parsedData, {
      dateField: "Data_Pedido",
      valueField: "Valor_Venda",
      groupByField: "Segmento",
      granularity: "month-year", // month-year is good for line charts
      topN: 10,
      fillMissing: true,
      localeMonthLabels: "en-US", // or "pt-BR"
    });

  const { categories: categoriesAreaChart, series: seriesAreaChart } =
    aggregateByTimeSeries(parsedData, {
      dateField: "Data_Pedido",
      valueField: "Valor_Venda",
      groupByField: "Categoria",
      granularity: "year", // month-year is good for line charts
      topN: 10,
      fillMissing: true,
      localeMonthLabels: "en-US", // or "pt-BR"
    });

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
    const aggregatedBarChart = aggregateBy(
      parsedData,
      "Categoria",
      "Valor_Venda",
      {
        topN: 10, // show only top 10 categories (helps readability)
        sortDesc: true,
      }
    );
    const aggregatedLineChart = aggregateBy(
      parsedData,
      "Segmento",
      "Valor_Venda",
      {
        topN: 10, // show only top 10 categories (helps readability)
        sortDesc: true,
      }
    );
    const aggregatedDonutChart = aggregateBy(
      parsedData,
      "Estado",
      "Valor_Venda",
      {
        topN: 10, // show only top 10 categories (helps readability)
        sortDesc: true,
      }
    );

    console.log("aggregatedDonutChart: ", aggregatedDonutChart);

    setBarChartData(aggregatedBarChart);
    setPieChartData(aggregatedLineChart);
    setDonutChartData(aggregatedDonutChart);
  }, [parsedData]);

  if (!file) return null; // redirect handle above

  // number of chart slots for skeleton
  const chartSlots = [1, 2, 3, 4, 5];

  console.log("Gemini answered: ", getResponseForGivenPrompt("Hello, Gemini!"))

  return (
    <div className="p-6">
      <img className="h-10" src="/src/assets/logo.png" alt="System Logo" />
      <h2 className="text-xl font-bold mb-4">Dashboard</h2>
      <p>File: {file.name ?? "No file selected"}</p>

      {/* Progress bar (show even while ready optionally) */}
      <div className="my-4">
        <ProgressBarComp value={loadingProgress ?? 0} />
      </div>

      {isReady ? (
        // NORMAL CONTENT
        <div>
          <FaPencilAlt
            className="cursor-pointer hover:text-tertiary"
            size={18}
            onClick={() => {
              navigate("/edit");
            }}
          />
          <h3 className="mt-4">Preview (first 5 rows)</h3>
          <Skeleton shape="text" style={{ width: "100%" }} />
          <pre className="overflow-auto max-h-64 text-sm bg-gray-900 text-white p-2 rounded my-10">
            {/* {JSON.stringify(chartData.slice(0, 5), null, 2)} */}
            {JSON.stringify(parsedData.slice(0, 5), null, 2)}
          </pre>

          <div className="flex justify-center">
            <CardDashboard
              title={"Sales"}
              content={
                <div>
                  <p>
                    <strong>Total Sales</strong>: ${barChartData[0].Valor_Venda}
                  </p>
                </div>
              }
              // content={`Total Sales: $${barChartData[0].Valor_Venda}`}
            />
            <CardDashboard
              title={"Sales"}
              content={
                <div>
                  <p>
                    <strong>Total Sales</strong>: ${barChartData[0].Valor_Venda}
                  </p>
                </div>
              }
              // content={`Total Sales: $${barChartData[0].Valor_Venda}`}
            />
          </div>

          {/* Grid: 1 column on small, 2 column on md+, horizontal gap 15px, vertical 30px */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3.5 gap-y-7.5">
            {/* Chart card 1 */}
            <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
              <BarChart
                // seriesData={parsedData}
                seriesData={barChartData}
                chartType="column"
                field="Valor_Venda"
                categoryField="Categoria"
                mainTitle="Sales by Category"
                axisTitle="Categories"
                axisValueTitle="Sales Value"
              />
            </div>

            {/* Chart card 2 */}
            <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
              <LineChart
                categories={categoriesLineChart}
                seriesData={seriesLineChart}
                mainTitle="Sales over time"
                axisTitle="Year-Month"
                valueAxisTitle="Sales"
              />
            </div>

            {/* Chart card 3 */}
            <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
              <DonutChart
                seriesData={donutChartData}
                categoryField="Segmento"
                valueField="Valor_Venda"
                mainTitle="Sales by City"
                axisTitle="Year-Month"
                valueAxisTitle="Sales"
              />
            </div>

            {/* Chart card 4 */}
            <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
              <AreaChart
                categories={categoriesAreaChart}
                seriesData={seriesAreaChart}
                mainTitle="Sales over time"
                axisTitle="Years"
                valueAxisTitle="Sales"
              />
            </div>

            {/* Chart card 5 */}
            <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
              <PieChart
                seriesData={pieChartData}
                categoryField="SubCategoria"
                valueField="Valor_Venda"
                mainTitle="Sales by SubCategory"
                axisTitle="Year-Month"
                valueAxisTitle="Sales"
              />
            </div>
          </div>
        </div>
      ) : (
        /* --------------------- SKELETON PLACEHOLDERS --------------------- */
        <div>
          <h3 className="mt-4 mb-2">Preview</h3>
          {/* text skeleton */}
          <Skeleton shape="text" style={{ width: "60%", height: 20 }} />

          {/* preview box skeleton */}
          <div className="my-6">
            <Skeleton style={{ width: "100%", height: 160, borderRadius: 8 }} />
          </div>

          {/* small stat cards skeleton */}
          <div className="flex gap-4 justify-center mb-6">
            <div style={{ width: 220 }}>
              <Skeleton shape="text" style={{ width: "50%" }} />
              <Skeleton
                style={{
                  width: "100%",
                  height: 72,
                  borderRadius: 8,
                  marginTop: 8,
                }}
              />
            </div>
            <div style={{ width: 220 }}>
              <Skeleton shape="text" style={{ width: "50%" }} />
              <Skeleton
                style={{
                  width: "100%",
                  height: 72,
                  borderRadius: 8,
                  marginTop: 8,
                }}
              />
            </div>
          </div>

          {/* grid of chart skeletons (same layout as real grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[15px] gap-y-[30px]">
            {chartSlots.map((i) => (
              <div key={i} className="bg-white rounded-lg p-4 min-h-[300px]">
                {/* card heading skeleton */}
                <Skeleton shape="text" style={{ width: "40%", height: 18 }} />
                <div className="mt-4">
                  {/* large rectangle where the chart would be */}
                  <Skeleton
                    style={{ width: "100%", height: 240, borderRadius: 8 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* UX hint */}
          <p className="mt-4 text-sm text-gray-600">
            Loading and parsing file...{" "}
            {loadingProgress ? `${loadingProgress}%` : ""}
          </p>
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
