import { useNavigate } from "react-router-dom";
import { useFile } from "../../context/FileContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { FaUpload, FaTrash, FaExternalLinkAlt } from "react-icons/fa";

type UploadedChart = {
  id: string;
  name: string;
  type: "pdf" | "image" | "svg" | "other";
  file: File;
  url: string; // object URL (URL.createObjectURL)
  uploadedAt: number;
};

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
  const [uploadedCharts, setUploadedCharts] = useState<UploadedChart[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [generatedCharts, setGeneratedCharts] = useState<
    GeneratedChart[] | null
  >(null);
  const [aiCards, setAiCards] = useState<any[] | null>(null);
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

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(v);

  const fmtNumber = (v: number) => new Intl.NumberFormat().format(v);

  // Consider "ready" when arrays exist and have length > 0
  const isReady = useMemo(() => {
    const hasParsed = Array.isArray(parsedData) && parsedData.length > 0;
    const hasBar = Array.isArray(barChartData) && barChartData.length > 0;
    return !loading && hasParsed && hasBar;
  }, [loading, parsedData, barChartData]);

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

        if (recs.cardPayloads) {
          setAiCards(recs.cardPayloads);
        }

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

  // helpers
  const makeId = (prefix = "up") =>
    `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

  const handleOpenFilePicker = () => {
    console.log("open file picker clicked", fileInputRef.current);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;
    // support multiple if you want: loop
    const file = fl[0];
    addUploadedFile(file);
    // reset value so same file can be re-selected
    e.currentTarget.value = "";
  };

  const addUploadedFile = (file: File) => {
    const name = file.name;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const url = URL.createObjectURL(file);
    let type: UploadedChart["type"] = "other";
    if (ext === "pdf") type = "pdf";
    else if (ext === "svg") type = "svg";
    else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
      type = "image";

    const obj: UploadedChart = {
      id: makeId("uploaded"),
      name,
      type,
      file,
      url,
      uploadedAt: Date.now(),
    };

    setUploadedCharts((prev) => [obj, ...prev]);
  };

  const removeUploadedChart = useCallback((id: string) => {
    setUploadedCharts((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      uploadedCharts.forEach((u) => {
        try {
          URL.revokeObjectURL(u.url);
        } catch {}
      });
    };
  }, [uploadedCharts]);

  // helper to convert wizard row [{field,value},...] into object { field1: value1, field2: value2 }
  function rowToObject(wizardRow: { field: string; value: any }[]) {
    return wizardRow.reduce<Record<string, any>>((acc, fv) => {
      acc[fv.field] = fv.value;
      return acc;
    }, {});
  }

  if (!file) return null; // redirect handle above

  // rendering helper for uploaded chart card
  const UploadedChartCard = ({ u }: { u: UploadedChart }) => {
    return (
      <div className="bg-white rounded-lg shadow-sm p-3 max-h-[420px] flex flex-col">
        <div className="flex items-start justify-between">
          <h4 className="text-sm font-medium truncate max-w-[70%]">{u.name}</h4>
          <div className="flex gap-2 items-center">
            <a
              href={u.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="text-gray-500 hover:text-gray-900"
            >
              <FaExternalLinkAlt />
            </a>
            <button
              onClick={() => removeUploadedChart(u.id)}
              title="Remove"
              className="text-red-500 hover:text-red-700"
            >
              <FaTrash />
            </button>
          </div>
        </div>

        <div className="mt-3 flex-1">
          {u.type === "pdf" ? (
            // simple PDF embed (works in modern browsers)
            <div className="w-full max-h-[220px]">
              <object
                data={u.url}
                type="application/pdf"
                width="100%"
                height="100%"
                aria-label={u.name}
              >
                <div className="p-4 text-sm text-gray-600">
                  PDF preview not available.{" "}
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open PDF
                  </a>
                </div>
              </object>
            </div>
          ) : (
            // images & svg: show as image using object URL (safe)
            <img
              src={u.url}
              alt={u.name}
              className="h-[330px] w-full object-contain rounded"
            />
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500">
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(u.uploadedAt)}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-6 mt-10">
      <Reveal className="w-full">
        <div className="" key={key}>
          <img className="h-10" src="/src/assets/logo.png" alt="System Logo" />
          <h2 className="text-2xl font-bold mb-8">Dashboard</h2>
          <p>File: {file.name ?? "No file selected"}</p>

          <div>
            <div className="flex items-center">
              <Tooltip anchorElement="target" position="top" parentTitle={true}>
                <FaPencilAlt
                  title="Create Chart"
                  className="cursor-pointer hover:text-tertiary mb-3"
                  size={18}
                  onClick={() => {
                    navigate("/edit");
                  }}
                />
              </Tooltip>
              {/* Upload control: label-for-input approach (recommended) */}
              <div className="mb-4 flex items-center gap-3">
                <input
                  id="upload-chart-input"
                  type="file"
                  accept=".pdf,.svg,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <label
                  htmlFor="upload-chart-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-dark text-white rounded cursor-pointer select-none"
                  role="button"
                >
                  <FaUpload />
                  Add exported chart
                </label>

                <div className="text-sm text-gray-500">
                  Supported: PDF, PNG, JPG, SVG
                </div>
              </div>
            </div>
            {/* <h3 className="mt-4">Preview (first 5 rows)</h3>
            <pre className="overflow-auto max-h-64 text-sm bg-gray-900 text-white p-2 rounded my-10">
              {JSON.stringify(parsedData.slice(0, 5), null, 2)}
            </pre> */}

            <div className="grid grid-cols-2 md:grid-cols-2 gap-x-[15px] gap-y-[30px]">
              {aiCards?.map((c) => (
                <div key={c.id} className="bg-white rounded-lg shadow-sm p-3">
                  <h4 className="text-sm font-medium text-black">{c.label}</h4>
                  <div className="mt-3">
                    {c.cardType === "metric" && (
                      <div className="text-2xl font-bold text-black">
                        {c.format === "currency"
                          ? fmtCurrency(c.value)
                          : fmtNumber(c.value)}
                      </div>
                    )}

                    {c.cardType === "count" && (
                      <div className="text-2xl font-bold text-black">
                        {fmtNumber(c.value)}
                      </div>
                    )}

                    {c.cardType === "topCategory" && (
                      <div>
                        {c.value.map((t: any) => (
                          <div
                            key={t.key}
                            className="flex flex-col text-2xl font-bold text-black"
                          >
                            <span>{t.key}</span>
                            <span>{fmtCurrency(t.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {c.cardType === "minMax" && (
                      <div>
                        <div>Min: {fmtNumber(c.value.min)}</div>
                        <div>Max: {fmtNumber(c.value.max)}</div>
                      </div>
                    )}

                    {c.cardType === "avg" && (
                      <div>
                        <div className="text-2xl font-bold text-black">
                          {" "}
                          {fmtNumber(c.value)}
                        </div>
                      </div>
                    )}

                    {c.explain && (
                      <div className="text-xs text-gray-500 mt-2">
                        {c.explain}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* show uploaded charts */}
              {uploadedCharts.map((u) => (
                <UploadedChartCard key={u.id} u={u} />
              ))}

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
