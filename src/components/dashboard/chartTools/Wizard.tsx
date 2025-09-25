import {
  ChartWizard,
  type ChartWizardDataRow,
} from "@progress/kendo-react-chart-wizard";

interface WizardProps {
  data: ChartWizardDataRow[];
}

const Wizard = ({ data }: WizardProps) => {
  return (
    <div>
      <ChartWizard data={data} />
    </div>
  );
};

export default Wizard;
