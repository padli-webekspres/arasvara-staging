export interface CardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<any>;
  change: string;
  trend: "up" | "down";
}
