import { useNavigate } from "react-router-dom";
import { useFile } from "../../context/FileContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import BarChart from "./charts/BarChart";
import LineChart from "./charts/LineChart";
import DonutChart from "./charts/DonutChart";
import { MdAddChart } from "react-icons/md";
// import ProgressBarComp from "../../ui/ProgressBarComp";
import { Skeleton } from "@progress/kendo-react-indicators";
import "@progress/kendo-theme-default/dist/all.css";
import { Reveal } from "@progress/kendo-react-animation";
import { Tooltip } from "@progress/kendo-react-tooltip";
import {
  analyzeDataWithAI,
  buildColumnSummary,
  processRecommendedCharts,
  reAnalyzeDataWithAI,
} from "../../utils/aiAnalysis";
import { FaUpload, FaTrash, FaExternalLinkAlt } from "react-icons/fa";
import { GrUpdate } from "react-icons/gr";
import { mapRecToGeneratedChart } from "../../utils/chartHelperFunctions";
import { fuzzyMatchColumn } from "../../utils/fields";
import PieChart from "./charts/PieChart";
import AreaChart from "./charts/AreaChart";
import { detectDateColumns } from "../../utils/detectDateCols";
import CloseButton from "../../ui/CloseButton";

type UploadedChart = {
  id: string;
  name: string;
  type: "pdf" | "image" | "svg" | "other";
  file: File;
  url: string; // object URL (URL.createObjectURL)
  uploadedAt: number;
};

export type ChartKind = "bar" | "line" | "pie" | "donut" | "area";

export type GeneratedChart = {
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
  regenerating?: boolean;
  regenerationAttempts?: number;
};

const Dashboard = () => {
  // File Context
  const { file, parsedData, setParsedData } = useFile();

  // hooks
  const navigate = useNavigate();

  // States
  const [uploadedCharts, setUploadedCharts] = useState<UploadedChart[]>([]);
  const [generatedCharts, setGeneratedCharts] = useState<
    GeneratedChart[] | null
  >(null);
  const [aiCards, setAiCards] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState<Record<string, boolean>>({});
  // const [aiRecommendations, setAiRecommendations] = useState<any | null>(null);
  const [aiPreviousRecommendations, setAiPreviousRecommendations] = useState<
    any | null
  >(null);
  const [aiBusy, setAiBusy] = useState(false);
  // const [loadingProgress, setLoadingProgress] = useState<number | undefined>(
  //   undefined
  // );
  // const [barChartData, setBarChartData] = useState<any[] | undefined>(
  //   undefined
  // );

  // Ref
  const regenInProgressRef = useRef<Set<string>>(new Set());

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
    const hasBar = Array.isArray(generatedCharts) && generatedCharts.length > 0;
    return !loading && hasParsed && hasBar;
  }, [loading, parsedData, generatedCharts]);

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
          // xslx/xlsx... -> we're using SheetJS
          const workbook = new ExcelJS.Workbook();

          await workbook.xlsx.load(arrayBuffer); // it returns a load promise

          if (!workbook.worksheets || workbook.worksheets.length === 0) {
            navigate("/");
            throw new Error("No worksheets found in workbook");
          }

          const sheet = workbook.worksheets[0];

          // Read header from first row
          const headerRow: any = sheet.getRow(1);

          // headerRow.calues is 1-based: [, "col1", "col2", ...]
          const headers = (headerRow.values || [])
            .slice(1)
            .map((h: any) => String(h ?? "").trim());

          const result: Record<string, any>[] = [];

          sheet.eachRow((row: any, rowNumber: any) => {
            // skip header (if you used headerRow)
            if (rowNumber === 1) return;

            // ExcelJS row.values is 1-based
            const values = (row.values || []).slice(1);
            const obj: Record<string, any> = {};

            headers.forEach((h: any, i: any) => {
              obj[h] = values[i] !== undefined ? values[i] : null;
            });

            result.push(obj);
          });

          setParsedData(result);
        }
      } catch (err) {
        console.log("Parsing error", err);
        alert("Error parsing file. See console for details;");
        setParsedData(null);
      } finally {
        setLoading(false);
      }
    };

    parse();
  }, [file, parsedData, navigate, setParsedData]);

  const analyzeAll = useCallback(async () => {
    if (!parsedData || parsedData.length === 0) return;
    setAiBusy(true);
    try {
      const sampleRows = parsedData.slice(0, Math.min(200, parsedData.length));

      // build column summary + detect dates BEFORE calling AI (so prompt can includes them)
      const columnSummary = buildColumnSummary(sampleRows, sampleRows.length);

      const dateCols = detectDateColumns(sampleRows);

      const recs = await analyzeDataWithAI(
        parsedData,
        { sampleLimit: 50, columnSummary },
        dateCols
      );

      // setAiRecommendations(recs);
      setAiPreviousRecommendations(recs);
      if (recs.cardPayloads) setAiCards(recs.cardPayloads);

      const forbiddenCombos = (recs.recommendedCharts || []).map(
        (rc: any) => `${rc.groupBy ?? ""}|| ${rc.metric ?? ""}`
      );
      const { recommendedCharts: finalRecs } = processRecommendedCharts(
        recs.recommendedCharts || [],
        sampleRows,
        forbiddenCombos,
        4
      );

      const mapped: GeneratedChart[] = (finalRecs || []).map(
        (rec: any, idx: number) =>
          mapRecToGeneratedChart(rec, idx, parsedData, dateCols)
      );
      // const mapped: GeneratedChart[] = (recs.recommendedCharts || []).map(
      //   (rec: any, idx: number) => mapRecToGeneratedChart(rec, idx, parsedData)
      // );

      setGeneratedCharts(mapped);
    } catch (err) {
      console.error("AI analysis failed:", err);
    } finally {
      setAiBusy(false);
    }
  }, [parsedData]);

  const handleRegenerate = useCallback(
    async (chartId: string) => {
      if (regenInProgressRef.current.has(chartId)) {
        console.log("regeneration already in progress for", chartId);
        return;
      }

      const current = generatedCharts?.find((c) => c.id === chartId);
      if (!current) return;

      // limit attempts
      const attempts = (current.regenerationAttempts ?? 0) + 1;
      if (attempts > 5) {
        // TODO: show toast / warning
        const warningText = "Regeneration limit reached for " + chartId;

        alert(warningText);
        setLimitReached((prevState) => ({
          ...prevState,
          [chartId]: true,
        }));
        console.warn(warningText);
        return;
      }

      try {
        regenInProgressRef.current.add(chartId);
        setAiBusy(true);

        // mark regenerating in UI
        setGeneratedCharts((prev) =>
          (prev || []).map((c) =>
            c.id === chartId ? { ...c, regenerating: true } : c
          )
        );

        // console.log("aiRecommendations: ", aiRecommendations);
        // console.log("aiPreviousRecommendations: ", aiPreviousRecommendations);

        // call your reAnalyze function — it returns the new recs
        const recs = await reAnalyzeDataWithAI(
          // current,
          aiPreviousRecommendations,
          attempts,
          parsedData,
          {
            sampleLimit: 50,
          }
        );
        // const recs = await reAnalyzeDataWithAI(current, attempts, parsedData, {
        //   sampleLimit: 50,
        // });

        if (!recs) {
          // nothing returned
          setGeneratedCharts((prev) =>
            (prev || []).map((c) =>
              c.id === chartId ? { ...c, regenerating: false } : c
            )
          );
          setAiBusy(false);

          return;
        }

        // update cards if AI returned new card payloads
        // if (recs.cardPayloads) setAiCards(recs.cardPayloads);
        // setAiRecommendations(recs);

        // decide replacement strategy: use first recommendedChart to replace this chart
        const firstRec = recs.recommendedCharts?.[0];
        if (!firstRec) {
          // nothing to replace
          setGeneratedCharts((prev) =>
            (prev || []).map((c) =>
              c.id === chartId ? { ...c, regenerating: false } : c
            )
          );
          return;
        }

        // attach regenerationAttempts value on the rec so mapping helper preserves it
        firstRec.regenerationAttempts = attempts;

        // IMPORTANT: if fuzzy matching was applied earlier, rec.groupBy/metric should already be valid.
        // But we double-check:
        const colNames = Object.keys(parsedData[0] || {});
        const groupOk =
          !firstRec.groupBy || colNames.includes(firstRec.groupBy);
        const metricOk = !firstRec.metric || colNames.includes(firstRec.metric);

        // If ai returned invalid field names, try fuzzy match now (final attempt)
        if (!groupOk || !metricOk) {
          if (!groupOk && firstRec.groupBy) {
            const gm = fuzzyMatchColumn(firstRec.groupBy, colNames);
            if (gm) firstRec.groupBy = gm;
          }
          if (!metricOk && firstRec.metric) {
            const mm = fuzzyMatchColumn(firstRec.metric, colNames);
            if (mm) firstRec.metric = mm;
          }
        }

        // Building new GeneratedCarts
        const newGenChart = mapRecToGeneratedChart(
          firstRec,
          Date.now(),
          parsedData
        );

        // replace in state (preserve order)
        setGeneratedCharts((prev) =>
          (prev || []).map((c) =>
            c.id === chartId ? { ...newGenChart, regenerating: false } : c
          )
        );
      } catch (err) {
        console.error("Regenerate failed", err);
        setGeneratedCharts((prev) =>
          (prev || []).map((c) =>
            c.id === chartId ? { ...c, regenerating: false } : c
          )
        );
      } finally {
        setAiBusy(false);
      }
    },
    [generatedCharts, parsedData, aiPreviousRecommendations]
  );

  useEffect(() => {
    if (!parsedData || parsedData.length === 0) return;

    (async () => {
      await analyzeAll();
    })();
  }, [parsedData, analyzeAll]);

  const ChartRenderer: React.FC<{ chart: GeneratedChart }> = ({ chart }) => {
    if (!chart.valid && chart.kind !== "line") {
      return (
        <div className="bg-white shadow-md rounded-lg p-4 min-h-[300px]">
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
          <div className="bg-white shadow-md rounded-lg p-4 min-h-[300px]">
            <div>
              <Tooltip anchorElement="target" position="top" parentTitle={true}>
                <button
                  disabled={chart.regenerating || limitReached[chart.id]}
                  className="flex justify-start p-2"
                  onClick={() => {
                    handleRegenerate(chart.id);
                  }}
                >
                  <GrUpdate
                    className={`${chart.regenerating || limitReached[chart.id] ? "text-primary/10" : "text-primary hover:text-tertiary cursor-pointer"}`}
                    title={
                      chart.regenerating
                        ? "Regenerating..."
                        : limitReached[chart.id]
                          ? "Regenerate max attempts reached"
                          : "Regenerate"
                    }
                    size={18}
                  />
                </button>
              </Tooltip>
            </div>
            <h4 className="mb-2 font-medium text-black">{chart.title}</h4>
            {/* payload.wizardRows is an array of [{field,value},...] */}
            {/* aggregateRowsToWizardData created these rows; your BarChart expects array-of-objects */}
            {/* Convert wizardRows to array-of-objects if needed: */}
            <BarChart
              seriesData={chart.payload.wizardRows.map(rowToObject)}
              chartType="column"
              field={chart.recommendation.metric}
              categoryField={chart.recommendation.groupBy}
              // mainTitle={chart.title}
              axisTitle={chart.recommendation.groupBy}
              axisValueTitle={chart.recommendation.metric}
            />
          </div>
        );
      case "pie":
        return (
          <div className="bg-white rounded-lg shadow-md p-4 min-h-[300px]">
            <div>
              <Tooltip anchorElement="target" position="top" parentTitle={true}>
                <button
                  disabled={chart.regenerating || limitReached[chart.id]}
                  className="flex justify-start p-2"
                  onClick={() => {
                    handleRegenerate(chart.id);
                  }}
                >
                  <GrUpdate
                    className={`${chart.regenerating || limitReached[chart.id] ? "text-primary/10" : "text-primary hover:text-tertiary cursor-pointer"}`}
                    title={
                      chart.regenerating
                        ? "Regenerating..."
                        : limitReached[chart.id]
                          ? "Regenerate max attempts reached"
                          : "Regenerate"
                    }
                    size={18}
                  />
                </button>
              </Tooltip>
            </div>
            <h4 className="mb-2 font-medium text-black">{chart.title}</h4>
            <PieChart
              seriesData={chart.payload.wizardRows.map(rowToObject)}
              categoryField={chart.recommendation.groupBy}
              valueField={chart.recommendation.metric}
              // mainTitle={chart.title}
              // axisTitle={chart.recommendation.groupBy}
              // valueAxisTitle={chart.recommendation.metric}
            />
          </div>
        );
      case "donut":
        return (
          <div className="bg-white rounded-lg shadow-md p-4 min-h-[300px]">
            <div>
              <Tooltip anchorElement="target" position="top" parentTitle={true}>
                <button
                  disabled={chart.regenerating || limitReached[chart.id]}
                  className="flex justify-start p-2"
                  onClick={() => {
                    handleRegenerate(chart.id);
                  }}
                >
                  <GrUpdate
                    className={`${chart.regenerating || limitReached[chart.id] ? "text-primary/10" : "text-primary hover:text-tertiary cursor-pointer"}`}
                    title={
                      chart.regenerating
                        ? "Regenerating..."
                        : limitReached[chart.id]
                          ? "Regenerate max attempts reached"
                          : "Regenerate"
                    }
                    size={18}
                  />
                </button>
              </Tooltip>
            </div>
            <h4 className="mb-2 font-medium text-black">{chart.title}</h4>
            <DonutChart
              seriesData={chart.payload.wizardRows.map(rowToObject)}
              categoryField={chart.recommendation.groupBy}
              valueField={chart.recommendation.metric}
              // mainTitle={chart.title}
              axisTitle={chart.recommendation.groupBy}
              valueAxisTitle={chart.recommendation.metric}
            />
          </div>
        );
      case "line":
        return (
          <div className="bg-white rounded-lg shadow-md p-4 min-h-[300px]">
            <div>
              <Tooltip anchorElement="target" position="top" parentTitle={true}>
                <button
                  disabled={chart.regenerating || limitReached[chart.id]}
                  className="flex justify-start p-2"
                  onClick={() => {
                    handleRegenerate(chart.id);
                  }}
                >
                  <GrUpdate
                    className={`${chart.regenerating || limitReached[chart.id] ? "text-primary/10" : "text-primary hover:text-tertiary cursor-pointer"}`}
                    title={
                      chart.regenerating
                        ? "Regenerating..."
                        : limitReached[chart.id]
                          ? "Regenerate max attempts reached"
                          : "Regenerate"
                    }
                    size={18}
                  />
                </button>
              </Tooltip>
            </div>
            <h4 className="mb-2 font-medium text-black">{chart.title}</h4>
            <LineChart
              categories={chart.payload?.categories ?? ""}
              seriesData={chart.payload?.series}
              // mainTitle={chart.title}
              axisTitle={
                chart.recommendation.groupBy ?? chart.recommendation.metric
              }
              valueAxisTitle={chart.recommendation.metric}
            />
          </div>
        );
      case "area":
        return (
          <div className="bg-white rounded-lg shadow-md p-4 min-h-[300px]">
            <div>
              <Tooltip anchorElement="target" position="top" parentTitle={true}>
                <button
                  disabled={chart.regenerating || limitReached[chart.id]}
                  className="flex justify-start p-2"
                  onClick={() => {
                    handleRegenerate(chart.id);
                  }}
                >
                  <GrUpdate
                    className={`${chart.regenerating || limitReached[chart.id] ? "text-primary/10" : "text-primary hover:text-tertiary cursor-pointer"}`}
                    title={
                      chart.regenerating
                        ? "Regenerating..."
                        : limitReached[chart.id]
                          ? "Regenerate max attempts reached"
                          : "Regenerate"
                    }
                    size={18}
                  />
                </button>
              </Tooltip>
            </div>
            <h4 className="mb-2 font-medium text-black">{chart.title}</h4>
            <AreaChart
              categories={chart.payload.categories}
              seriesData={chart.payload.series}
              // mainTitle={chart.title}
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
        } catch (err) {
          console.error("Error removing chart: ", err);
        }
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
      <div className="bg-white rounded-lg shadow-md p-3 max-h-[420px] flex flex-col">
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

  const chartSlots = [1, 2, 3, 4, 5];

  return (
    <div className="w-full p-6 mt-10">
      <Reveal className="w-full">
        <div className="" key={key}>
          <div className="flex flex-row justify-between">
            <img className="h-10" src="/logo.png" alt="System Logo" />
            <div className="flex relative left-0">
              <CloseButton
                buttonContent="Close"
                onClick={() => {
                  navigate("/");
                }}
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
          <p className="mb-8">
            <span className="font-bold">File name</span>:{" "}
            {file.name ?? "No file selected"}
          </p>
          <div>
            {isReady && !aiBusy ? (
              <div className="flex items-center">
                <Tooltip
                  anchorElement="target"
                  position="top"
                  parentTitle={true}
                >
                  <MdAddChart
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-dark text-white rounded cursor-pointer select-none hover:text-tertiary"
                    role="button"
                  >
                    <FaUpload />
                    Add exported chart
                  </label>

                  <div className="text-sm text-gray-300">
                    Supported: PDF, PNG, JPG, SVG
                  </div>
                </div>
              </div>
            ) : (
              <Skeleton shape="text" style={{ width: "100%", height: 30 }} />
            )}
            {/* <h3 className="mt-4">Preview (first 5 rows)</h3>
            <pre className="overflow-auto max-h-64 text-sm bg-gray-900 text-white p-2 rounded my-10">
              {JSON.stringify(parsedData.slice(0, 5), null, 2)}
            </pre> */}

            <div className="grid grid-cols-2 md:grid-cols-2 gap-x-[15px] gap-y-[30px]">
              {aiCards?.map((c) => (
                <div
                  key={c.id}
                  className="flex  flex-col justify-center bg-white rounded-lg shadow-md p-3"
                >
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
                      <div className="flex justify-center gap-4">
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
                      <div className="text-black">
                        <div>
                          <span className="font-bold">Min:</span>{" "}
                          {fmtNumber(c.value.min)}
                        </div>
                        <div>
                          <span className="font-bold">Max:</span>{" "}
                          {fmtNumber(c.value.max)}
                        </div>
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
                  {/* preview box skeleton */}
                  <div className="my-6">
                    <Skeleton
                      style={{ width: "100%", height: 160, borderRadius: 8 }}
                    />
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
                      <div
                        key={i}
                        className="bg-white rounded-lg p-4 min-h-[300px] shadow-md"
                      >
                        {/* card heading skeleton */}
                        <Skeleton
                          shape="text"
                          style={{ width: "40%", height: 18 }}
                        />
                        <div className="mt-4">
                          {/* large rectangle where the chart would be */}
                          <Skeleton
                            style={{
                              width: "100%",
                              height: 240,
                              borderRadius: 8,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
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
