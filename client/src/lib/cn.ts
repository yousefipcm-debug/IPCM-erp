import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
/** Joins class names and lets later Tailwind classes override earlier ones. */
export const cn = (...a: ClassValue[]) => twMerge(clsx(a));
export default cn;
