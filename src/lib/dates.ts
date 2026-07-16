// src/lib/dates.ts
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

export const APP_TIMEZONE = 'America/Guayaquil';

export function getMonthGrid(currentDate: Date): Date[] {
  const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days: Date[] = [];
  let day = start;
  while (day <= end) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

// Devuelve los 7 días (lunes a domingo) de la semana que contiene `currentDate`.
export function getWeekGrid(currentDate: Date): Date[] {
  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function ecuadorToUtc(dateStr: string, timeStr: string): string {
  const localDateTime = `${dateStr}T${timeStr}:00`;
  return fromZonedTime(localDateTime, APP_TIMEZONE).toISOString();
}

export function utcToEcuador(utcIso: string): Date {
  return toZonedTime(utcIso, APP_TIMEZONE);
}

export { isSameMonth, isSameDay, format, es, startOfWeek, endOfWeek };