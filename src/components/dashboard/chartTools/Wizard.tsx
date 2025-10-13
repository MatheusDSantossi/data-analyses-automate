// Wizard.tsx (modified)
import { useEffect, useMemo, useState } from "react";
import { ChartWizard } from "@progress/kendo-react-chart-wizard";
import { aggregateRowsToWizardData } from "../../../utils/transformForWizard";
import { suggestAggregationMetric } from "../../../utils/wizardAIHelper";
import { useFile } from "../../../context/FileContext";
import { useNavigate } from "react-router-dom";

const Wizard = ({ data, file }: { data: Record<string, any>[]; file: any }) => {
  const navigate = useNavigate();
  const { parsedData } = useFile(); // or use data param
  const rows = data ?? parsedData ?? [];

  const [aiPicking, setAiPicking] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    metric: string | null;
    aggregation: string;
    reason: string;
  } | null>(null);

  useEffect(() => {
    if (!file) {
      navigate("/");
      return;
    }
  }, [file, navigate]);

  // ask AI on mount (safe: sample only)
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    let mounted = true;
    (async () => {
      try {
        setAiPicking(true);
        const rec = await suggestAggregationMetric(rows, 100); // sample 100 rows
        if (!mounted) return;
        setAiSuggestion(rec);
      } catch (err) {
        console.error("AI metric suggestion failed", err);
        setAiSuggestion(null);
      } finally {
        if (mounted) setAiPicking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [rows]);

  // Use the AI suggestion (or fallback) to generate wizard data for ChartWizard
  const wizardData2 = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    // if no metric suggested, fallback to simple sample rows -> raw wizard rows
    if (!aiSuggestion || !aiSuggestion.metric) {
      // sample-first-20 rows as raw wizard rows
      return rows
        .slice(0, 20)
        .map((r) =>
          Object.entries(r).map(([k, v]) => ({ field: k, value: v }))
        );
    }

    // aggregate by a sensible grouping: prefer Categoria if exists, otherwise use first categorical column
    const groupField = Object.prototype.hasOwnProperty.call(rows[0], "Categoria")
      ? "Categoria"
      : (Object.keys(rows[0]).find(
          (k) =>
            k.toLowerCase().includes("cat") || k.toLowerCase().includes("group")
        ) ?? Object.keys(rows[0])[0]);

    const aggregated = aggregateRowsToWizardData(
      rows,
      groupField,
      [aiSuggestion.metric],
      { topN: 10, sortDesc: true, includeCount: true }
    );
    return aggregated;
  }, [rows, aiSuggestion]);

  return (
    <div className="mt-10">
      <img className="h-10" src="/src/assets/logo.png" alt="System Logo" />
      <h2 className="text-2xl font-bold mb-8">Wizard</h2>
      <p>File: {file?.name ?? "No file selected"}</p>

      <div className="mb-4">
        {aiPicking ? (
          <div>AI analyzing sample to suggest metric...</div>
        ) : aiSuggestion ? (
          <div>
            <strong>AI suggestion:</strong> Metric ={" "}
            <em>{aiSuggestion.metric ?? "none"}</em>, aggregation ={" "}
            <em>{aiSuggestion.aggregation}</em>
            <div className="text-sm text-white">{aiSuggestion.reason}</div>
            {/* <div className="mt-2">
              <button
                className="mr-2 btn"
                onClick={() => {
                  // Accept already wired: ChartWizard uses wizardData2 computed from aiSuggestion
                }}
              >
                Use suggestion
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  // Clear suggestion -> fallback to raw sample rows
                  setAiSuggestion({
                    metric: null,
                    aggregation: "sum",
                    reason: "User cleared AI suggestion",
                  });
                }}
              >
                Use raw sample
              </button>
            </div> */}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            No AI suggestion available yet.
          </div>
        )}
      </div>

      <ChartWizard
        data={wizardData2}
        onClose={() => {
          navigate("/dashboard");
        }}
      />
    </div>
  );
};

export default Wizard;
