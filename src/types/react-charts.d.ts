declare module "react-charts" {
  import { ReactElement } from "react";

  export interface AxisOptions<TDatum> {
    getValue: (datum: TDatum) => Date | string | number | null;
    elementType?: "line" | "bar" | "area" | "bubble";
    id?: string;
  }

  export interface ChartOptions<TDatum> {
    data: {
      label: string;
      data: TDatum[];
    }[];
    primaryAxis: AxisOptions<TDatum>;
    secondaryAxes: AxisOptions<TDatum>[];
    dark?: boolean;
  }

  export function Chart<TDatum>(props: { options: ChartOptions<TDatum> }): ReactElement;
}
