import {
  Chart,
  ChartSeries,
  ChartSeriesItem,
} from "@progress/kendo-react-charts";

interface BarChartProps {
  seriesData: any[] | undefined;
}

// const ChartContainer = ({ seriesData }: BarChartProps) => (
const BarChart = ({ seriesData }: BarChartProps) => {
  
//      <Chart>
//       <ChartSeries>
//         <ChartSeriesItem data={seriesData} type="column" field="Valor_Venda" categoryField="Categoria" />
//       </ChartSeries>
//     </Chart>
//   )
    return (
    <Chart>
      <ChartSeries>
        <ChartSeriesItem data={seriesData} type="column" field="Valor_Venda" categoryField="Categoria" />
      </ChartSeries>
    </Chart>
  );
};

export default BarChart;
// export default ChartContainer;
