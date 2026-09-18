import { cn } from "cn";
import {
  BedDouble,
  Building2,
  Calculator,
  Car,
  Dumbbell,
  GraduationCap,
  Scissors,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Store,
  Utensils,
} from "lucide-react";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ className?: string }>;

/** Icon keys come from the `categories.icon` column (see supabase/seed.sql). */
const categoryIcons: Record<string, IconComponent> = {
  utensils: Utensils,
  scissors: Scissors,
  stethoscope: Stethoscope,
  dumbbell: Dumbbell,
  "building-2": Building2,
  calculator: Calculator,
  "graduation-cap": GraduationCap,
  "bed-double": BedDouble,
  car: Car,
  sparkles: Sparkles,
  "shopping-bag": ShoppingBag,
};

export interface CategoryIconProps {
  icon: string | null | undefined;
  className?: string;
}

export function CategoryIcon({ icon, className }: CategoryIconProps) {
  const Icon = categoryIcons[icon ?? ""] ?? Store;
  return <Icon className={cn("size-4", className)} />;
}
