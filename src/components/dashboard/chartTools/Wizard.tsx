import {
  ChartWizard,
  type ChartWizardDataRow,
} from "@progress/kendo-react-chart-wizard";
import { objectToFieldValueList } from "../../../utils/transformForWizard";

interface WizardProps {
  data: ChartWizardDataRow[];
}

const Wizard = ({ data }: WizardProps) => {
  console.log("Wizard data:", data);
  console.log("transformed Wizard data:", objectToFieldValueList(data));
  const wizardData: ChartWizardDataRow[] = objectToFieldValueList(data[0]);

  return (
    <div>
      <ChartWizard data={wizardData} />
    </div>
  );
};

export default Wizard;
