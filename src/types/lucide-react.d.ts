declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    color?: string;
    size?: string | number;
  }
  
  export type LucideComponent = ComponentType<LucideProps>;
  
  export const Camera: LucideComponent;
  export const Check: LucideComponent;
  export const ChevronRight: LucideComponent;
  export const Menu: LucideComponent;
  export const X: LucideComponent;
  export const ArrowRight: LucideComponent;
  export const Star: LucideComponent;
  export const Shield: LucideComponent;
  export const Users: LucideComponent;
  export const BarChart: LucideComponent;
  export const Award: LucideComponent;
} 