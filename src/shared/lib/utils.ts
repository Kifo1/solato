import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMillis(millis: number): string {
  const safeMillis = Math.max(0, Number.isFinite(millis) ? millis : 0);
  const totalSeconds = Math.floor(safeMillis / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safeMillis % 1000) / 100);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}.${tenths}`;
  }

  return `${mm}:${ss}.${tenths}`;
}

export function formatMillisParts(millis: number): { main: string; tenths: string } {
  const safeMillis = Math.max(0, Number.isFinite(millis) ? millis : 0);
  const totalSeconds = Math.floor(safeMillis / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = String(Math.floor((safeMillis % 1000) / 100));

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return { main: `${hh}:${mm}:${ss}`, tenths };
  }

  return { main: `${mm}:${ss}`, tenths };
}

export function formatSecondsToString(seconds: number): string {
  if (seconds <= 0 || Number.isNaN(seconds)) return '0m';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }

  if (m === 0 && seconds > 0) {
    return '<1m';
  }

  return `${m}m`;
}

export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (typeof error === 'string' && error.trim().length > 0) return error;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim().length > 0) return msg;
  }
  return fallback;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
