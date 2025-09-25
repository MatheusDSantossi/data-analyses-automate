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
} from "@progress/kendo-react-charts";

type SeriesItem = { name: string; data: number[] };

interface AreaChartProps {
  categories: string[];
  seriesData: SeriesItem[];
  mainTitle?: string;
  axisTitle: string;
  valueAxisTitle: string;
}

const AreaChart = ({
  seriesData,
  categories,
  mainTitle = "Time Series",
  axisTitle = "",
  valueAxisTitle = "",
}: AreaChartProps) => {
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
    <div style={{ height: "fit-content", width: 640 }}>
      <Chart
        seriesColors={chartMaterialV4Colors}
        transitions={false}
        renderAs="canvas"
        style={{ backgroundColor: "white", height: "100%", width: 640 }}
      >
        <ChartTitle text={mainTitle} font="bold 16px Arial" color="#111" />
        <ChartLegend
          position="right"
          labels={{ color: "#111", font: "normal 14px Arial" }}
        />
        <ChartCategoryAxis>
          <ChartCategoryAxisItem
            title={{ text: axisTitle, color: "#111", font: "bold 14px Arial" }}
            labels={{ color: "#111", font: "12px Arial" }}
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
              type="area"
              key={item.name}
              data={item.data}
              name={item.name}
              opacity={0.8}
            />
          ))}
        </ChartSeries>
      </Chart>
    </div>
  );
};

export default AreaChart;
