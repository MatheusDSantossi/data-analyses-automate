import {
  Chart,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartLegend,
  ChartNoDataOverlay,
  ChartSeries,
  ChartSeriesItem,
  ChartSeriesLabels,
  ChartTitle,
  ChartTooltip,
  ChartValueAxis,
  ChartValueAxisItem,
  type SeriesType,
} from "@progress/kendo-react-charts";
import { useMemo } from "react";

interface BarChartProps {
  seriesData: any[] | undefined;
  field?: string;
  categoryField?: string;
  mainTitle: string;
  axisTitle: string;
  axisValueTitle: string;
  chartType?: SeriesType | undefined;
  barColor?: string;
}

// const ChartContainer = ({ seriesData }: BarChartProps) => (
const BarChart = ({
  seriesData,
  mainTitle,
  axisTitle,
  axisValueTitle,
  chartType = "column",
  field = "Valor_Venda",
  categoryField = "Categoria",
  barColor = "#2196f3",
}: BarChartProps) => {
  // making sure categories exist and seriesData is an array
  const safeData = Array.isArray(seriesData) ? seriesData : [];

  const categories = useMemo(
    () => safeData.map((d) => (d?.[categoryField] ?? "N/A").toString()),
    [safeData, categoryField]
  );
  console.log("safeData", safeData);

  const chartMaterialV4Colors: string[] = [
    "#3f51b5",
    "#2196f3",
    "#43a047",
    "#ffc107",
    "#ff5722",
    "#e91e63",
  ];

  // if (typeof safeData[0][field] !== "number")

  // const customAggregate = (values, series, dataItems, category) => values.reduce((n, acc) => acc + n, 0);
  return (
    <div style={{ height: "100%", width: 800 }}>
      <Chart
        seriesColors={chartMaterialV4Colors}
        transitions={false}
        renderAs="canvas"
        style={{ backgroundColor: "white", height: "100%", width: 800 }}
      >
        <ChartTitle color="#111" font="bold 16px Arial" text={mainTitle} />
        {/* <ChartLegend position="top" orientation="horizontal" /> */}ç
        <ChartTooltip format="{0:n0}" />
        <ChartCategoryAxis>
          <ChartCategoryAxisItem
            categories={categories}
            title={{ text: axisTitle, color: "#111", font: "bold 14px Arial" }}
            labels={{ rotation: -45, color: "#111", font: "12px Arial" }}
            majorGridLines={{ visible: false }}
          />
        </ChartCategoryAxis>
        <ChartValueAxis>
          <ChartValueAxisItem
            title={{
              text: axisValueTitle,
              color: "#111",
              font: "bold 14px Arial",
            }}
            labels={{ format: "{0:n0}", color: "#111", font: "12px Arial" }}
            majorGridLines={{
              visible: true,
              color: "black",
              width: 0.4,
              dashType: "dot",
            }}
            // ensure bars start at zero
            min={0}
          />
        </ChartValueAxis>
        <ChartSeries>
          <ChartSeriesItem
            type={chartType}
            data={safeData}
            field={field}
            categoryField={categoryField}
            color={barColor}
            border={{ color: barColor, width: 1 }}
            gap={2}
            spacing={0.25}
            opacity={1}

            // aggregate="count"
          >
            <ChartSeriesLabels color="#111" format="{0:n0}" />
          </ChartSeriesItem>
        </ChartSeries>
        <ChartNoDataOverlay />
      </Chart>
    </div>
  );
};

export default BarChart;
