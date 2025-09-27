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
import "@progress/kendo-theme-default/dist/all.css";
import { Reveal } from "@progress/kendo-react-animation";
import { Tooltip } from "@progress/kendo-react-tooltip";
import { aggregateRowsToWizardData } from "../../utils/transformForWizard";
import { analyzeDataWithAI } from "../../utils/aiAnalysis";

type ChartKind = "bar" | "line" | "pie" | "donut" | "area";

type GeneratedChart = {
  id: string;
  kind: ChartKind;
  title: string;
  recommendation: any; // original AI rec item
  // payload for rendering depending on kind:
  // - for bar/pie/donut: wizardRows (ChartWizardDataRow[]) OR aggregated wizard-style rows
  // - for line/area: { categories: string[], series: any[] }
  payload: any;
  valid: boolean;
  error?: string;
};

const Dashboard = () => {
  // File Context
  const { file, parsedData, setParsedData } = useFile();

  const navigate = useNavigate();

  // States
  const [generatedCharts, setGeneratedCharts] = useState<
    GeneratedChart[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
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

  const [categoriesLineChart, setCategoriesLineChart] = useState<
    any[] | undefined
  >(undefined);

  const [lineChartData, setLineChartData] = useState<any[] | undefined>(
    undefined
  );

  const [key, setKey] = useState(0); // Key to force re-rendering of Reveal component

  useEffect(() => {
    // Force re-rendering of the Reveal component to trigger the animation
    setKey((prevKey) => prevKey + 1);
  }, []);

  // Consider "ready" when arrays exist and have length > 0
  const isReady = useMemo(() => {
    const hasParsed = Array.isArray(parsedData) && parsedData.length > 0;
    const hasBar = Array.isArray(barChartData) && barChartData.length > 0;
    return !loading && hasParsed && hasBar;
  }, [loading, parsedData, barChartData]);

  // const { categories: categoriesLineChart, series: seriesLineChart } =
  //   aggregateByTimeSeries(parsedData, {
  //     dateField: "Data_Pedido",
  //     valueField: "Valor_Venda",
  //     groupByField: "Segmento",
  //     granularity: "month-year", // month-year is good for line charts
  //     topN: 10,
  //     fillMissing: true,
  //     localeMonthLabels: "en-US", // or "pt-BR"
  //   });

  // const { categories: categoriesAreaChart, series: seriesAreaChart } =
  //   aggregateByTimeSeries(parsedData, {
  //     dateField: "Data_Pedido",
  //     valueField: "Valor_Venda",
  //     groupByField: "Categoria",
  //     granularity: "year", // month-year is good for line charts
  //     topN: 10,
  //     fillMissing: true,
  //     localeMonthLabels: "en-US", // or "pt-BR"
  //   });

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
    if (!parsedData || parsedData.length === 0) return;

    let mounted = true;
    const run = async () => {
      try {
        setAiBusy(true);
        // limit to a sample to reduce cost and keep privacy
        const recs = await analyzeDataWithAI(parsedData, { sampleLimit: 20 });
        if (!mounted) return;

        console.log("recs: ", recs);

        setAiRecommendations(recs);

        const charts: GeneratedChart[] = (recs.recommendedCharts || []).map(
          (rec: any, idx: number) => {
            const id = `ai-${idx}-${rec.chartType}-${rec.groupBy ?? "nogroup"}`;
            const kind = rec.chartType as ChartKind;
            const title =
              rec.explain || `${rec.chartType} of ${rec.metric ?? "value"}`;

            // validation
            const groupExists =
              !!rec.groupBy &&
              parsedData[0] &&
              parsedData[0].hasOwnProperty(rec.groupBy);
            const metricExists =
              !!rec.metric &&
              parsedData[0] &&
              parsedData[0].hasOwnProperty(rec.metric);

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
                };
              }
              // aggregator returns ChartWizardDataRow[] (unique rows per group)
              const wizardRows = aggregateRowsToWizardData(
                parsedData,
                rec.groupBy,
                [rec.metric],
                { topN: rec.topN ?? 10, sortDesc: true }
              );
              return {
                id,
                kind,
                title,
                recommendation: rec,
                payload: { wizardRows },
                valid: true,
              };
            }

            if (kind === "line" || kind === "area") {
              // need date-based series
              // attempt to identify date field — prefer rec.dateField else fallback to known names
              const dateField =
                rec.dateField ||
                (parsedData[0].Data_Pedido
                  ? "Data_Pedido"
                  : Object.keys(parsedData[0]).find((k) =>
                      /date|data|dt/i.test(k)
                    ));
              // validate that dateField exists
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
                };
              }
              const { categories, series } = aggregateByTimeSeries(parsedData, {
                dateField,
                valueField: rec.metric,
                groupByField: rec.groupBy, // groupBy can be null -> single series
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
              };
            }

            // fallback for unexpected types
            return {
              id,
              kind,
              title,
              recommendation: rec,
              payload: null,
              valid: false,
              error: "Unsupported chart type",
            };
          }
        );

        // remove invalid ones if you'd like, or keep them to show user errors
        const filtered = charts; // or charts.filter(c => c.valid)

        if (mounted) {
          setGeneratedCharts(filtered);
        }
      } catch (err) {
        console.error("AI analysis failed:", err);
      } finally {
        setAiBusy(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [parsedData]);

  const ChartRenderer: React.FC<{ chart: GeneratedChart }> = ({ chart }) => {
    if (!chart.valid) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
          <h4 className="font-medium">{chart.title}</h4>
          <p className="text-sm text-red-600">
            Failed to create chart: {chart.error}
          </p>
        </div>
      );
    }

    switch (chart.kind) {
      case "bar":
        return (
          <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
            <h4 className="mb-2 font-medium">{chart.title}</h4>
            {/* payload.wizardRows is an array of [{field,value},...] */}
            {/* aggregateRowsToWizardData created these rows; your BarChart expects array-of-objects */}
            {/* Convert wizardRows to array-of-objects if needed: */}
            <BarChart
              seriesData={chart.payload.wizardRows.map(rowToObject)}
              chartType="column"
              field="Valor_Venda"
              categoryField={chart.recommendation.groupBy}
              mainTitle={chart.title}
              axisTitle={chart.recommendation.groupBy}
              axisValueTitle={chart.recommendation.metric}
            />
          </div>
        );
      case "pie":
      case "donut":
        return (
          <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
            <h4 className="mb-2 font-medium">{chart.title}</h4>
            <DonutChart
              seriesData={chart.payload.wizardRows.map(rowToObject)}
              categoryField={chart.recommendation.groupBy}
              valueField={chart.recommendation.metric}
              mainTitle={chart.title}
              axisTitle={chart.recommendation.groupBy}
              valueAxisTitle={chart.recommendation.metric}
            />
          </div>
        );
      case "line":
      case "area":
        return (
          <div className="bg-white rounded-lg shadow-sm p-4 min-h-[300px]">
            <h4 className="mb-2 font-medium">{chart.title}</h4>
            <LineChart
              categories={chart.payload.categories}
              seriesData={chart.payload.series}
              mainTitle={chart.title}
              axisTitle={
                chart.recommendation.groupBy ?? chart.recommendation.metric
              }
              valueAxisTitle={chart.recommendation.metric}
            />
          </div>
        );
      default:
        return <div>Unsupported</div>;
    }
  };

  // helper to convert wizard row [{field,value},...] into object { field1: value1, field2: value2 }
  function rowToObject(wizardRow: { field: string; value: any }[]) {
    return wizardRow.reduce<Record<string, any>>((acc, fv) => {
      acc[fv.field] = fv.value;
      return acc;
    }, {});
  }

  if (!file) return null; // redirect handle above

  // number of chart slots for skeleton
  const chartSlots = [1, 2, 3, 4, 5];

  return (
    <div className="w-full p-6">
      <Reveal className="w-full">
        <div className="" key={key}>
          <img className="h-10" src="/src/assets/logo.png" alt="System Logo" />
          <h2 className="text-2xl font-bold mb-8">Dashboard</h2>
          <p>File: {file.name ?? "No file selected"}</p>

          <div>
            <Tooltip anchorElement="target" position="top" parentTitle={true}>
              <FaPencilAlt
                title="Create Chart"
                className="cursor-pointer hover:text-tertiary"
                size={18}
                onClick={() => {
                  navigate("/edit");
                }}
              />
            </Tooltip>
            <h3 className="mt-4">Preview (first 5 rows)</h3>
            <pre className="overflow-auto max-h-64 text-sm bg-gray-900 text-white p-2 rounded my-10">
              {/* {JSON.stringify(chartData.slice(0, 5), null, 2)} */}
              {isReady ? JSON.stringify(parsedData.slice(0, 5), null, 2) : "No Data"}
            </pre>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-x-[15px] gap-y-[30px]">
              {generatedCharts?.length ? (
                generatedCharts.map((chart) => (
                  <ChartRenderer key={chart.id} chart={chart} />
                ))
              ) : (
                // fallback skeleton / message
                <div className="col-span-full text-sm text-gray-500">
                  No auto charts generated yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </Reveal>
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
