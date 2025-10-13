import {
  Chart,
  ChartTitle,
  ChartSeries,
  ChartSeriesItem,
  ChartLegend,
  ChartSeriesLabels,
  ChartTooltip,
} from "@progress/kendo-react-charts";
import type { ReactNode } from "react";

type DataPoint = { [key: string]: string | number };

interface DonutChartProps {
  seriesData: DataPoint[];
  categoryField: string;
  valueField: string;
  mainTitle?: string;
  axisTitle: string;
  valueAxisTitle: string;
}

const DonutChart = ({
  seriesData,
  categoryField = "Categoria",
  valueField = "Valor_Venda",
  mainTitle = "Time Series",
}: DonutChartProps) => {
  const chartMaterialV4Colors: string[] = [
    "#3f51b5", // Indigo
    "#2196f3", // Blue
    "#43a047", // Green
    "#e91e63", // Pink
    "#ffc107", // Amber
    "#ff5722", // Deep Orange

    // New Additions
    "#9c27b0", // Purple
    "#009688", // Teal
    "#f44336", // Red
    "#795548", // Brown
    "#673ab7", // Deep Purple
  ];

  console.log("seriesData: ", seriesData);
  // console.log("categories: ", categories);

  // The label content prop expects a function that returns the text for each slice.
  // The 'e' object contains details about the slice, like category, value, and percentage.
  const labelContent = (e: any) => e.dataItem.Estado;
  // const labelContent = (e: any) => e.value;
  // const labelContent = (e: any) => `${e.category}: \n ${e.value}%`;

  const valuesList = seriesData.map((item) => item.Valor_Venda);
  const sum = valuesList.reduce(
    (acc, currentValue) => Number(acc) + Number(currentValue),
    0
  );

  console.log("valuesList: ", valuesList);
  console.log("sum: ", sum);

  const renderTooltip = (context: any) => {
    // TODO: I need to check the value to see if the percentage is correct and get an item automatically
    const { dataItem, value } = context.point || context;
    console.log("dataItem: ", dataItem);
    return (
      <div>
        {Object.values(dataItem)[0] as ReactNode}:{" "}
        {((value / Number(sum)) * 100).toFixed(2)}%
        {/* {dataItem.Estado} ({series.name}): {value}% */}
      </div>
    );
  };

  console.log("labelContent: ", labelContent);

  return (
    <div style={{ height: "fit-content", width: 640 }}>
      <Chart
        seriesColors={chartMaterialV4Colors}
        transitions={false}
        renderAs="canvas"
        style={{ backgroundColor: "white", height: "100%", width: 640 }}
      >
        <ChartTooltip render={renderTooltip} />
        <ChartTitle text={mainTitle} font="bold 16px Arial" color="#111" />
        <ChartLegend
          position="right"
          visible={true}
          labels={{
            font: "12px Arial",
            color: "#111",
          }}
          margin={10}
          padding={5}
        />

        <ChartSeries>
          <ChartSeriesItem
            type="donut"
            data={seriesData}
            categoryField={categoryField}
            field={valueField}
          >
            <ChartSeriesLabels
              color="#fff"
              background="none"
              content={labelContent}
            />
          </ChartSeriesItem>
        </ChartSeries>
      </Chart>
    </div>
  );
};

export default DonutChart;
