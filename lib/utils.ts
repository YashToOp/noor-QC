import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The single class-composition helper used by every primitive in components/ui. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
