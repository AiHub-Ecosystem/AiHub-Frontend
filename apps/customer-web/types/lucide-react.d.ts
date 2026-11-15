declare module "lucide-react" {
  import type { ComponentType } from "react";

  export type LucideIcon = ComponentType<{
    size?: number | string;
    className?: string;
    color?: string;
    strokeWidth?: number | string;
  }>;

  export const CircleCheck: LucideIcon;
  export const Lightbulb: LucideIcon;
}
