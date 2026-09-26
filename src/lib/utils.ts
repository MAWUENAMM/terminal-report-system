import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatName(first: string, last: string, other?: string) {
  return [first, other, last].filter(Boolean).join(" ");
}
