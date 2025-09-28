import {
  Chart,
  ChartTitle,
  ChartSeries,
  ChartSeriesItem,
  ChartLegend,
  ChartTooltip,
} from "@progress/kendo-react-charts";

type DataPoint = { [key: string]: string | number };

interface PieChartProps {
  seriesData: DataPoint[];
  categoryField: string;
  valueField: string;
  mainTitle?: string;
}

const PieChart = ({
  seriesData,
  categoryField = "Categoria",
  valueField = "Valor_Venda",
  mainTitle = "Time Series",
}: PieChartProps) => {
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
    // TODO: I need to transform the value in percentage
    const { dataItem, series, value } = context.point || context;
    console.log("dataItem pie: ", dataItem)
    return (
      <div>
        {dataItem.Segmento}: {(Number(sum) - value).toFixed(2)}%
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
        <ChartLegend position="right" visible={true} />

        <ChartSeries>
          <ChartSeriesItem
            type="pie"
            data={seriesData}
            categoryField={categoryField}
            field={valueField}
            labels={{ visible: true, content: labelContent }}
          >
            {/* <ChartSeriesLabels
              color="#fff"
              background="none"
              content={labelContent}
            /> */}
          </ChartSeriesItem>
        </ChartSeries>
      </Chart>
    </div>
  );
};

export default PieChart;
