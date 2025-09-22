import {
  Chart,
  ChartTitle,
  ChartSeries,
  ChartSeriesItem,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartValueAxis,
  ChartValueAxisItem,
  ChartLegend,
  type LegendLabels,
} from "@progress/kendo-react-charts";

type SeriesItem = { name: string; data: number[] };

interface LineChartProps {
  categories: string[];
  seriesData: SeriesItem[];
  mainTitle?: string;
  axisTitle: string;
  valueAxisTitle: string;
}

const LineChart = ({
  seriesData,
  categories,
  mainTitle = "Time Series",
  axisTitle = "",
  valueAxisTitle = "",
}: LineChartProps) => {
  const chartMaterialV4Colors: string[] = [
    "#3f51b5",
    "#2196f3",
    "#43a047",
    "#e91e63",
    "#ffc107",
    "#ff5722",
  ];

  // console.log("seriesData: ", seriesData);
  // console.log("categories: ", categories);

  return (
    <div style={{ height: "100%", width: 800 }}>
      <Chart
        seriesColors={chartMaterialV4Colors}
        transitions={false}
        renderAs="canvas"
        style={{ backgroundColor: "white", height: "100%", width: 800 }}
      >
        <ChartTitle text={mainTitle} font="bold 16px Arial" color="#111" />
        <ChartLegend
          position="right"
          labels={{ color: "#111", font: "normal 14px Arial" }}
        />
        <ChartCategoryAxis>
          <ChartCategoryAxisItem
            title={{ text: axisTitle, color: "#111", font: "bold 14px Arial" }}
            labels={{ rotation: -90, color: "#111", font: "12px Arial" }}
            categories={categories}
          />
        </ChartCategoryAxis>

        <ChartValueAxis>
          <ChartValueAxisItem
            title={{
              text: valueAxisTitle,
              color: "#111",
              font: "bold 14px Arial",
            }}
            majorGridLines={{
              visible: true,
              color: "black",
              width: 0.4,
              dashType: "dot",
            }}
          />
        </ChartValueAxis>
        <ChartSeries>
          {seriesData.map((item) => (
            <ChartSeriesItem
              key={item.name}
              type="line"
              data={item.data}
              name={item.name}
            />
          ))}
        </ChartSeries>
      </Chart>
    </div>
  );
};

export default LineChart;
