import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Long forms: full screen on phones, a roomy centered dialog elsewhere. */
export const formDialogClass =
  "w-full max-w-2xl min-w-0 grid-cols-[minmax(0,1fr)] overflow-y-auto p-4 max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none sm:max-h-[90dvh] sm:p-6";
/** Short forms (a few fields): compact dialog, full width on phones. */
export const smallDialogClass =
  "min-w-0 grid-cols-[minmax(0,1fr)] overflow-y-auto max-sm:max-w-[calc(100%-1.5rem)] sm:max-h-[90dvh]";
