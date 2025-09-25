import {
  ProgressBar,
  type LabelProps,
} from "@progress/kendo-react-progressbars";
import type { ComponentType } from "react";

interface ProgressBarCompProps {
  label?: ComponentType<LabelProps>;
  value: number;
  min?: number;
  max?: number;
}

const ProgressBarComp = ({ label, value, min, max }: ProgressBarCompProps) => {
  return (
    <div>
      <ProgressBar label={label} value={value} />
    </div>
  );
};

export default ProgressBarComp;
